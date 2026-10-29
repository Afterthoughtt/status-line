# status-line

A Claude Code mod that draws one row above the prompt in the Claude Desktop app's Code tab. The terminal keeps Claude Code's own band.

- **Left:** how much of the context window the session uses, as a token count and a thin fill line. The count turns amber from 200k tokens and red from 250k. Hover it to see the percentage and the window size.
- **Right:** the computer the session runs on (its short hostname), then the GitHub account and the branch of the repository you're in. A branch in a linked worktree is marked `(worktree)`.

The account comes from the remote. A remote that uses an SSH host alias like `git@github-<account>:owner/repo.git` names `<account>`; otherwise the owner of a `github.com` remote is shown.

## Install

In the Desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `Afterthoughtt/status-line`, then **Add plugin**.

In a terminal session:

```
/plugin install status-line --marketplace Afterthoughtt/status-line
```

## Setting

**Home computer** (`home_host`): the short hostname (`hostname -s`) of your main computer. It draws dim, and any other computer draws in blue, so a session on another machine stands out. Left empty, every hostname draws dim.

## Development

```bash
claude plugin test .
claude plugin validate .
```
