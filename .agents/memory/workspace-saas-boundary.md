---
name: Workspace SaaS boundary
description: The staged public SaaS boundary for SUN 1 and the safety reason advanced legacy workflows remain restricted.
---

SUN 1's first public SaaS release uses authenticated, one-user private workspaces for the URL-only target register, passive scans, monitoring, findings, drift, reports, and activity. Free workspaces are capped at three targets and use bounded monitoring; source-upload analysis and bounty workflows remain behind the legacy owner gate until their records are workspace-scoped.

**Why:** Existing source-analysis and bounty tables predate tenant isolation. Exposing them before scoping every read and write would risk cross-subscriber data access.

**How to apply:** Treat workspace membership and workspaceId filters as mandatory for new subscriber-facing records. Do not remove the legacy owner restriction from engagements or bounty routes until those schemas and queries are isolated and tested.