import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";
import { ddb, TABLE } from "./db";
import type { Claim, ClaimResult, Drop } from "./types";

/**
 * ZeroDrop data layer — DynamoDB single-table design.
 *
 *  Entity   PK            SK            GSI1PK        GSI2PK
 *  user     USER#email    PROFILE       —             —
 *  drop     DROP#id       META          SLUG#slug     USER#email (SK: DROP#createdAt)
 *  claim    DROP#id       CLAIM#ulid    —             —
 *
 * Concurrency model: there are NO locks and NO read-modify-write cycles
 * anywhere in the claim path. Stock is enforced by a single conditional
 * UpdateItem (`claimed < totalStock`) — DynamoDB serializes writers, so
 * overselling is impossible by construction. Hold expiry uses the same
 * trick: a conditional HELD->EXPIRED flip acts as the mutex, and only the
 * winner returns the unit to stock.
 */

const HOLD_SECONDS = 10 * 60;

const isConditionFailure = (err: unknown): boolean =>
  err instanceof Error && err.name === "ConditionalCheckFailedException";

// ---------------------------------------------------------------- drops

export interface NewDropInput {
  name: string;
  description: string;
  emoji: string;
  price: number; // cents
  totalStock: number;
  startsAt: number; // epoch ms
  ownerEmail: string;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function createDrop(input: NewDropInput): Promise<Drop> {
  const id = ulid().toLowerCase();
  const base = slugify(input.name) || "drop";
  const slug = `${base}-${id.slice(-4)}`;
  const drop: Drop = {
    id,
    slug,
    name: input.name,
    description: input.description,
    emoji: input.emoji,
    price: input.price,
    totalStock: input.totalStock,
    claimed: 0,
    waitlistCount: 0,
    status: "live",
    startsAt: input.startsAt,
    createdAt: Date.now(),
    ownerEmail: input.ownerEmail.toLowerCase(),
  };
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `DROP#${id}`,
        SK: "META",
        type: "DROP",
        GSI1PK: `SLUG#${slug}`,
        GSI1SK: "META",
        GSI2PK: `USER#${drop.ownerEmail}`,
        GSI2SK: `DROP#${drop.createdAt}`,
        ...drop,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );
  return drop;
}

export async function getDrop(id: string): Promise<Drop | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `DROP#${id}`, SK: "META" } })
  );
  return (res.Item as Drop | undefined) ?? null;
}

export async function getDropBySlug(slug: string): Promise<Drop | null> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": `SLUG#${slug}` },
      Limit: 1,
    })
  );
  return (res.Items?.[0] as Drop | undefined) ?? null;
}

export async function listDropsByOwner(email: string): Promise<Drop[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :pk AND begins_with(GSI2SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `USER#${email.toLowerCase()}`,
        ":sk": "DROP#",
      },
      ScanIndexForward: false,
    })
  );
  return (res.Items ?? []) as Drop[];
}

// ---------------------------------------------------------------- claims

/**
 * THE core write of the product. One conditional UpdateItem:
 *
 *   SET claimed = claimed + 1  IF  claimed < totalStock AND live AND started
 *
 * Thousands of concurrent callers race on this; DynamoDB guarantees exactly
 * `totalStock` of them succeed. The new `claimed` value doubles as the
 * buyer's claim number.
 */
export async function claimDrop(dropId: string, email: string): Promise<ClaimResult> {
  const now = Date.now();
  let position: number;
  try {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `DROP#${dropId}`, SK: "META" },
        ConditionExpression:
          "claimed < totalStock AND #st = :live AND startsAt <= :now",
        UpdateExpression: "SET claimed = claimed + :one",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":one": 1, ":live": "live", ":now": now },
        ReturnValues: "ALL_NEW",
      })
    );
    position = (res.Attributes as Drop).claimed;
  } catch (err) {
    if (!isConditionFailure(err)) throw err;
    // Figure out *why* the condition failed.
    const drop = await getDrop(dropId);
    if (!drop) return { outcome: "error" };
    if (drop.status !== "live") return { outcome: "ended" };
    if (drop.startsAt > now) return { outcome: "not_started" };
    return waitlistDrop(dropId, email); // genuinely sold out
  }

  const claim: Claim = {
    claimId: ulid().toLowerCase(),
    dropId,
    email,
    status: "HELD",
    position,
    createdAt: now,
    holdExpiresAt: Math.floor(now / 1000) + HOLD_SECONDS,
  };
  await putClaim(claim);
  return { outcome: "held", claim };
}

