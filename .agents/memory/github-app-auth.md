---
name: GitHub App authentication
description: SUN 1 GitHub App connection can be account-authorized and environment-attached while Git operations still lack a usable write credential.
---

The Replit GitHub App status is not sufficient proof that Git push or connector API access works. Confirm the actual repository operation before claiming GitHub access; never ask the user to paste a token.

**Why:** In this workspace, Replit reported the GitHub App as authorized and `addIntegration` returned success, but `git push` still failed with GitHub's invalid username/token response and the connector sandbox exposed no usable connection.

**How to apply:** Treat account authorization, environment attachment, and repository write access as three separate checks. If the final Git operation fails, stop and direct the user to repair the GitHub App repository permission or use the Replit Git pane.