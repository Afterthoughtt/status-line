# status-line

A Claude Code mod that draws one row above the prompt in the Claude Desktop app's Code tab. The terminal keeps Claude Code's own band.

- **Left:** how much of the context window the session uses, as a token count and a thin fill line. The count turns amber from 200k tokens and red from 250k. Hover it to see the percentage and the window size.
- **Right:** the computer the session runs on (its short hostname), then the GitHub account and the branch of the repository you're in. A branch in a linked worktree is marked `(worktree)`.

The account comes from the remote. A remote that uses an SSH host alias like `git@github-<account>:owner/repo.git` names `<account>`; otherwise the owner of a `github.com` remote is shown.

## Install

From a shell, with `claude` on your PATH (or the Desktop app's bundled copy in its place):

```bash
claude plugin marketplace add Afterthoughtt/status-line
claude plugin install status-line@local-mods
```

The row shows in new Desktop sessions, or after `/reload-plugins` in an open one. To have each push reach you on its own, add `"autoUpdate": true` to the `local-mods` entry under `extraKnownMarketplaces` in `~/.claude/settings.json`. Claude Code then checks the repo shortly after a session starts.

## Setting

**Main computer** (`main_computer`, off by default): turn it on for your main computer only, by adding `--config main_computer=true` to the install line there. That computer's hostname draws dim and every other computer's draws in blue, so a session on another machine stands out. It's a switch on each machine rather than a name, so renaming a computer changes nothing.

## Development

```bash
claude plugin test .
claude plugin validate .
```
