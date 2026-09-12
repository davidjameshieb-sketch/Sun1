# SUN 1 Agent

SUN 1 is a local-first Python agent system with retrieval memory, planning,
safe project tools, optional Ollama model routing, web ingestion, and a
Windows USB launcher.

This repository restores the missing runtime configuration from the supplied
archive and upgrades the event loop so it executes allowlisted tools and
records real outcomes instead of placeholder success messages.

## Quick start

From this directory:

```bash
python -m agent.sun1_agent_loop
```

In another terminal, submit an event:

```bash
python -c "from agent.sun1_perception import emit_observation; emit_observation({'goal':'audit SUN 1'})"
```

The default plan performs three read-only actions:

1. inspect the workspace;
2. compile-check all Python source;
3. record the available tool surface.

Plans are stored under `data/plans/` and outcomes are stored in
`data/memory.db`.

## Explicit action events

For deterministic automation, include actions:

```python
from agent.sun1_perception import emit_observation

emit_observation({
    "goal": "inspect memory implementation",
    "actions": [
        {
            "tool": "read_file",
            "arguments": {"rel_path": "agent/sun1_memory.py"},
        },
        {
            "tool": "search_files",
            "arguments": {"query": "heuristic", "rel_path": "agent"},
        },
        {
            "tool": "python_syntax_check",
            "arguments": {"rel_path": "agent"},
        },
    ],
})
```

Only tools marked `safe_for_auto` can run through the autonomous loop.
Potentially mutating or code-executing tools remain blocked.

## Optional Ollama features

The core event loop uses only the Python standard library. Existing chat,
embedding, and model-routing modules additionally expect the `ollama` Python
package and a reachable Ollama server. Common settings can be overridden with:

- `OLLAMA_HOST`
- `SUN1_LOCAL_MODEL`
- `SUN1_CLOUD_MODEL`
- `SUN1_EMBED_MODEL`
- `SUN1_USE_CLOUD`
- `SUN1_DATA_DIR`

## Code inspection utilities

The standard-library-only `code_inspector` package maps Python syntax,
function calls, symbol reads and writes, imports, local dependency
relationships, configuration references, assertions, state assignments, and
cryptographic primitives. It now also emits explicit Python control-flow
graphs, deterministic local data-flow observations, and a lexical
JavaScript/TypeScript inventory. It reads source files without importing or
executing the inspected project.

Run all components and write a JSON report:

```bash
python -m code_inspector.project_analyzer . --output inspection-report.json
```

For local and CI use, prefer the stable analysis contract. It produces
deterministic finding fingerprints, explicit status/exit semantics, baseline
suppression, and GitHub-compatible SARIF without executing inspected code:

```bash
# JSON contract; exit 0 is clean, 1 is policy findings, 2 is invalid input,
# and 3 is an incomplete or failed analysis.
python -m code_inspector.ci . --output sun1-results.json

# GitHub Code Scanning-compatible output.
python -m code_inspector.ci . --format sarif --output sun1-results.sarif

# Only fail on newly observed findings compared with a trusted baseline.
python -m code_inspector.ci . \
  --baseline sun1-results.json \
  --format sarif \
  --output sun1-diff.sarif
```

The default policy fails on medium-or-higher findings. Use
`--fail-on high` to reduce blocking, or `--fail-on none` to make the command
report-only. A baseline suppresses findings by stable fingerprint; it does not
silently delete them from the full report. Parser issues produce exit code 3
unless `--allow-incomplete` is explicitly supplied.

Each component can also be imported independently:

```python
from code_inspector import ASTParser, DependencyTracker

structure = ASTParser(".").analyze()
dependencies = DependencyTracker(".").analyze()
```

## Reference-case validation

For safe regression testing, `reference_validation` compares analyzer output
from a pinned source directory with a human-curated expectation manifest
derived from a public advisory and its vulnerable-to-fixed source diff. It
never imports or executes the inspected project and does not treat a match as
proof of exploitability:

