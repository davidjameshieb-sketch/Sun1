import { and, eq, inArray, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  activityTable,
  db,
  findingsTable,
  researchJobsTable,
  scansTable,
  targetsTable,
} from "@workspace/db";
import {
  policyForProgram,
  runPassiveScan,
  runPublicApiInventory,
  runSafePublicInputChecks,
} from "./passive-scan";
import { recordInventoryDrift } from "./drift";

const MAX_WORKERS = 1;
const LEASE_MS = 120_000;
const MAX_SAFE_DEPTH = 3;
let active = 0;

async function runOne(job: typeof researchJobsTable.$inferSelect) {
  const claimToken = randomUUID();
  const leaseUntil = new Date(Date.now() + LEASE_MS);
  const [claimed] = await db.update(researchJobsTable).set({
    status: "running",
    leaseOwner: claimToken,
    leaseUntil,
    updatedAt: new Date(),
  }).where(and(
    eq(researchJobsTable.id, job.id),
    eq(researchJobsTable.status, "queued"),
  )).returning();
  if (!claimed) return;

  try {
    const [target] = await db.select().from(targetsTable).where(eq(targetsTable.id, claimed.targetId));
    const targetWorkspaceId = target?.workspaceId;
    const authorizationExpired = target?.authorizationExpiresAt != null
      && target.authorizationExpiresAt.getTime() <= Date.now();
    if (!target || !targetWorkspaceId || !target.authorizationConfirmed || target.status !== "ready" || authorizationExpired) {
      await db.update(researchJobsTable).set({
        status: "stopped",
        stopReason: authorizationExpired
          ? "Authorization expired before the scheduled review started."
          : "Authorization or target readiness is no longer valid.",
        completedAt: new Date(),
        updatedAt: new Date(),
        leaseOwner: null,
        leaseUntil: null,
      }).where(and(eq(researchJobsTable.id, claimed.id), eq(researchJobsTable.leaseOwner, claimToken)));
      if (target && targetWorkspaceId && authorizationExpired) {
        await db.update(targetsTable).set({
          status: "needs_authorization",
          monitoringEnabled: false,
          nextScanAt: null,
        }).where(and(
          eq(targetsTable.id, target.id),
          eq(targetsTable.workspaceId, targetWorkspaceId),
        ));
      }
      return;
    }

    const depth = Math.min(Math.max(claimed.currentDepth, 0), MAX_SAFE_DEPTH);
    const [scan] = await db.insert(scansTable).values({
      workspaceId: targetWorkspaceId,
      targetId: target.id,
      targetName: target.name,
      profile: `autonomous-depth-${depth}`,
      status: "running",
    }).returning();
    const passiveResult = await runPassiveScan(target.baseUrl, policyForProgram(target.program), depth);
    const inputResult = depth === 0 && /snapnames|namejet/i.test(target.program)
      ? await runSafePublicInputChecks(target.baseUrl)
      : { checksRun: 0, findings: [], summary: "" };
    const apiResult = depth === 0
      && /internet brands/i.test(target.program)
      && /(?:lifeapi|openapi)(?:test)?\.pulsepoint\.com/i.test(target.baseUrl)
      ? await runPublicApiInventory(target.baseUrl)
      : { checksRun: 0, docsFound: [], summary: "" };
    const result = {
      checksRun: passiveResult.checksRun + inputResult.checksRun + apiResult.checksRun,
      findings: [...passiveResult.findings, ...inputResult.findings],
      inventorySignature: passiveResult.inventorySignature,
      summary: `${passiveResult.summary} ${inputResult.summary} ${apiResult.summary}`.trim(),
    };

    if (result.findings.length) {
      await db.insert(findingsTable).values(result.findings.map((finding) => ({
        workspaceId: targetWorkspaceId,
        scanId: scan.id,
        targetId: target.id,
        ...finding,
        status: "open",
      })));
    }

    const completedAt = new Date();
    await db.update(scansTable).set({
      status: "completed",
      completedAt,
      checksRun: result.checksRun,
      findingsCount: result.findings.length,
      inventorySignature: result.inventorySignature,
      summary: result.summary,
    }).where(eq(scansTable.id, scan.id));
    await db.update(targetsTable).set({ lastScannedAt: completedAt }).where(and(
      eq(targetsTable.id, target.id),
      eq(targetsTable.workspaceId, targetWorkspaceId),
    ));
    await recordInventoryDrift({
      workspaceId: targetWorkspaceId,
      targetId: target.id,
      scanId: scan.id,
      signature: result.inventorySignature,
      summary: result.summary,
    });

    const hasCandidate = result.findings.length > 0;
    const reachedBudget = depth + 1 >= Math.min(claimed.maxDepth, MAX_SAFE_DEPTH);
    const nextStatus = hasCandidate
      ? "completed"
      : passiveResult.accessBlocked
        ? "paused"
        : reachedBudget
          ? "completed"
          : "queued";
    const stopReason = hasCandidate
      ? "Candidate evidence found; manual verification is required before any report draft."
      : passiveResult.accessBlocked
        ? "The public entry point returned HTTP 401/403. Deeper testing requires authorized access; no edge protection was bypassed."
      : reachedBudget
        ? "Safe depth budget exhausted without a candidate. No exploit or submission was attempted."
        : "";
    await db.update(researchJobsTable).set({
      status: nextStatus,
      currentDepth: depth + 1,
      checksRun: claimed.checksRun + result.checksRun,
      findingsCount: claimed.findingsCount + result.findings.length,
      stopReason,
      completedAt: nextStatus === "completed" ? completedAt : null,
      updatedAt: completedAt,
      leaseOwner: null,
      leaseUntil: null,
    }).where(and(
      eq(researchJobsTable.id, claimed.id),
      eq(researchJobsTable.status, "running"),
      eq(researchJobsTable.leaseOwner, claimToken),
    ));
    await db.insert(activityTable).values({
      workspaceId: target.workspaceId,
      type: hasCandidate ? "research.candidate" : nextStatus === "completed" ? "research.completed" : "research.depth.completed",
      message: `${target.name}: autonomous depth ${depth} completed. ${stopReason || "Continuing within the bounded safe depth budget."}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Autonomous research pass failed.";
    await db.update(researchJobsTable).set({
      status: "paused",
      stopReason: message,
      updatedAt: new Date(),
      completedAt: new Date(),
      leaseOwner: null,
      leaseUntil: null,
    }).where(and(
      eq(researchJobsTable.id, claimed.id),
      eq(researchJobsTable.status, "running"),
      eq(researchJobsTable.leaseOwner, claimToken),
    ));
    await db.insert(activityTable).values({
      workspaceId: claimed.workspaceId,
      type: "research.paused",
      message: `Autonomous research paused for job ${claimed.id}: ${message}`,
    });
  }
}

async function tick() {
  await scheduleDueTargets();
  if (active >= MAX_WORKERS) return;
  await db.update(researchJobsTable).set({
    status: "queued",
    leaseOwner: null,
    leaseUntil: null,
    updatedAt: new Date(),
  }).where(and(
    eq(researchJobsTable.status, "running"),
    lt(researchJobsTable.leaseUntil, new Date()),
  ));
  const jobs = await db.select().from(researchJobsTable)
    .where(eq(researchJobsTable.status, "queued"))
    .limit(MAX_WORKERS - active);
  for (const job of jobs) {
    active += 1;
    void runOne(job).finally(() => { active -= 1; });
  }
}

async function scheduleDueTargets() {
  const now = new Date();
  const candidates = await db.select().from(targetsTable)
    .where(eq(targetsTable.monitoringEnabled, true))
    .limit(50);
  for (const target of candidates) {
    if (!target.workspaceId) continue;
    const authorizationExpired = target.authorizationExpiresAt != null
      && target.authorizationExpiresAt.getTime() <= now.getTime();
    if (authorizationExpired) {
      await db.update(targetsTable).set({
        status: "needs_authorization",
        monitoringEnabled: false,
        nextScanAt: null,
      }).where(and(
        eq(targetsTable.id, target.id),
        eq(targetsTable.workspaceId, target.workspaceId),
      ));
      await db.insert(activityTable).values({
        workspaceId: target.workspaceId,
        type: "monitoring.authorization_expired",
        message: `${target.name}: monitoring paused because authorization expired.`,
      });
      continue;
    }
    if (!target.authorizationConfirmed || target.status !== "ready") continue;
    if (target.nextScanAt && target.nextScanAt.getTime() > now.getTime()) continue;
    const [activeJob] = await db.select({ id: researchJobsTable.id }).from(researchJobsTable)
      .where(and(
        eq(researchJobsTable.targetId, target.id),
        eq(researchJobsTable.workspaceId, target.workspaceId),
        inArray(researchJobsTable.status, ["queued", "running"]),
      )).limit(1);
    if (activeJob) continue;

    await db.insert(researchJobsTable).values({
      workspaceId: target.workspaceId,
      targetId: target.id,
      maxDepth: MAX_SAFE_DEPTH,
    });
    const intervalMinutes = Math.max(60, Math.min(target.monitoringIntervalMinutes, 10080));
    await db.update(targetsTable).set({
      nextScanAt: new Date(now.getTime() + intervalMinutes * 60_000),
    }).where(and(
      eq(targetsTable.id, target.id),
      eq(targetsTable.workspaceId, target.workspaceId),
    ));
    await db.insert(activityTable).values({
      workspaceId: target.workspaceId,
      type: "monitoring.scheduled",
      message: `${target.name}: scheduled authorized monitoring review.`,
    });
  }
}

setInterval(() => { void tick(); }, 2_000);
void tick();