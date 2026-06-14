// Creates the single `zerodrop` table (+ GSIs + TTL). Idempotent.
// Works against dynalite/DynamoDB Local (DYNAMODB_ENDPOINT set) and real AWS.
//
//   node scripts/init-table.mjs
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceInUseException,
  UpdateTimeToLiveCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";

const TABLE = process.env.DDB_TABLE ?? "zerodrop";
const endpoint = process.env.DYNAMODB_ENDPOINT;
const region = process.env.ZD_AWS_REGION ?? process.env.AWS_REGION ?? "us-east-1";

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

async function main() {
  try {
    await client.send(
      new CreateTableCommand({
        TableName: TABLE,
        BillingMode: "PAY_PER_REQUEST", // on-demand: scales to zero AND to millions
        AttributeDefinitions: [
          { AttributeName: "PK", AttributeType: "S" },
          { AttributeName: "SK", AttributeType: "S" },
          { AttributeName: "GSI1PK", AttributeType: "S" },
          { AttributeName: "GSI1SK", AttributeType: "S" },
          { AttributeName: "GSI2PK", AttributeType: "S" },
          { AttributeName: "GSI2SK", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: "GSI1", // slug -> drop
            KeySchema: [
              { AttributeName: "GSI1PK", KeyType: "HASH" },
              { AttributeName: "GSI1SK", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
          },
          {
            IndexName: "GSI2", // owner -> drops, newest first
            KeySchema: [
              { AttributeName: "GSI2PK", KeyType: "HASH" },
              { AttributeName: "GSI2SK", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
          },
        ],
      })
    );
    console.log(`[zerodrop] creating table "${TABLE}"...`);
    await waitUntilTableExists({ client, maxWaitTime: 120 }, { TableName: TABLE });
    console.log(`[zerodrop] table "${TABLE}" is ACTIVE`);
  } catch (err) {
    if (err instanceof ResourceInUseException) {
      console.log(`[zerodrop] table "${TABLE}" already exists — skipping create`);
    } else {
      throw err;
    }
  }

  // TTL cleans up abandoned holds (epoch-seconds attribute `ttl`).
  try {
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: TABLE,
        TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true },
      })
    );
    console.log(`[zerodrop] TTL enabled on attribute "ttl"`);
  } catch (err) {
    // dynalite doesn't implement UpdateTimeToLive; expiry is also enforced
    // app-side, so local dev is unaffected.
    console.log(`[zerodrop] TTL not enabled (${err.name}) — fine for local emulators`);
  }

  const desc = await client.send(new DescribeTableCommand({ TableName: TABLE }));
  console.log(`[zerodrop] status: ${desc.Table.TableStatus}, items: ${desc.Table.ItemCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
