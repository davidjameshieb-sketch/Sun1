---
name: Workspace script runner
description: Environment-specific note for running temporary TypeScript maintenance jobs in this workspace.
---

Temporary TypeScript jobs should use the workspace runner at `scripts/node_modules/.bin/tsx`; filtered package commands do not expose `tsx` even though the workspace has the dependency available.

**Why:** A maintenance scan initially failed because `pnpm --filter @workspace/api-server exec tsx` could not resolve the binary, while the workspace scripts runner worked.

**How to apply:** Keep one-off runners temporary, execute them from the workspace root, and remove them after the job completes.