---
name: Unified analysis platform
description: Product and safety direction for extending SUN 1 across security domains.
---

Build new security capabilities as specialized engines on a shared analysis-run, evidence, policy, and findings platform, but expose one investigation workflow rather than separate products or engine choices. SUN 1 should infer the analysis path from the authorized input. Keep target authorization, bounded execution, network controls, and non-destructive defaults enforced in code. Source intake and static analysis must not execute repository code.

**Why:** The product is intended to cover materially different domains—source code, smart contracts, web/API, cloud, identity, exchanges, and financial systems—without duplicating lifecycle and safety infrastructure or weakening controls.

**How to apply:** Add engines through versioned analyzers that consume pinned inputs and emit normalized, reproducible findings. Extend the common run pipeline before creating a separate execution path, and do not expose internal engine boundaries as separate user workflows. The local agent may consume persisted findings only through a bounded, read-only authenticated API; it must not receive database or storage credentials.

**Why:** Keeping the agent as an external read-only consumer preserves the web platform's owner boundary and prevents local automation from becoming an alternate mutation or data-access path.

Reference validation should compare analyzer output to a human-curated expectation manifest derived from an advisory and source diff, rather than treating CVE text or a lexical match as proof.

**Why:** Public advisory prose is not a complete ground truth for source-level reachability, and automated confirmation would overstate what the deterministic analyzers establish.

**How to apply:** Keep advisory metadata, expected evidence, matched observations, misses, and analysis limitations separate in benchmark reports. Use benchmarks to measure regression and recall, not to declare exploitability.

Live investigation findings should persist a versioned structured evidence trace alongside human-readable evidence, and analyzer output-shape changes must advance the checker version.

**Why:** A prose-only finding cannot reliably distinguish an observed path from a confirmed issue or preserve its limitations across API, UI, and report generation.

**How to apply:** Keep evidence basis, path, authorization observation, confidence, and limitations machine-readable; migrate legacy rows with an explicit fallback trace rather than silently treating them as equivalent to new evidence.