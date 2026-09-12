import { and, eq, gt, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { analysisFindingsTable, analysisRunsTable, db, engagementsTable } from "@workspace/db";
import { analyzeSource, CHECKER_VERSION } from "./static-analysis";
import { ObjectStorageService } from "./objectStorage";

const MAX_WORKERS = 2;
const LEASE_MS = 30_000;
const JOB_TIMEOUT_MS = 120_000;
const storage = new ObjectStorageService();
let active = 0;

async function runOne(run: typeof analysisRunsTable.$inferSelect) {
  const claimToken = randomUUID();
  const leaseUntil = new Date(Date.now() + LEASE_MS);
  const [claimed] = await db.update(analysisRunsTable).set({ status: "running", leaseOwner: claimToken, leaseUntil })
    .where(and(eq(analysisRunsTable.id, run.id), eq(analysisRunsTable.status, "queued"))).returning();
  if (!claimed) return;
  const heartbeat = setInterval(() => {
    void db.update(analysisRunsTable).set({ leaseUntil: new Date(Date.now() + LEASE_MS) })
      .where(and(eq(analysisRunsTable.id, run.id), eq(analysisRunsTable.status, "running"), eq(analysisRunsTable.leaseOwner, claimToken), gt(analysisRunsTable.leaseUntil, new Date())));
  }, 10_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Analysis job timed out.")), JOB_TIMEOUT_MS);
  try {
    const [engagement] = await db.select().from(engagementsTable).where(eq(engagementsTable.id, run.engagementId));
    if (!engagement || !engagement.authorizationConfirmed) throw new Error("Authorization is no longer valid.");
    const result = await analyzeSource({ sourceType: engagement.sourceType as "github" | "archive", repositoryUrl: engagement.repositoryUrl ?? undefined, sourceRevision: engagement.sourceRevision, sourceLocation: run.sourceLocation, archiveFile: engagement.objectPath ? await storage.getObjectEntityFile(engagement.objectPath) : undefined, signal: controller.signal });
    await db.transaction(async (tx) => {
      if (result.findings.length) await tx.insert(analysisFindingsTable).values(result.findings.map((f) => ({
        runId: run.id,
        engagementId: run.engagementId,
        title: f.title,
        severity: f.severity,
        category: f.category,
        evidence: f.evidence,
        remediation: f.remediation,
        filePath: f.filePath,
        evidenceTrace: f.evidenceTrace,
      })));
       const [finished] = await tx.update(analysisRunsTable).set({ status: "completed", completedAt: new Date(), checksRun: result.checksRun, findingsCount: result.findings.length, summary: result.summary, metadata: result.metadata, leaseOwner: null, leaseUntil: null }).where(and(eq(analysisRunsTable.id, run.id), eq(analysisRunsTable.status, "running"), eq(analysisRunsTable.leaseOwner, claimToken), gt(analysisRunsTable.leaseUntil, new Date()))).returning();
      if (!finished) throw new Error("Analysis lease was lost before completion.");
      await tx.update(engagementsTable).set({ status: "completed" }).where(eq(engagementsTable.id, run.engagementId));
    });
  } catch (error) {
    await db.transaction(async (tx) => {
      const [failed] = await tx.update(analysisRunsTable).set({ status: "failed", completedAt: new Date(), summary: error instanceof Error ? error.message : "Static analysis failed.", leaseOwner: null, leaseUntil: null }).where(and(eq(analysisRunsTable.id, run.id), eq(analysisRunsTable.status, "running"), eq(analysisRunsTable.leaseOwner, claimToken), gt(analysisRunsTable.leaseUntil, new Date()))).returning();
      if (!failed) return;
      await tx.update(engagementsTable).set({ status: "failed" }).where(eq(engagementsTable.id, run.engagementId));
    });
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
  }
}

async function tick() {
  if (active >= MAX_WORKERS) return;
  const rows = await db.select().from(analysisRunsTable).where(
    and(eq(analysisRunsTable.status, "queued")),
  ).limit(MAX_WORKERS - active);
  for (const run of rows) { active++; void runOne(run).finally(() => { active--; }); }
  // Recover leases left behind by a crashed process.
  await db.update(analysisRunsTable).set({ status: "queued", leaseOwner: null, leaseUntil: null })
    .where(and(eq(analysisRunsTable.status, "running"), lt(analysisRunsTable.leaseUntil, new Date())));
}

setInterval(() => { void tick(); }, 1_000);
void tick();