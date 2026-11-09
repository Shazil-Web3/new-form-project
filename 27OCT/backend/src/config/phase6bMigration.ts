/**
 * Phase 6B - Database Security Remediation Migration
 * Idempotent, self-healing migration to implement:
 * 1. SEC-DB-02: Index on refresh_tokens(token_hash)
 * 2. SEC-DB-03: Composite index on attachments(association_type, association_id)
 * 3. SEC-DB-04: Unique constraint on documentpermissions(document_id, user_id) with pre-deduplication
 * 4. SEC-DB-05: Index, Unique key, and FK for invited_users(organization_id, email)
 * 5. SEC-DB-06: Foreign keys referencing organizations(id) on organizationfolders, template_categories, departments, sites
 * 6. SEC-DB-07: Ensure auxiliary tables (attachments, task_comments, user_pins, editor_references) exist with proper schema
 */

async function indexNames(connection: any, table: string): Promise<Set<string>> {
  const { rows } = await connection.query(
    "SELECT indexname AS \"Key_name\" FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1",
    [table]
  );
  return new Set(rows.map((i: any) => i.Key_name));
}

async function indexDefs(connection: any, table: string): Promise<any[]> {
  const { rows } = await connection.query(
    "SELECT indexname AS \"Key_name\", indexdef AS \"Column_name\" FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1",
    [table]
  );
  return rows;
}

async function fkExists(connection: any, table: string, column: string, refTable: string): Promise<boolean> {
  const { rows } = await connection.query(
    `SELECT c.conname AS "CONSTRAINT_NAME" FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE t.relname = $1 AND a.attname = $2 AND c.contype = 'f'
       AND pg_get_constraintdef(c.oid) LIKE '%' || $3 || '%'`,
    [table, column, refTable]
  );
  return rows.length > 0;
}

