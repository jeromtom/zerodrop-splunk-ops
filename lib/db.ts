import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * DynamoDB client factory.
 *
 * - Local dev: set DYNAMODB_ENDPOINT (e.g. http://localhost:8005 for dynalite /
 *   DynamoDB Local). Dummy credentials are injected automatically.
 * - Production (Vercel): set ZD_AWS_ACCESS_KEY_ID / ZD_AWS_SECRET_ACCESS_KEY /
 *   ZD_AWS_REGION. (Vercel reserves the AWS_* names, hence the ZD_ prefix.)
 * - Anywhere else (e.g. EC2/CI with a role): falls back to the default AWS
 *   credential provider chain.
 */

export const TABLE = process.env.DDB_TABLE ?? "zerodrop";

const endpoint = process.env.DYNAMODB_ENDPOINT;
const region =
  process.env.ZD_AWS_REGION ?? process.env.AWS_REGION ?? "us-east-1";
const accessKeyId = process.env.ZD_AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.ZD_AWS_SECRET_ACCESS_KEY;

function buildClient(): DynamoDBDocumentClient {
  const base = new DynamoDBClient({
    region,
    ...(endpoint
      ? {
          endpoint,
          credentials: { accessKeyId: "local", secretAccessKey: "local" },
        }
      : accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
  });
  return DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

// Cache across hot reloads in dev so we don't leak sockets.
const globalForDb = globalThis as unknown as { __zdDdb?: DynamoDBDocumentClient };
export const ddb: DynamoDBDocumentClient = (globalForDb.__zdDdb ??= buildClient());
