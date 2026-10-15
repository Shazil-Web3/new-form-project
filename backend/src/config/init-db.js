const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function initDb() {
  console.log("Connecting to MySQL server...");
  try {
    // Connect without selecting a database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });

    const dbName = process.env.DB_NAME || "custom_docx";
    console.log(`Creating database '${dbName}' if not exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.query(`USE \`${dbName}\`;`);

    const sqlPath = fs.existsSync(path.join(__dirname, "custom_docx.sql"))
      ? path.join(__dirname, "custom_docx.sql")
      : path.join(__dirname, "..", "custom_docx.sql");
    if (fs.existsSync(sqlPath)) {
      console.log("Importing tables from custom_docx.sql...");
      try {
        const sql = fs.readFileSync(sqlPath, "utf8");
        await connection.query(sql);
        console.log("Database schema imported successfully!");
      } catch (sqlErr) {
        console.log("Schema import notice (tables already exist):", sqlErr.message);
      }
    } else {
      console.log("custom_docx.sql not found. Skipping table import.");
    }

    const patchPath = path.join(__dirname, "custom_docx_sites_patch.sql");
    if (fs.existsSync(patchPath)) {
      console.log("Applying patch custom_docx_sites_patch.sql...");
      try {
        const patchSql = fs.readFileSync(patchPath, "utf8");
        await connection.query(patchSql);
        console.log("Patch applied successfully!");
      } catch (patchErr) {
        console.log("Patch notice (already applied or column exists):", patchErr.message);
      }
    }

    const { runAuditTrailMigration } = require("./auditMigration");
    await runAuditTrailMigration(connection);

    const { runPhase6bMigration } = require("./phase6bMigration");
    await runPhase6bMigration(connection);


    await connection.end();
    console.log("Database setup complete! You can now run 'npm start'.");
  } catch (err) {
    console.error("Database setup failed:", err.message);
    process.exit(1);
  }
}

initDb();
