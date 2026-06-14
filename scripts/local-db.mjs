// Boots a local, in-process DynamoDB emulator (dynalite) — no Docker, no AWS
// account needed. Data persists in .dynalite-data/ between restarts.
//
//   npm run db:local
//
// Then point the app at it with DYNAMODB_ENDPOINT=http://localhost:8005
// (already set in .env.local / .env.example).
import dynalite from "dynalite";
import { mkdirSync } from "fs";

const PORT = Number(process.env.DYNAMODB_LOCAL_PORT ?? 8005);
const DATA_DIR = ".dynalite-data";

mkdirSync(DATA_DIR, { recursive: true });

const server = dynalite({
  path: DATA_DIR,
  createTableMs: 0,
  deleteTableMs: 0,
  updateTableMs: 0,
});

server.listen(PORT, () => {
  console.log(`[zerodrop] local DynamoDB (dynalite) listening on http://localhost:${PORT}`);
  console.log(`[zerodrop] data dir: ${DATA_DIR}/`);
  console.log(`[zerodrop] next: npm run db:seed  (creates table + demo data)`);
});
