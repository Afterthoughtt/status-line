import type { On } from 'claude-code'
import { describe, expect, test, type Engine } from 'claude-code/testing'

const viewport = { columns: 100, rows: 30 }

const band = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 95,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
} as const

const usage = (context: { window: number; tokens?: number; percent?: number }) => () => ({
  value: { startedAt: 0, context, rateLimits: [] },
})

type Checkout = { remote: string | null; branch?: string; sha?: string; isWorktree?: boolean }
const checkout = (on: On, repo: Checkout | null, hostname: string | null = 'Laptop') => {
  on('session.repo', () => ({ value: repo && { root: '/code/app', remote: repo.remote, internal: false, name: null } }))
  on('session.cwd', () => ({ value: '/code/app' }))
  on('process.run', ($, e) => {
    const done = (stdout: string, exitCode = 0) =>
      ({ value: { exitCode, stdout: `${stdout}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })

    if (e.argv[0] === 'hostname') return hostname ? done(hostname) : done('', 1)

    const args = e.argv.slice(1).join(' ')
    const out =
      args === 'branch --show-current' ? repo?.branch ?? '' :
      args === 'rev-parse --short HEAD' ? repo?.sha ?? 'f00ba12' :
      args === 'rev-parse --path-format=absolute --git-dir --git-common-dir'
        ? repo?.isWorktree ? '/code/app/.git/worktrees/wt\n/code/app/.git' : '/code/app/.git\n/code/app/.git'
        : ''

    return done(out)
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
}

describe('status-line', () => {
  test('stays hidden until the first reading', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000 }))
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)

      return <Text>engine</Text>
    })

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Context' })).toBeUndefined()
    await ui.unmount()
  })

  test('leads with the token count in neutral below 200k', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    const reading = await ui.find({ type: 'Text', text: '42k' })
    expect(reading?.props.color).toBeUndefined()
    expect(reading?.props).toMatchObject({ size: 'footnote', tabular: true })
    expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    const boxes = await ui.findAll({ type: 'Box' })
    expect(boxes.find(box => box.props.backgroundColor === 'promptBorder')?.props).toMatchObject({ width: 12, height: 0.15 })
    expect(boxes.find(box => box.props.width === '4%')?.props).toMatchObject({ height: 0.15, backgroundColor: 'inactive' })
    await ui.unmount()
  })

  test('keeps the percent and window for a hover', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect(await ui.find({ type: 'Box', key: 'context' })).toBeDefined()
    // The drawn tree carries hover beside props, where the element queries don't look.
    type Node = { props?: { display?: string }; hover?: unknown; children?: unknown[] }
    const hiddenIn = (node: Node): Node | undefined =>
      node.props?.display === 'none' ? node : (node.children ?? []).map(child => hiddenIn(child as Node)).find(Boolean)
    expect(hiddenIn((await ui.drawn()) as Node)).toMatchObject({ hover: { display: 'flex' } })
    expect(await ui.find({ type: 'Text', text: '4% of 1M' })).toBeDefined()
    await ui.unmount()
  })

  test('stays neutral just below 200k', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 196_000, percent: 19 }))

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect((await ui.find({ type: 'Text', text: '196k' }))?.props.color).toBeUndefined()
    await ui.unmount()
  })

  test('turns amber from 200k', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 204_000, percent: 20 }))

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect((await ui.find({ type: 'Text', text: '204k' }))?.props).toMatchObject({ color: 'warning' })
    await ui.unmount()
  })

  test('turns red from 250k', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 254_000, percent: 25 }))

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect((await ui.find({ type: 'Text', text: '254k' }))?.props).toMatchObject({ color: 'error' })
    expect((await ui.findAll({ type: 'Box' })).find(box => box.props.width === '25%')?.props).toMatchObject({ backgroundColor: 'error' })
    await ui.unmount()
  })

  test('reads 1M rather than 1000k near a full million', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 999_600, percent: 100 }))

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect(await ui.find({ type: 'Text', text: '1M' })).toBeDefined()
    await ui.unmount()
  })

  test('leaves the terminal band to the engine', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)

      return <Text>engine</Text>
    })

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'terminal', viewport, ...band })
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '42k' })).toBeUndefined()
    await ui.unmount()
  })

  test('yields the band to a survey', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 300_000, percent: 30 }))
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)

      return <Text>survey</Text>
    })

    const ui = await $.ui.mount({
      plugin: 'status-line',
      surface: 'desktop',
      viewport,
      ...band,
      props: { ...band.props, hasSurvey: true },
    })
    expect(await ui.find({ type: 'Text', text: 'survey' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '300k' })).toBeUndefined()
    await ui.unmount()
  })
})

describe('status-line git label', () => {
  const start = ($: Engine) =>
    $.session.start({ cwd: '/code/app', surface: 'desktop', isInteractive: true })

  test('names the account from the SSH host alias and the branch', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))
    checkout(on, { remote: 'git@github-octocat:octocat/app.git', branch: 'main' })
    await start($)

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect(await ui.find({ type: 'Text', text: '42k' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Octocat' })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: '- main' }))?.props).toMatchObject({ dimColor: true })
    expect((await ui.find({ type: 'Text', text: 'Laptop' }))?.props).toMatchObject({ size: 'footnote', dimColor: true })
    await ui.unmount()
  })

  test('falls back to the owner of a plain github.com remote', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))
    checkout(on, { remote: 'https://github.com/acme/app.git', branch: 'dev' })
    await start($)

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect(await ui.find({ type: 'Text', text: 'Acme' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '- dev' })).toBeDefined()
    await ui.unmount()
  })

  test('shows the short commit on a detached HEAD and marks a worktree', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))
    checkout(on, { remote: 'git@github-acme:acme/app.git', sha: 'a1b2c3d', isWorktree: true })
    await start($)

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect(await ui.find({ type: 'Text', text: '- a1b2c3d (worktree)' })).toBeDefined()
    await ui.unmount()
  })

  test('shows only the branch without a remote', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))
    checkout(on, { remote: null, branch: 'main' })
    await start($)

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect(await ui.find({ type: 'Text', text: 'main' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^- / })).toBeUndefined()
    await ui.unmount()
  })

  test('shows only the machine outside a repository', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))
    checkout(on, null)
    await start($)

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect(await ui.find({ type: 'Text', text: 'Laptop' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^- / })).toBeUndefined()
    await ui.unmount()
  })

  test('draws any other host in blue', { options: { home_host: 'laptop' } }, async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))
    checkout(on, { remote: null, branch: 'main' }, 'mini')
    await start($)

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect((await ui.find({ type: 'Text', text: 'mini' }))?.props).toMatchObject({ color: 'suggestion' })
    await ui.unmount()
  })

  test('draws the home host dim, ignoring case', { options: { home_host: 'laptop' } }, async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))
    checkout(on, { remote: null, branch: 'main' }, 'Laptop')
    await start($)

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    const host = await ui.find({ type: 'Text', text: 'Laptop' })
    expect(host?.props).toMatchObject({ dimColor: true })
    expect(host?.props.color).toBeUndefined()
    await ui.unmount()
  })

  test('draws every host dim with no home host set', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))
    checkout(on, { remote: null, branch: 'main' }, 'mini')
    await start($)

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    const host = await ui.find({ type: 'Text', text: 'mini' })
    expect(host?.props).toMatchObject({ dimColor: true })
    expect(host?.props.color).toBeUndefined()
    await ui.unmount()
  })

  test('says no commits in a new repository', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))
    checkout(on, { remote: null, branch: 'main', sha: '' })
    await start($)

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect(await ui.find({ type: 'Text', text: 'no commits' })).toBeDefined()
    await ui.unmount()
  })

  test('follows a branch switch as soon as git runs', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))
    const repo = { remote: 'git@github-octocat:octocat/app.git', branch: 'main' }
    checkout(on, repo)
    on('tool.call', () => ({ result: {} }))
    await start($)

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    repo.branch = 'feature'
    await $.tool.call({ tool: 'Bash', command: 'ls' })
    expect(await ui.find({ type: 'Text', text: '- main' })).toBeDefined()
    await $.tool.call({ tool: 'Bash', command: 'git switch feature' })
    expect(await ui.find({ type: 'Text', text: '- feature' })).toBeDefined()
    await ui.unmount()
  })

  test('reads the machine again after /clear', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))
    checkout(on, null)
    on('classic.SessionStart', () => ({}))
    await $.classic.SessionStart({ source: 'clear' })

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect(await ui.find({ type: 'Text', text: 'Laptop' })).toBeDefined()
    await ui.unmount()
  })

  test('leaves the machine out when it cannot be read', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000, tokens: 42_300, percent: 4 }))
    checkout(on, { remote: null, branch: 'main' }, null)
    await start($)

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect(await ui.find({ type: 'Text', text: 'main' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Laptop' })).toBeUndefined()
    await ui.unmount()
  })

  test('shows the machine and label alone before the first context reading', async ($, on) => {
    on('session.usage', usage({ window: 1_000_000 }))
    checkout(on, { remote: 'git@github-octocat:octocat/app.git', branch: 'main' })
    await start($)

    const ui = await $.ui.mount({ plugin: 'status-line', surface: 'desktop', viewport, ...band })
    expect(await ui.find({ type: 'Text', text: 'Laptop' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Octocat' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Context' })).toBeUndefined()
    await ui.unmount()
  })
})
