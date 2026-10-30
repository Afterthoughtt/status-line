# status-line

A Claude Code mod that draws one row in the band above the prompt, in the Claude Desktop app's Code tab only. The terminal keeps Claude Code's own band, and a survey takes the band when one shows. It is not Claude Code's own status line (the `statusLine` setting), which it neither uses nor changes.

- Left: `Context 264k`, the token count in the stage color (theme default below 200k, `warning` from 200k, `error` from 250k), then a thin line of the window's fill: a `promptBorder` track 12 cells wide and 0.15 of a row tall, its used part `inactive` below 200k and the stage color after. Hovering adds `26% of 1M`.
- Right: the short hostname (`hostname -s`), dim on the main computer (the `main_computer` switch in `plugin.json`'s `userConfig`, on only on the owner's MacBook), the theme's `suggestion` blue everywhere else; then the GitHub account and the branch, dim.
  - The account comes from the remote's SSH host alias (`git@github-octocat:...` gives `Octocat`), else the owner of a plain github.com remote; none without a remote.
  - The branch is the short commit on a detached HEAD, `no commits` in a new repo, and gets ` (worktree)` in a linked worktree. Outside a repo only the hostname shows.
  - The Mac's own name (`scutil --get ComputerName`) doesn't come through inside the app, and the owner prefers the hostname.

Design rules the owner set: the app's theme colors only (no hex, rgb or SVG drawings), `footnote` text size, no icons, no separator dot between hostname and branch, no status words beside the stage color, a plain line with no ticks.

Rules the engine holds the band to:

- Box sizes take only numbers (text cells) or percentages, never `px` strings.
- Don't put `await next(e)` (Claude Code's own band content) inside the row: the band then vanishes whenever Claude is idle.

When it reads things: the hostname at `session.start` and after `/clear`, `/resume` or `/branch` (`classic.SessionStart`, since those reset `$.state`); the git label at the same times, when a main-session reply ends, and right after a main-session Bash command that mentions `git` or `gh` or an `EnterWorktree`/`ExitWorktree` call. A plain `cd` into another repo shows only when the reply ends.

On this Mac it's installed from this folder as `status-line@local-mods` (the local marketplace `local-mods`, at user scope), so an edit here reaches sessions after `/reload-plugins`, with no reinstall. Other machines install it from GitHub with the README's commands and `autoUpdate` on, so they pick up each push to `main`. `plugin.json` has no `version` on purpose: with one, those installs ignore new commits until it changes. Account sync through claude.ai is not used: a plugin added that way downloaded on the MacBook but didn't draw in the Code tab. The switch is stored per machine in `~/.claude/settings.json` under `pluginConfigs`, so a settings file copied to another machine would mark that one main too. The repo is `Afterthoughtt/status-line` (public, so keep the owner's other account names and hostnames out of it); the README holds the install lines. The Desktop app runs its own bundled Claude Code, which can be a different version from the `claude` command the checks below use.

## Checks

```bash
claude plugin test .
claude plugin validate .
```

`validate` reports a missing LICENSE and icon, a `CLAUDE.md` at the plugin root, and the `classic.SessionStart` and `tool.call` hooks as gating without `.catch`. None needs a fix: the first two apply only to submitting to the plugin directory, this file is for working on the mod, and both hooks call `next(e)` before their own work.

Type-check with the `tsconfig.json` from the header of the plugin-authoring skill's `types/claude-code.d.ts`, kept outside this folder, with its `include` naming that file, `hooks`, `types` and `tests`. `tsc` isn't on PATH; TypeScript is in the npx cache under `~/.npm/_npx/`.

Test kit notes: element queries (`find`, `findAll`) match `type`, `key` and `text` only, and a Box's `hover` sits beside its props in `ui.drawn()`, not in them. A test that raises `classic.SessionStart` or `$.tool.call` answers that event itself with `on(...)`.

## Known limits

**The band is sometimes missing until a message is sent, and the mod can't fix it.** The owner accepts this; sending any message or running `/reload-plugins` brings it back.

- Opening a session in Desktop attaches it (`session.attach`, surface `desktop`), and usually `ui.render` for `AbovePrompt` follows at once. In about one attach in four it doesn't: the hook isn't called at all until the next `prompt.submit`, for minutes if nobody types.
- The trigger isn't pinned down. The owner sees it when the session's last message ends on a request to them (the next-step box with a question), but one such session was drawn on a later attach with the question still pending. The attaches that drew reported a viewport 44 rows tall; the ones that didn't, 41.
- When the hook is called, its first call already has the host, and usually the context reading and git label, so the mod's "nothing to show" path isn't the cause.
- `$.ui.invalidate('ui.render')` doesn't make the app draw: not at `session.start` (no surface is attached yet, `$.session.surfaces()` is `[]`), and not right after `session.attach` (missed about as often with it as without).
- `/reload-plugins` draws the band at once, since a plugin load asks for a draw.
- Desktop sessions write no debug log, so the engine's skipped/refused lines can't be read there. To see what the hooks do, log from the mod (`$.fs.write` to an absolute path works), then remove the logging and have every open session reload, or quit the app: a session keeps the code it loaded.

## Open issues

- [ ] **Walk the owner through an SSH session test.** Desktop copies plugins to `~/.claude/remote/plugins/` on an SSH host; unconfirmed whether a plugin installed from a local folder is among them. Steps: add an SSH environment for a host (none is saved yet), start a session there, check the band names that host in blue; if the band is missing, run `ls ~/.claude/remote/plugins/` in that session's terminal. The `suggestion` blue has not been seen yet either.
