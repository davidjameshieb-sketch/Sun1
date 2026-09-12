# SUN 1

SUN 1 is an authorization-first security evidence platform for bounded,
authorized reviews of public targets and source code.

It is designed to help a researcher or security team answer:

> What was I authorized to review, what did I actually observe, what changed,
> and can I defend the conclusion later?

SUN 1 does not execute inspected code, bypass access controls, brute force
targets, send reports automatically, or treat static evidence as proof of
exploitability.

## Try the local analyzer

The local analyzer reads source files without importing or executing the
inspected project:

```bash
PYTHONPATH=sun1 python -m code_inspector.ci . \
  --format json \
  --output sun1-results.json
```

It supports:

- deterministic finding fingerprints;
- JSON and GitHub-compatible SARIF output;
- baseline comparison for newly observed findings;
- configurable `--fail-on` policy thresholds; and
- stable exit codes for clean, findings, invalid input, and incomplete analysis.

For a GitHub Code Scanning result:

```bash
PYTHONPATH=sun1 python -m code_inspector.ci . \
  --format sarif \
  --output sun1-results.sarif \
  --fail-on high
```

SUN 1 is a review aid. Findings require scope review and human verification
before reporting. Use it only on source or targets you are authorized to
analyze.

## Safety boundary

SUN 1 is intentionally conservative:

- confirm authorization and exact scope before analysis;
- keep exclusions, dates, methods, and contacts explicit;
- never bypass `401`/`403` protections;
- never execute inspected code;
- preserve evidence limitations and uncertainty; and
- never submit a security report automatically.

## Repository layout

- `sun1/code_inspector/` — local non-executing analysis engines and CI contract
- `artifacts/api-server/` — SUN 1 API server
- `artifacts/sun1-security/` — SUN 1 web application
- `lib/db/` — shared database schema
- `research/` — product, competitive, and safety research

## Development

```bash
pnpm install
pnpm run typecheck
cd sun1 && PYTHONPATH=. python -m unittest discover -s tests
```

The project is early and should not be described as a replacement for
professional penetration testing, SAST, DAST, dependency scanners, or asset
discovery platforms.