#!/usr/bin/env node

/**
 * Bakala ERP — Database Migration Runner
 *
 * Reads SQL migration files from supabase/migrations/ and executes them
 * sequentially against the live database via DATABASE_URL.
 *
 * Usage:
 *   node scripts/migrate.js                  # Run all migrations
 *   node scripts/migrate.js 00001_core_schema.sql  # Run a specific file
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase", "migrations");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ ERROR: DATABASE_URL environment variable is not set.");
    console.error("   Set it to your Supabase PostgreSQL connection string.");
    process.exit(1);
  }

  const specificFile = process.argv[2];
  let files;

  if (specificFile) {
    const filePath = path.join(MIGRATIONS_DIR, specificFile);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ ERROR: Migration file not found: ${filePath}`);
      process.exit(1);
    }
    files = [specificFile];
  } else {
    files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  }

  if (files.length === 0) {
    console.log("⚠️  No migration files found in", MIGRATIONS_DIR);
    process.exit(0);
  }

  console.log(`\n🔌 Connecting to database...`);

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log(`✅ Connected successfully.\n`);

    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      console.log(`📄 Running migration: ${file}`);
      console.log(`   (${sql.length} characters)\n`);

      await client.query(sql);

      console.log(`✅ ${file} — applied successfully.\n`);
    }

    console.log(`🎉 All migrations completed successfully.`);
  } catch (err) {
    console.error(`\n❌ Migration failed:`);
    console.error(`   ${err.message}`);
    if (err.detail) console.error(`   Detail: ${err.detail}`);
    if (err.hint) console.error(`   Hint: ${err.hint}`);
    process.exit(1);
  } finally {
    await client.end();
    console.log(`\n🔌 Connection closed.`);
  }
}

main();
