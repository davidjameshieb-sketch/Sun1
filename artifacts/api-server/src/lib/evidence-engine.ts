export const EVIDENCE_ENGINE_VERSION = "sun1-evidence-v1";

export type EvidenceBasis =
  | "source-pattern"
  | "route-to-sink"
  | "response-observation"
  | "inventory-observation";

export type AnalyzerProvenance =
  | "python-route-reachability"
  | "python-data-flow"
  | "javascript-typescript-ast"
  | "repository-inventory"
  | "secret-pattern"
  | "passive-response";

export type EvidenceReviewIssue = {
  analyzer: AnalyzerProvenance;
  filePath: string | null;
  line: number | null;
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export type EvidenceTrace = {
  schemaVersion: typeof EVIDENCE_ENGINE_VERSION;
  basis: EvidenceBasis;
  analyzer: AnalyzerProvenance;
  complete: boolean;
  source: string | null;
  sink: string | null;
  path: string[];
  authorization: "observed" | "missing" | "unknown";
  confidence: "high" | "medium" | "low";
  limitations: string[];
};

const STRUCTURAL_LIMITATIONS = [
  "This is statically observed evidence, not proof of exploitability.",
  "Dynamic dispatch, runtime configuration, and external dependency behavior may be unresolved.",
  "Manual, non-destructive verification is required before reporting.",
];

export function routeEvidence(input: {
  route: string;
  source: string;
  path: string[];
  sink: string;
  authorization: "observed" | "missing";
  analyzer: Extract<AnalyzerProvenance, "python-route-reachability" | "javascript-typescript-ast">;
  complete?: boolean;
}): EvidenceTrace {
  return {
    schemaVersion: EVIDENCE_ENGINE_VERSION,
    basis: "route-to-sink",
    analyzer: input.analyzer,
    complete: input.complete ?? true,
    source: input.route,
    sink: input.sink,
    path: input.path,
    authorization: input.authorization,
    confidence: input.authorization === "observed" ? "medium" : "low",
    limitations: [...STRUCTURAL_LIMITATIONS],
  };
}

export function sourcePatternEvidence(input: {
  source: string;
  sink?: string;
  path?: string[];
  confidence?: EvidenceTrace["confidence"];
  analyzer?: Extract<AnalyzerProvenance, "secret-pattern" | "repository-inventory" | "python-data-flow">;
  complete?: boolean;
}): EvidenceTrace {
  return {
    schemaVersion: EVIDENCE_ENGINE_VERSION,
    basis: "source-pattern",
    analyzer: input.analyzer ?? "secret-pattern",
    complete: input.complete ?? true,
    source: input.source,
    sink: input.sink ?? null,
    path: input.path ?? [],
    authorization: "unknown",
    confidence: input.confidence ?? "low",
    limitations: [...STRUCTURAL_LIMITATIONS],
  };
}

export function inventoryEvidence(source: string, path: string[] = []): EvidenceTrace {
  return {
    schemaVersion: EVIDENCE_ENGINE_VERSION,
    basis: "inventory-observation",
    analyzer: "repository-inventory",
    complete: true,
    source,
    sink: null,
    path,
    authorization: "unknown",
    confidence: "low",
    limitations: [
      "The inventory identifies a configuration or technology pattern only.",
      "The observation does not establish impact or exploitability.",
      "Review the authorized source and runtime configuration before acting.",
    ],
  };
}

export function responseEvidence(input: {
  source: string;
  path?: string[];
  confidence?: EvidenceTrace["confidence"];
}): EvidenceTrace {
  return {
    schemaVersion: EVIDENCE_ENGINE_VERSION,
    basis: "response-observation",
    analyzer: "passive-response",
    complete: true,
    source: input.source,
    sink: null,
    path: input.path ?? [],
    authorization: "unknown",
    confidence: input.confidence ?? "medium",
    limitations: [
      "The observation describes one bounded response, not all runtime paths.",
      "Headers and public metadata can vary by deployment or request context.",
      "Confirm scope and impact manually before reporting.",
    ],
  };
}

export function summarizeEvidence(trace: EvidenceTrace): string {
  return `${trace.basis}; ${trace.confidence} confidence; authorization ${trace.authorization}; ${trace.path.length} path steps`;
}