"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pg_1 = require("pg");
const auditMigration_1 = require("./auditMigration");
const phase6bMigration_1 = require("./phase6bMigration");
const rbacMigration_1 = require("../rbac/rbacMigration");
async function initDb() {
    console.log('Connecting to PostgreSQL server...');
    try {
        // Connect directly to the application database via DATABASE_URL
        const client = new pg_1.Client({
            connectionString: process.env.DATABASE_URL,
        });
        await client.connect();
        console.log('Verifying core tables exist (schema is managed by migrations)...');
        try {
            const { rows } = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            console.log(`Found ${rows.length} table(s) in the public schema.`);
        }
        catch (schemaErr) {
            console.log('Schema inspection notice:', schemaErr.message);
        }
        const sqlPath = fs_1.default.existsSync(path_1.default.join(__dirname, '..', '..', 'custom_docx.sql'))
            ? path_1.default.join(__dirname, '..', '..', 'custom_docx.sql')
            : path_1.default.join(__dirname, '..', 'custom_docx.sql');
        if (fs_1.default.existsSync(sqlPath)) {
            console.log('NOTE: custom_docx.sql is a MySQL dump and cannot be imported directly into PostgreSQL. Skipping file import.');
        }
        else {
            console.log('custom_docx.sql not found. Skipping table import.');
        }
        const patchPath = path_1.default.join(__dirname, 'custom_docx_sites_patch.sql');
        if (fs_1.default.existsSync(patchPath)) {
            console.log('NOTE: custom_docx_sites_patch.sql is a MySQL patch and cannot be applied directly to PostgreSQL. Skipping.');
        }
        await (0, auditMigration_1.runAuditTrailMigration)(client);
        await (0, phase6bMigration_1.runPhase6bMigration)(client);
        await (0, rbacMigration_1.runRbacMigration)(client);
        await client.end();
        console.log("Database setup complete! You can now run 'npm start'.");
    }
    catch (err) {
        console.error('Database setup failed:', err.message);
        process.exit(1);
    }
}
initDb();
