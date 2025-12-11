import { readFileSync } from "fs";
import { join } from "path";
import { getPool, closePool } from "./pool";

/**
 * Run database migrations
 * Reads and executes schema.sql
 */
async function migrate() {
  console.log("[DB] Starting migration...");

  const pool = getPool();

  try {
    // Read schema file
    const schemaPath = join(__dirname, "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");

    // Execute schema
    await pool.query(schema);

    console.log("[DB] Migration completed successfully");
  } catch (error) {
    console.error("[DB] Migration failed:", error);
    throw error;
  } finally {
    await closePool();
  }
}

// Run if called directly
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { migrate };
