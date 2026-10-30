import { atom, read, update } from 'claude-code'
import type { Color, EngineInterface, Register } from 'claude-code'
import type { GitLabel, Machine } from '../types'

const WRAP_UP_AT_TOKENS = 200_000
const NEW_SESSION_AT_TOKENS = 250_000

const tokens = (n: number) => {
  // From 999.5k, since rounding to thousands would read 1000k.
  if (n >= 999_500) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`

  return `${n}`
}

const tone = (used: number): Color | undefined =>
  used >= NEW_SESSION_AT_TOKENS ? 'error' : used >= WRAP_UP_AT_TOKENS ? 'warning' : undefined

// A thin line of theme colors, the track and the used part. Box sizes are plain numbers,
// read as text cells, so the height is a fraction of a row.
const LINE_WIDTH = 12
const LINE_HEIGHT = 0.15

const MENTIONS_GIT = /\b(git|gh)\b/

const gitLabel = atom({ plugin: 'status-line', key: 'gitLabel' } as const, null as GitLabel)
const machine = atom({ plugin: 'status-line', key: 'machine' } as const, null as Machine)

const readMachine = async ($: EngineInterface): Promise<Machine> => {
  try {
    const { exitCode, stdout } = await $.process.run(['hostname', '-s'], { timeoutMs: 5000 })

    return exitCode === 0 && stdout.trim() ? stdout.trim() : null
  } catch {
    return null
  }
}

const loadMachine = async ($: EngineInterface) => {
  const name = await readMachine($)
  await update($, machine, () => name)
}

// The remote's SSH host alias names the account (git@github-<account>:...); a plain
// github.com remote falls back to the owner in its path.
const account = (remote: string) => {
  const alias = remote.match(/^(?:ssh:\/\/)?[^@/]+@github-([^:/]+)[:/]/)?.[1]
  const name = alias ?? remote.match(/github\.com[:/]([^/]+)\//)?.[1]

  return name ? name.charAt(0).toUpperCase() + name.slice(1) : undefined
}

const readGit = async ($: EngineInterface): Promise<GitLabel> => {
  const repo = await $.session.repo()
  if (!repo) return null

  const cwd = await $.session.cwd()
  const git = async (...args: string[]) => {
    const { exitCode, stdout } = await $.process.run(['git', ...args], { cwd, timeoutMs: 5000 })

    return exitCode === 0 ? stdout.trim() : ''
  }

  // A new repo's branch has a name but no commit yet.
  const sha = await git('rev-parse', '--short', 'HEAD')
  const branch = sha ? (await git('branch', '--show-current')) || sha : 'no commits'
  // The two directories differ only in a linked worktree.
  const [gitDir, commonDir] = (await git('rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir')).split('\n')
  const tree = gitDir && commonDir && gitDir !== commonDir ? ' (worktree)' : ''
  const who = repo.remote ? account(repo.remote) : undefined

  return { account: who ?? null, branch: branch + tree }
}

const refreshGit = async ($: EngineInterface) => {
  try {
    const label = await readGit($)

    // The write redraws the band, which subscribed by reading the label.
    if (JSON.stringify(label) !== JSON.stringify(await read($, gitLabel))) {
      await update($, gitLabel, () => label)
    }
  } catch {}
}

export const register: Register = (on, options) => {
  // On the main computer the hostname draws dim; on any other it draws in the theme's blue.
  // A per-machine switch rather than a name, so renaming a machine changes nothing.
  const isMainComputer = options.main_computer === true

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await loadMachine($)
    await refreshGit($)

    return result
  })

  // /clear, /resume and /branch reset $.state without a new session.start.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    const result = await next(e)
    await loadMachine($)
    await refreshGit($)

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) await refreshGit($)

    return result
  })

  // Claude may switch branch or worktree mid-reply; catch up as soon as it does.
  on('tool.call', { tool: ['Bash', 'EnterWorktree', 'ExitWorktree'] }, async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId && (e.tool !== 'Bash' || MENTIONS_GIT.test(e.command))) await refreshGit($)

    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) $.ui.invalidate('ui.render')

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // Drawn for the Desktop app only; the terminal keeps the engine's band.
    if (e.surface === 'terminal' || e.props.hasSurvey) {
      return next(e)
    }

    const { context } = await $.session.usage()
    const label = await read($, gitLabel)
    const host = await read($, machine)
    const hasReading = context.tokens !== undefined && context.percent !== undefined

    if (!hasReading && !label && !host) {
      return next(e)
    }

    const used = context.tokens ?? 0
    const branch = label?.account ? `- ${label.branch}` : label?.branch
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" alignItems="center" justifyContent={hasReading ? 'space-between' : 'flex-end'} gap={2}>
        {hasReading ? (
          <Box key="context" flexDirection="row" alignItems="center" gap={1} flexShrink={1} minWidth={0}>
            <Text size="footnote" dimColor>Context</Text>
            <Text size="footnote" color={tone(used)} tabular>{tokens(used)}</Text>
            <Box width={LINE_WIDTH} height={LINE_HEIGHT} backgroundColor="promptBorder">
              <Box width={`${Math.min(context.percent!, 100)}%`} height={LINE_HEIGHT} backgroundColor={tone(used) ?? 'inactive'} />
            </Box>
            <Box display="none" hover={{ display: 'flex' }}>
              <Text size="footnote" dimColor tabular wrap="truncate-end">{`${context.percent}% of ${tokens(context.window)}`}</Text>
            </Box>
          </Box>
        ) : null}
        {host || label ? (
          <Box flexDirection="row" alignItems="center" gap={2} flexShrink={0}>
            {host ? (
              isMainComputer
                ? <Text size="footnote" dimColor>{host}</Text>
                : <Text size="footnote" color="suggestion">{host}</Text>
            ) : null}
            {label ? (
              <Box flexDirection="row" alignItems="center" gap={1}>
                {label.account ? <Text size="footnote">{label.account}</Text> : null}
                <Text size="footnote" dimColor>{branch}</Text>
              </Box>
            ) : null}
          </Box>
        ) : null}
      </Box>
    )
  })
}
