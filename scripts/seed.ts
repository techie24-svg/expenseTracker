import { config } from "dotenv";
config({ path: ".env.local" });

import { setupDatabase } from "../src/lib/setupDb";

async function main() {
  const result = await setupDatabase();
  console.log(
    `Setup complete: schema ${result.schema}, ${result.inserted} cards inserted, ${result.skipped} skipped.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
