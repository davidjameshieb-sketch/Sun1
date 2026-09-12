---
name: Workspace parser dependencies
description: How to add parser libraries safely in the pnpm artifact workspace.
---

Parser libraries used by an artifact must be declared as direct dependencies of
that artifact, not relied on through a root or transitive package.

**Why:** The workspace package helper can target the monorepo root and the
artifact bundler resolves dependencies from the artifact package boundary.
Transitive availability is not a stable runtime contract.

**How to apply:** Install or update parser packages with the artifact filter,
then run that artifact's typecheck and build before restarting its workflow.