```bash
python -m code_inspector.reference_validation \
  ./pinned-source \
  --manifest ./benchmarks/reference-case.example.json \
  --output reference-validation.json
```

The result reports matched and unmatched evidence, observed findings, the
advisory reference, and explicit limitations. Use the existing owner-protected
API/GitHub workflow to acquire an authorized pinned public revision; the
validator only accepts a local source directory. Python data-flow evidence
propagates through bounded local helper and method calls, while dynamic
dispatch and external package internals remain unresolved.

Run the controlled positive/negative baseline as one command:

```bash
python -m code_inspector.benchmark_runner \
  --suite benchmarks/suite.json \
  --output benchmark-results.json
```

The baseline contains an intentionally unsanitized `request.args` to
`subprocess.Popen` fixture and a patched `shlex.quote` version. It reports
positive recall, negative specificity, false positives, and per-case evidence.
These fixtures validate analyzer behavior; they are not a real target or a
substitute for a verified historical advisory benchmark.

Run the route-reachability baseline separately:

```bash
python -m code_inspector.route_benchmark_runner \
  --suite benchmarks/route-suite.json \
  --output route-benchmark-results.json
```

It scores a cross-function route-to-sink fixture against a clean route fixture.

## Code Property Graph foundation

The project analyzer also emits a deterministic Python CPG under the
`code_property_graph` key. The current `sun1-cpg-v1` schema includes:

- repository modules and local import relationships;
- function, class, and parameter symbol nodes;
- resolved direct cross-file call edges;
- positional and keyword argument-to-parameter binding edges;
- existing CFG nodes and labeled control-flow edges;
- conservative source and local data-dependency edges; and
- explicit unresolved import and dynamic-call records.

The CPG builder never imports or executes inspected projects. It resolves
ordinary static Python imports and direct calls only. Reflection, dynamic
dispatch, generated modules, and external package internals remain unresolved
and are reported as such. This is an architectural graph backbone, not a
claim of complete interprocedural or whole-program vulnerability analysis.

The investigation worker's TypeScript analyzer also performs a bounded
route-to-sink inventory for common Python decorator routes,
Express/Fastify-style JavaScript or TypeScript routes, and JSON OpenAPI
documents. A resulting finding means that the source structure shows a route
and a recognized sensitive sink connected through statically named handlers;
it does not prove that the endpoint is exploitable or that runtime middleware
is absent.

The API source-analysis pipeline sends reviewed Python source text to
`code_inspector.process_worker` in a separate Python process. The worker writes
only those reviewed files to a temporary directory and uses AST-based
`DataFlowAnalyzer` parsing; it never imports or executes the inspected source.
The API process retains archive-size, file-count, expanded-size, review-byte,
owner-authorization, and overall job-timeout controls, and maps validated
worker observations into the shared `analysisFindings` shape.

The agent can optionally read existing owner-authorized SUN 1 analysis results
through the API without receiving database access. Configure
`SUN1_PLATFORM_API_URL` and `SUN1_PLATFORM_API_TOKEN`, then use the safe tools
`platform_latest_analysis`, `platform_analysis_findings`, or
`get_engagement_findings`. The latter resolves the latest completed run and
returns a bounded findings response.

## Diff-aware analysis

`code_inspector.diff_analysis` compares two saved JSON reports without
re-running either target. It reports added and removed files, CPG nodes and
edges, reachability paths, and specialist hypotheses. Treat the result as a
change-review aid: runtime configuration, generated code, dynamic dispatch,
and authorization scope still require separate review.

```bash
python -m code_inspector.diff_analysis \
  --baseline baseline.json \
  --current current.json
```

## Current expansion priorities

1. Persist specialist hypotheses and diff results through the owner-protected investigation API.
2. Add safe local verification adapters behind the existing manual confirmation gate.
3. Extend authorization and tenant-boundary rules across framework-specific route middleware.
4. Add versioned policy plugins and append-only analysis/audit history.
5. Expand parser-backed framework coverage while preserving bounded, non-executing analysis.