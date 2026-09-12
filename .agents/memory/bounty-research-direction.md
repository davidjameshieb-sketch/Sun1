---
name: Bounty research direction
description: Product guardrails and optimization direction for SUN 1's researcher workflow.
---

SUN 1 should optimize bounty outcomes through explainable opportunity prioritization, evidence quality, duplicate-risk reduction, and owner-recorded acceptance/payout feedback—not through guaranteed-payout claims or unrestricted automation.

**Why:** Bounty success depends on scope compliance, reproducible evidence, novelty, and program decisions; a static scanner or opaque score cannot guarantee payment.

**How to apply:** Keep program intake owner-authorized, keep verification and submission manual-confirmed, and use historical outcomes only as sparse, explainable calibration signals. Never add automatic target crawling, exploit execution, or report submission as a shortcut to payout volume.

Program opportunity ranking should remain on the owner-entered baseline until at least three outcomes exist for that program; only then should acceptance and realized payout history influence the ranking.

**Why:** Small bounty histories are too noisy to justify a personalized score, and presenting a calibrated value without enough evidence would create false confidence.

**How to apply:** Expose the sample size and whether the score is baseline or calibrated, and keep the score framed as a prioritization aid rather than a payout forecast.

Autonomous target research must use a persistent, leased, bounded-depth queue and stop on candidate evidence, exhausted safe checks, invalid authorization, or an operational failure.

**Why:** An unbounded “keep testing until something is found” loop cannot guarantee a vulnerability and creates risk of scope drift, excessive traffic, or unsafe escalation.

**How to apply:** Keep automated work read-only and rate-limited; require manual verification before a finding becomes a report candidate, and never let the worker submit reports or execute exploits.