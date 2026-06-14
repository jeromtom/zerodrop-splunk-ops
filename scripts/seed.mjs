// Seeds the demo brand account + example drops/claims. Idempotent (re-running
// resets the seeded items). Run after init-table.mjs:
//
//   npm run db:seed
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomBytes, scryptSync } from "crypto";
import { ulid } from "ulid";

const TABLE = process.env.DDB_TABLE ?? "zerodrop";
const endpoint = process.env.DYNAMODB_ENDPOINT;
const region = process.env.ZD_AWS_REGION ?? process.env.AWS_REGION ?? "us-east-1";

const DEMO_EMAIL = "demo@zerodrop.app";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "drop-zero-2026";

const client = new DynamoDBClient({
  region,
  ...(endpoint
    ? { endpoint, credentials: { accessKeyId: "local", secretAccessKey: "local" } }
    : process.env.ZD_AWS_ACCESS_KEY_ID && process.env.ZD_AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: process.env.ZD_AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.ZD_AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
});
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

// Must match lib/auth.ts hashPassword().
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

const now = Date.now();
const put = (item) => ddb.send(new PutCommand({ TableName: TABLE, Item: item }));

async function seedUser() {
  await put({
    PK: `USER#${DEMO_EMAIL}`,
    SK: "PROFILE",
    type: "USER",
    email: DEMO_EMAIL,
    name: "Apex Studios",
    passwordHash: hashPassword(DEMO_PASSWORD),
    createdAt: now - 86400_000 * 30,
  });
  console.log(`[seed] brand user ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

function dropItem(d) {
  return {
    PK: `DROP#${d.id}`,
    SK: "META",
    type: "DROP",
    GSI1PK: `SLUG#${d.slug}`,
    GSI1SK: "META",
    GSI2PK: `USER#${DEMO_EMAIL}`,
    GSI2SK: `DROP#${d.createdAt}`,
    ownerEmail: DEMO_EMAIL,
    status: "live",
    waitlistCount: 0,
    description: "",
    ...d,
  };
}

function claimItem(dropId, c) {
  return {
    PK: `DROP#${dropId}`,
    SK: `CLAIM#${c.claimId}`,
    type: "CLAIM",
    dropId,
    ...c,
  };
}

const FIRST_NAMES = ["maya", "kenji", "ana", "leo", "zoe", "ravi", "nina", "theo", "ivy", "omar", "june", "felix"];
const DOMAINS = ["gmail.com", "proton.me", "outlook.com", "icloud.com"];
const buyerEmail = (i) =>
  `${FIRST_NAMES[i % FIRST_NAMES.length]}${(i * 7) % 97}@${DOMAINS[i % DOMAINS.length]}`;

async function main() {
  await seedUser();

  // 1) Hero drop for the live demo — fresh, 100 units, claim it on camera.
  const hero = {
    id: "01demohero0000000000000000".toLowerCase().slice(0, 26),
    slug: "aura-1-lunar",
    name: "AURA-1 Sneaker — Lunar",
    emoji: "👟",
    description:
      "Hand-numbered first run of the AURA-1 in lunar grey. 100 pairs, one per customer. When they're gone, they're gone.",
    price: 18000,
    totalStock: 100,
    claimed: 0,
    startsAt: now - 60_000,
    createdAt: now,
  };
  await put(dropItem(hero));
  console.log(`[seed] drop "${hero.name}" -> /d/${hero.slug} (fresh, for the live demo)`);

  // 2) A drop mid-flight: vinyl, partially claimed.
  const vinyl = {
    id: ulid().toLowerCase(),
    slug: "midnight-pressing-lp",
    name: "Midnight Pressing — Vinyl LP",
    emoji: "💿",
    description: "180g translucent pressing of the Midnight sessions. 250 copies worldwide.",
    price: 3500,
    totalStock: 250,
    claimed: 44, // 44 units held: 41 confirmed + 3 still on hold
    startsAt: now - 3600_000 * 26,
    createdAt: now - 3600_000 * 30,
  };
  await put(dropItem(vinyl));
  let pos = 0;
  for (let i = 0; i < 41; i++) {
    pos++;
    await put(
      claimItem(vinyl.id, {
        claimId: ulid(now - 3600_000 * 25 + i * 60_000).toLowerCase(),
        email: buyerEmail(i),
        status: "CONFIRMED",
        position: pos,
        createdAt: now - 3600_000 * 25 + i * 60_000,
      })
    );
  }
  for (let i = 41; i < 44; i++) {
    pos++;
    await put(
      claimItem(vinyl.id, {
        claimId: ulid(now - 120_000 + i * 1000).toLowerCase(),
        email: buyerEmail(i),
        status: "HELD",
        position: pos,
        createdAt: now - 120_000,
        holdExpiresAt: Math.floor(now / 1000) + 480,
        ttl: Math.floor(now / 1000) + 480 + 3600,
      })
    );
  }
  console.log(`[seed] drop "${vinyl.name}" (44/250 claimed, 41 confirmed)`);

  // 3) A sold-out drop with a waitlist.
  const ceramics = {
    id: ulid().toLowerCase(),
    slug: "studio-ceramics-04",
    name: "Studio Ceramics — Batch 04",
    emoji: "🏺",
    description: "Thirty wheel-thrown pieces from the spring kiln. Each one unique.",
    price: 6000,
    totalStock: 30,
    claimed: 30,
    waitlistCount: 12,
    startsAt: now - 86400_000 * 3,
    createdAt: now - 86400_000 * 4,
  };
  await put(dropItem(ceramics));
  for (let i = 0; i < 30; i++) {
    await put(
      claimItem(ceramics.id, {
        claimId: ulid(now - 86400_000 * 3 + i * 30_000).toLowerCase(),
        email: buyerEmail(i + 13),
        status: "CONFIRMED",
        position: i + 1,
        createdAt: now - 86400_000 * 3 + i * 30_000,
      })
    );
  }
  for (let i = 0; i < 12; i++) {
    await put(
      claimItem(ceramics.id, {
        claimId: ulid(now - 86400_000 * 2 + i * 45_000).toLowerCase(),
        email: buyerEmail(i + 50),
        status: "WAITLIST",
        position: i + 1,
        createdAt: now - 86400_000 * 2 + i * 45_000,
      })
    );
  }
  console.log(`[seed] drop "${ceramics.name}" (SOLD OUT, waitlist 12)`);

  // 4) A scheduled drop (countdown UI).
  const cap = {
    id: ulid().toLowerCase(),
    slug: "daybreak-cap",
    name: "Daybreak Cap — Spring Run",
    emoji: "🧢",
    description: "Six-panel cap in sun-faded canvas. Drops Friday, 10am PT.",
    price: 4200,
    totalStock: 150,
    claimed: 0,
    startsAt: now + 86400_000 * 2,
    createdAt: now - 3600_000 * 2,
  };
  await put(dropItem(cap));
  console.log(`[seed] drop "${cap.name}" (scheduled, countdown)`);

  console.log("\n[seed] done. Login: demo@zerodrop.app / " + DEMO_PASSWORD);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