/** Sold out -> atomic waitlist position via the same counter trick. */
async function waitlistDrop(dropId: string, email: string): Promise<ClaimResult> {
  const res = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `DROP#${dropId}`, SK: "META" },
      UpdateExpression: "ADD waitlistCount :one",
      ExpressionAttributeValues: { ":one": 1 },
      ReturnValues: "ALL_NEW",
    })
  );
  const claim: Claim = {
    claimId: ulid().toLowerCase(),
    dropId,
    email,
    status: "WAITLIST",
    position: (res.Attributes as Drop).waitlistCount,
    createdAt: Date.now(),
  };
  await putClaim(claim);
  return { outcome: "waitlisted", claim };
}

async function putClaim(claim: Claim): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `DROP#${claim.dropId}`,
        SK: `CLAIM#${claim.claimId}`,
        type: "CLAIM",
        // `ttl` is the table's TTL attribute: DynamoDB hard-deletes abandoned
        // holds server-side, one hour after they expire. Expiry *correctness*
        // is handled app-side (lazy conditional flip in reconcileHold) because
        // TTL deletion can lag — TTL here is cleanup, not correctness. In
        // production you'd pair this with DynamoDB Streams to release stock
        // for holds nobody ever read again.
        ...(claim.holdExpiresAt ? { ttl: claim.holdExpiresAt + 3600 } : {}),
        ...claim,
      },
    })
  );
}

export async function getClaim(dropId: string, claimId: string): Promise<Claim | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `DROP#${dropId}`, SK: `CLAIM#${claimId}` },
    })
  );
  const claim = (res.Item as Claim | undefined) ?? null;
  if (claim) return reconcileHold(claim);
  return claim;
}

/**
 * Lazy hold expiry. The conditional HELD->EXPIRED flip is the mutex: out of
 * any number of concurrent readers, exactly one wins and returns the unit to
 * stock. No cron, no locks.
 */
export async function reconcileHold(claim: Claim): Promise<Claim> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (claim.status !== "HELD" || !claim.holdExpiresAt || claim.holdExpiresAt > nowSec) {
    return claim;
  }
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `DROP#${claim.dropId}`, SK: `CLAIM#${claim.claimId}` },
        ConditionExpression: "#st = :held AND holdExpiresAt <= :now",
        UpdateExpression: "SET #st = :expired REMOVE holdExpiresAt, #ttl",
        ExpressionAttributeNames: { "#st": "status", "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":held": "HELD",
          ":expired": "EXPIRED",
          ":now": nowSec,
        },
      })
    );
  } catch (err) {
    if (isConditionFailure(err)) return { ...claim, status: "EXPIRED" };
    throw err;
  }
  // We won the flip -> release the unit back to stock.
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `DROP#${claim.dropId}`, SK: "META" },
      ConditionExpression: "claimed > :zero",
      UpdateExpression: "SET claimed = claimed - :one",
      ExpressionAttributeValues: { ":one": 1, ":zero": 0 },
    })
  ).catch((err) => {
    if (!isConditionFailure(err)) throw err;
  });
  return { ...claim, status: "EXPIRED", holdExpiresAt: undefined };
}

export async function confirmClaim(
  dropId: string,
  claimId: string
): Promise<{ ok: boolean; claim: Claim | null }> {
  const nowSec = Math.floor(Date.now() / 1000);
  try {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `DROP#${dropId}`, SK: `CLAIM#${claimId}` },
        ConditionExpression: "#st = :held AND holdExpiresAt > :now",
        UpdateExpression: "SET #st = :confirmed REMOVE holdExpiresAt, #ttl",
        ExpressionAttributeNames: { "#st": "status", "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":held": "HELD",
          ":confirmed": "CONFIRMED",
          ":now": nowSec,
        },
        ReturnValues: "ALL_NEW",
      })
    );
    const attrs = { ...(res.Attributes as Record<string, unknown>) };
    delete attrs.PK;
    delete attrs.SK;
    delete attrs.type;
    return { ok: true, claim: attrs as unknown as Claim };
  } catch (err) {
    if (!isConditionFailure(err)) throw err;
    return { ok: false, claim: await getClaim(dropId, claimId) };
  }
}

