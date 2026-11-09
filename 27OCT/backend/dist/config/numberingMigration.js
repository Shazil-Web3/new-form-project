"use strict";
/**
 * Numbering System Migration
 * Sets up tables for number sequences (Document, Project, Cost Center)
 * and safely ensures required columns exist on documents table.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNumberingMigration = runNumberingMigration;
async function getColumns(client, table) {
    const { rows } = await client.query('SELECT column_name AS "Field" FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = $1', [table]);
    return new Set(rows.map((c) => c.Field));
}
async function runNumberingMigration(poolOrConn) {
    // pg.Client also exposes .connect(); only a real Pool needs connect()+release().
    const isPool = Boolean(poolOrConn && typeof poolOrConn.connect === 'function'
        && poolOrConn.constructor && poolOrConn.constructor.name === 'Pool');
    const connection = isPool ? await poolOrConn.connect() : poolOrConn;
    try {
        console.log('🔢 Checking numbering system database tables...');
        // 1. Table: number_sequences
        await connection.query(`
      CREATE TABLE IF NOT EXISTS "number_sequences" (
        "id" SERIAL PRIMARY KEY,
        "organization_id" INTEGER NOT NULL,
        "type" TEXT NOT NULL,
        "department_id" INTEGER DEFAULT NULL,
        "prefix" VARCHAR(20) NOT NULL,
        "digit_count" INTEGER NOT NULL DEFAULT 8,
        "current_number" INTEGER NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
        await connection.query('CREATE INDEX IF NOT EXISTS "idx_numseq_org" ON "number_sequences" ("organization_id")');
        await connection.query('CREATE INDEX IF NOT EXISTS "idx_numseq_type" ON "number_sequences" ("type")');
        await connection.query('CREATE INDEX IF NOT EXISTS "idx_numseq_dept" ON "number_sequences" ("department_id")');
        console.log('  ✅ Table `number_sequences` verified/created');
        // 2. Table: project_numbers
        await connection.query(`
      CREATE TABLE IF NOT EXISTS "project_numbers" (
        "id" SERIAL PRIMARY KEY,
        "organization_id" INTEGER NOT NULL,
        "project_number" VARCHAR(50) NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT DEFAULT NULL,
        "department" VARCHAR(255) DEFAULT NULL,
        "status" TEXT NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
        await connection.query('CREATE INDEX IF NOT EXISTS "idx_projnum_org" ON "project_numbers" ("organization_id")');
        console.log('  ✅ Table `project_numbers` verified/created');
        // Check department column on project_numbers
        const projColNames = await getColumns(connection, 'project_numbers');
        if (!projColNames.has('department')) {
            await connection.query('ALTER TABLE "project_numbers" ADD COLUMN "department" VARCHAR(255) DEFAULT NULL');
            console.log('  ✅ Added `department` column to `project_numbers`');
        }
        // 3. Table: cost_center_numbers
        await connection.query(`
      CREATE TABLE IF NOT EXISTS "cost_center_numbers" (
        "id" SERIAL PRIMARY KEY,
        "organization_id" INTEGER NOT NULL,
        "cost_number" VARCHAR(50) NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "department" VARCHAR(255) DEFAULT NULL,
        "status" TEXT NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
        await connection.query('CREATE INDEX IF NOT EXISTS "idx_costnum_org" ON "cost_center_numbers" ("organization_id")');
        console.log('  ✅ Table `cost_center_numbers` verified/created');
        // 4. Ensure columns on documents table
        const existingCols = await getColumns(connection, 'documents');
        if (!existingCols.has('document_number')) {
            await connection.query('ALTER TABLE "documents" ADD COLUMN "document_number" VARCHAR(50) DEFAULT NULL');
            console.log('  ✅ Added `document_number` column to `documents`');
        }
        if (!existingCols.has('project_number')) {
            await connection.query('ALTER TABLE "documents" ADD COLUMN "project_number" VARCHAR(50) DEFAULT NULL');
            console.log('  ✅ Added `project_number` column to `documents`');
        }
        if (!existingCols.has('cost_center_number')) {
            await connection.query('ALTER TABLE "documents" ADD COLUMN "cost_center_number" VARCHAR(50) DEFAULT NULL');
            console.log('  ✅ Added `cost_center_number` column to `documents`');
        }
        if (!existingCols.has('department')) {
            await connection.query('ALTER TABLE "documents" ADD COLUMN "department" VARCHAR(255) DEFAULT NULL');
            console.log('  ✅ Added `department` column to `documents`');
        }
        // Add index on document_number for fast lookups if not exists
        const { rows: indexes } = await connection.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'documents' AND indexname = 'idx_documents_doc_number'");
        if (indexes.length === 0) {
            await connection.query('CREATE INDEX "idx_documents_doc_number" ON "documents" ("document_number")');
            console.log('  ✅ Added index `idx_documents_doc_number` on `documents`');
        }
        console.log('✅ Numbering system migration completed successfully');
    }
    catch (err) {
        console.error('❌ Notice during numbering migration:', err.message);
    }
    finally {
        if (isPool && connection)
            connection.release();
    }
}
