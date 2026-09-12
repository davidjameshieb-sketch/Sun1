import { and, desc, eq, ne } from "drizzle-orm";
import { db, driftEventsTable, scansTable, targetsTable } from "@workspace/db";

export async function recordInventoryDrift(input: {
  workspaceId: number;
  targetId: number;
  scanId: number;
  signature: string | null | undefined;
  summary: string;
}): Promise<void> {
  const [previous] = await db.select({
    id: scansTable.id,
    inventorySignature: scansTable.inventorySignature,
  }).from(scansTable).where(and(
    eq(scansTable.targetId, input.targetId),
    eq(scansTable.workspaceId, input.workspaceId),
    eq(scansTable.status, "completed"),
    ne(scansTable.id, input.scanId),
  )).orderBy(desc(scansTable.id)).limit(1);

  if (input.signature && previous?.inventorySignature && input.signature !== previous.inventorySignature) {
    await db.insert(driftEventsTable).values({
      workspaceId: input.workspaceId,
      targetId: input.targetId,
      previousScanId: previous.id,
      currentScanId: input.scanId,
      changeType: "inventory_changed",
      summary: `The authorized target inventory changed between scans. Current scan: ${input.summary}`,
    });
    await db.update(targetsTable).set({
      lastSignature: input.signature,
      lastDriftAt: new Date(),
    }).where(and(
      eq(targetsTable.id, input.targetId),
      eq(targetsTable.workspaceId, input.workspaceId),
    ));
    return;
  }

  await db.update(targetsTable).set({
    lastSignature: input.signature ?? null,
  }).where(and(
    eq(targetsTable.id, input.targetId),
    eq(targetsTable.workspaceId, input.workspaceId),
  ));
}