export async function runPhase6bMigration(poolOrConnection: any) {
  console.log('🔄 Running Phase 6B Database Security Migrations...');
  // NOTE: pg.Client also exposes .connect(), so only pool (whose connect()
  // checks out a releasable client) counts as a pool here. A Client passed in
  // is already connected and must be used directly.
  const isPool = typeof poolOrConnection.connect === 'function'
    && typeof poolOrConnection.query === 'function'
    && poolOrConnection.constructor
    && poolOrConnection.constructor.name === 'Pool';
  const connection = isPool ? await poolOrConnection.connect() : poolOrConnection;

  try {
    // =========================================================================
    // 1. Auxiliary Tables Verification (SEC-DB-07)
    // =========================================================================

    // 1.1 attachments table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS "attachments" (
        "id" SERIAL PRIMARY KEY,
        "association_type" TEXT NOT NULL,
        "association_id" VARCHAR(255) NOT NULL,
        "file_name" VARCHAR(255) NOT NULL,
        "file_path" TEXT NOT NULL,
        "file_type" VARCHAR(100) NOT NULL,
        "file_size" INTEGER DEFAULT 0,
        "uploaded_by" INTEGER NOT NULL,
        "uploaded_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 1.2 task_comments table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS "task_comments" (
        "id" SERIAL PRIMARY KEY,
        "task_id" INTEGER NOT NULL,
        "user_id" INTEGER NOT NULL,
        "message" TEXT NOT NULL,
        "parent_id" INTEGER DEFAULT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_task_comments_task" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_task_comments_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);
    await connection.query('CREATE INDEX IF NOT EXISTS "task_comments_task_id" ON "task_comments" ("task_id")');
    await connection.query('CREATE INDEX IF NOT EXISTS "task_comments_user_id" ON "task_comments" ("user_id")');

    // 1.3 user_pins table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS "user_pins" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "item_type" VARCHAR(32) NOT NULL,
        "item_id" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE ("user_id", "item_type", "item_id"),
        CONSTRAINT "fk_user_pins_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);
    await connection.query('CREATE INDEX IF NOT EXISTS "user_pins_user_id" ON "user_pins" ("user_id")');

    // 1.4 editor_references table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS "editor_references" (
        "id" SERIAL PRIMARY KEY,
        "association_type" VARCHAR(50) NOT NULL,
        "association_id" VARCHAR(255) NOT NULL,
        "ref_index" INTEGER NOT NULL,
        "ref_text" TEXT NOT NULL,
        "ref_anchor" VARCHAR(100) NOT NULL,
        "created_by" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_editor_references_user" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE CASCADE
      );
    `);
    await connection.query('CREATE INDEX IF NOT EXISTS "editor_references_created_by" ON "editor_references" ("created_by")');

    // =========================================================================
    // 2. SEC-DB-02: Refresh Token Index (refresh_tokens.token_hash)
    // =========================================================================
    const rtIndexNames = await indexNames(connection, 'refresh_tokens');
    if (!rtIndexNames.has('idx_refresh_token_hash')) {
      try {
        await connection.query('CREATE INDEX "idx_refresh_token_hash" ON "refresh_tokens" ("token_hash")');
        console.log('  ✅ Added index idx_refresh_token_hash on refresh_tokens(token_hash)');
      } catch (err: any) {
        console.warn('  ⚠️ Notice adding idx_refresh_token_hash:', err.message);
      }
    }

    // =========================================================================
    // 3. SEC-DB-03: Attachment Association Index (attachments)
    // =========================================================================
    const attIndexNames = await indexNames(connection, 'attachments');
    if (!attIndexNames.has('idx_attachments_association')) {
      try {
        await connection.query('CREATE INDEX "idx_attachments_association" ON "attachments" ("association_type", "association_id")');
        console.log('  ✅ Added composite index idx_attachments_association on attachments(association_type, association_id)');
      } catch (err: any) {
        console.warn('  ⚠️ Notice adding idx_attachments_association:', err.message);
      }
    }

    // =========================================================================
    // 4. SEC-DB-04: Document Permissions Uniqueness (documentpermissions)
    // =========================================================================
    // 4.1 Safe Deduplication: Identify superseded duplicate (document_id, user_id) pairs
    const { rows: dupPerms } = await connection.query(`
      SELECT document_id, user_id, COUNT(*) as count
      FROM "documentpermissions"
      GROUP BY document_id, user_id
      HAVING count(*) > 1
    `);

    if (dupPerms.length > 0) {
      console.log(`  ℹ️ Found ${dupPerms.length} duplicate (document_id, user_id) pairs in documentpermissions. Cleaning superseded rows...`);
      for (const pair of dupPerms) {
        // Fetch all rows for this pair ordered by status ('active' first) and id DESC (most recent first)
        const { rows: rows2 } = await connection.query(`
          SELECT id, status, permission_type, assigned_at
          FROM "documentpermissions"
          WHERE document_id = $1 AND user_id = $2
          ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END ASC, id DESC
        `, [pair.document_id, pair.user_id]);

        if (rows2.length > 1) {
          const keepId = rows2[0].id;
          const deleteIds = rows2.slice(1).map((r: any) => r.id);
          await connection.query(
            `DELETE FROM "documentpermissions" WHERE id IN (${deleteIds.map((_: any, i: number) => `$${i + 1}`).join(',')})`,
            deleteIds
          );
          console.log(`    - Retained latest permission ID ${keepId} (${rows2[0].permission_type}, ${rows2[0].status}) for Doc ${pair.document_id} / User ${pair.user_id}, purged ${deleteIds.length} superseded row(s).`);
        }
      }
    }

    // 4.2 Add unique constraint
    const dpIndexNames = await indexNames(connection, 'documentpermissions');
    if (!dpIndexNames.has('uniq_doc_user_perm')) {
      try {
        await connection.query('ALTER TABLE "documentpermissions" ADD CONSTRAINT "uniq_doc_user_perm" UNIQUE ("document_id", "user_id")');
        console.log('  ✅ Added unique constraint uniq_doc_user_perm on documentpermissions(document_id, user_id)');
      } catch (err: any) {
        console.warn('  ⚠️ Notice adding uniq_doc_user_perm:', err.message);
      }
    }

    // =========================================================================
    // 5. SEC-DB-05: Invited Users Integrity (invited_users)
    // =========================================================================
    // 5.1 Deduplicate any duplicate (organization_id, email) rows if present
    const { rows: dupInvites } = await connection.query(`
      SELECT organization_id, email, COUNT(*) as count
      FROM "invited_users"
      GROUP BY organization_id, email
      HAVING count(*) > 1
    `);
    if (dupInvites.length > 0) {
      for (const pair of dupInvites) {
        const { rows: rows3 } = await connection.query(`
          SELECT id FROM "invited_users"
          WHERE organization_id = $1 AND email = $2
          ORDER BY id DESC
        `, [pair.organization_id, pair.email]);
        const deleteIds = rows3.slice(1).map((r: any) => r.id);
        if (deleteIds.length > 0) {
          await connection.query(
            `DELETE FROM "invited_users" WHERE id IN (${deleteIds.map((_: any, i: number) => `$${i + 1}`).join(',')})`,
            deleteIds
          );
        }
      }
    }

    const invIndexNames = await indexNames(connection, 'invited_users');

    // 5.2 Add index on organization_id
    if (!invIndexNames.has('idx_invited_users_org') && !invIndexNames.has('organization_id')) {
      try {
        await connection.query('CREATE INDEX "idx_invited_users_org" ON "invited_users" ("organization_id")');
        console.log('  ✅ Added index idx_invited_users_org on invited_users(organization_id)');
      } catch (err: any) {
        console.warn('  ⚠️ Notice adding idx_invited_users_org:', err.message);
      }
    }

    // 5.3 Add unique constraint on (organization_id, email)
    if (!invIndexNames.has('uniq_org_email_invite')) {
      try {
        await connection.query('ALTER TABLE "invited_users" ADD CONSTRAINT "uniq_org_email_invite" UNIQUE ("organization_id", "email")');
        console.log('  ✅ Added unique constraint uniq_org_email_invite on invited_users(organization_id, email)');
      } catch (err: any) {
        console.warn('  ⚠️ Notice adding uniq_org_email_invite:', err.message);
      }
    }

    // 5.4 Add foreign key to organizations(id)
    if (!(await fkExists(connection, 'invited_users', 'organization_id', 'organizations'))) {
      try {
        await connection.query(`
          ALTER TABLE "invited_users"
          ADD CONSTRAINT "fk_invited_users_org"
          FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE
        `);
        console.log('  ✅ Added foreign key fk_invited_users_org on invited_users -> organizations(id)');
      } catch (err: any) {
        console.warn('  ⚠️ Notice adding fk_invited_users_org:', err.message);
      }
    }

    // =========================================================================
    // 6. SEC-DB-06: Organization Foreign Keys on Secondary Tables
    // =========================================================================

    // 6.1 organizationfolders -> organizations(id)
    if (!(await fkExists(connection, 'organizationfolders', 'organization_id', 'organizations'))) {
      try {
        // Add index on organization_id if missing
        const ofIdxs = await indexDefs(connection, 'organizationfolders');
        if (!ofIdxs.some((i) => (i.Column_name || '').includes('organization_id'))) {
          await connection.query('CREATE INDEX "idx_orgfolders_org" ON "organizationfolders" ("organization_id")');
        }
        await connection.query(`
          ALTER TABLE "organizationfolders"
          ADD CONSTRAINT "fk_orgfolders_org"
          FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE
        `);
        console.log('  ✅ Added foreign key fk_orgfolders_org on organizationfolders -> organizations(id)');
      } catch (err: any) {
        console.warn('  ⚠️ Notice adding fk_orgfolders_org:', err.message);
      }
    }

    // 6.2 template_categories -> organizations(id)
    if (!(await fkExists(connection, 'template_categories', 'organization_id', 'organizations'))) {
      try {
        const tcIdxs = await indexDefs(connection, 'template_categories');
        if (!tcIdxs.some((i) => (i.Column_name || '').includes('organization_id'))) {
          await connection.query('CREATE INDEX "idx_template_categories_org" ON "template_categories" ("organization_id")');
        }
        await connection.query(`
          ALTER TABLE "template_categories"
          ADD CONSTRAINT "fk_tempcat_org"
          FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE
        `);
        console.log('  ✅ Added foreign key fk_tempcat_org on template_categories -> organizations(id)');
      } catch (err: any) {
        console.warn('  ⚠️ Notice adding fk_tempcat_org:', err.message);
      }
    }

    // 6.3 departments -> organizations(id)
    if (!(await fkExists(connection, 'departments', 'organization_id', 'organizations'))) {
      try {
        const deptIdxs = await indexDefs(connection, 'departments');
        if (!deptIdxs.some((i) => (i.Column_name || '').includes('organization_id'))) {
          await connection.query('CREATE INDEX "idx_departments_org" ON "departments" ("organization_id")');
        }
        await connection.query(`
          ALTER TABLE "departments"
          ADD CONSTRAINT "fk_departments_org"
          FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE
        `);
        console.log('  ✅ Added foreign key fk_departments_org on departments -> organizations(id)');
      } catch (err: any) {
        console.warn('  ⚠️ Notice adding fk_departments_org:', err.message);
      }
    }

    // 6.4 sites -> organizations(id)
    if (!(await fkExists(connection, 'sites', 'organization_id', 'organizations'))) {
      try {
        await connection.query(`
          ALTER TABLE "sites"
          ADD CONSTRAINT "fk_sites_org"
          FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE
        `);
        console.log('  ✅ Added foreign key fk_sites_org on sites -> organizations(id)');
      } catch (err: any) {
        console.warn('  ⚠️ Notice adding fk_sites_org:', err.message);
      }
    }

    console.log('🚀 Phase 6B Database Security Migrations completed successfully.');
  } finally {
    if (isPool && connection) {
      connection.release();
    }
  }
}
