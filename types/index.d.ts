/** The remote's account (null without one) and the checked-out branch; null outside a repository. */
export type GitLabel = { account: string | null; branch: string } | null

/** The short hostname of the computer the session runs on; null until read, or when it can't be. */
export type Machine = string | null

declare module 'claude-code' {
  interface PluginState {
    'status-line': { gitLabel: GitLabel; machine: Machine }
  }
}
