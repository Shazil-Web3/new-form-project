import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();
import { Client } from "pg";
import { runAuditTrailMigration } from "./auditMigration";
import { runPhase6bMigration } from "./phase6bMigration";
import { runRbacMigration } from "../rbac/rbacMigration";

async function initDb() {
  console.log('Connecting to PostgreSQL server...');
  try {
    // Connect directly to the application database via DATABASE_URL
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();

    console.log('Verifying core tables exist (schema is managed by migrations)...');
    try {
      const { rows } = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      );
      console.log(`Found ${rows.length} table(s) in the public schema.`);
    } catch (schemaErr: any) {
      console.log('Schema inspection notice:', schemaErr.message);
    }

    const sqlPath = fs.existsSync(path.join(__dirname, '..', '..', 'custom_docx.sql'))
      ? path.join(__dirname, '..', '..', 'custom_docx.sql')
      : path.join(__dirname, '..', 'custom_docx.sql');
    if (fs.existsSync(sqlPath)) {
      console.log('NOTE: custom_docx.sql is a MySQL dump and cannot be imported directly into PostgreSQL. Skipping file import.');
    } else {
      console.log('custom_docx.sql not found. Skipping table import.');
    }

    const patchPath = path.join(__dirname, 'custom_docx_sites_patch.sql');
    if (fs.existsSync(patchPath)) {
      console.log('NOTE: custom_docx_sites_patch.sql is a MySQL patch and cannot be applied directly to PostgreSQL. Skipping.');
    }

    await runAuditTrailMigration(client);

    await runPhase6bMigration(client);

    await runRbacMigration(client);

    await client.end();
    console.log("Database setup complete! You can now run 'npm start'.");
  } catch (err: any) {
    console.error('Database setup failed:', err.message);
    process.exit(1);
  }
}

initDb();