export async function listRecentClaims(dropId: string, limit = 15): Promise<Claim[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": `DROP#${dropId}`, ":sk": "CLAIM#" },
      ScanIndexForward: false, // ULIDs sort by time -> newest first
      Limit: limit,
    })
  );
  return (res.Items ?? []) as Claim[];
}

export interface ConfirmBreakdown {
  confirmed: number;
  held: number;
  expired: number;
  waitlist: number;
}

export async function countClaimsByStatus(dropId: string): Promise<ConfirmBreakdown> {
  const out: ConfirmBreakdown = { confirmed: 0, held: 0, expired: 0, waitlist: 0 };
  let cursor: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": `DROP#${dropId}`, ":sk": "CLAIM#" },
        ProjectionExpression: "#st",
        ExpressionAttributeNames: { "#st": "status" },
        ExclusiveStartKey: cursor,
      })
    );
    for (const item of res.Items ?? []) {
      const s = (item as { status: string }).status;
      if (s === "CONFIRMED") out.confirmed++;
      else if (s === "HELD") out.held++;
      else if (s === "EXPIRED") out.expired++;
      else if (s === "WAITLIST") out.waitlist++;
    }
    cursor = res.LastEvaluatedKey;
  } while (cursor);
  return out;
}

// ----------------------------------------------------- demo utilities

/** Wipe all claims and reset counters so the drop can be demoed again. */
export async function resetDrop(dropId: string): Promise<number> {
  let deleted = 0;
  let cursor: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": `DROP#${dropId}`, ":sk": "CLAIM#" },
        ProjectionExpression: "PK, SK",
        ExclusiveStartKey: cursor,
      })
    );
    for (const item of res.Items ?? []) {
      await ddb.send(
        new DeleteCommand({
          TableName: TABLE,
          Key: { PK: item.PK, SK: item.SK },
        })
      );
      deleted++;
    }
    cursor = res.LastEvaluatedKey;
  } while (cursor);
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `DROP#${dropId}`, SK: "META" },
      UpdateExpression: "SET claimed = :zero, waitlistCount = :zero",
      ExpressionAttributeValues: { ":zero": 0 },
    })
  );
  return deleted;
}

export interface SimulationResult {
  requested: number;
  claimed: number;
  waitlisted: number;
  errors: number;
  durationMs: number;
  oversold: number;
  finalClaimed: number;
  totalStock: number;
}

/**
 * The on-stage proof: fire `count` concurrent claim attempts at a drop and
 * report exactly how many got stock vs. waitlist. `oversold` is always 0 —
 * that's the point.
 */
export async function simulateBuyers(
  dropId: string,
  count: number,
  concurrency = 50
): Promise<SimulationResult> {
  const started = Date.now();
  const run = ulid().slice(-6).toLowerCase();
  let claimed = 0;
  let waitlisted = 0;
  let errors = 0;

  let next = 0;
  async function worker() {
    while (next < count) {
      const i = next++;
      try {
        const res = await claimDrop(dropId, `buyer-${i}-${run}@sim.zerodrop.app`);
        if (res.outcome === "held") claimed++;
        else if (res.outcome === "waitlisted") waitlisted++;
        else errors++;
      } catch {
        errors++;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, count) }, () => worker())
  );

  const drop = await getDrop(dropId);
  return {
    requested: count,
    claimed,
    waitlisted,
    errors,
    durationMs: Date.now() - started,
    oversold: drop ? Math.max(0, drop.claimed - drop.totalStock) : 0,
    finalClaimed: drop?.claimed ?? 0,
    totalStock: drop?.totalStock ?? 0,
  };
}
