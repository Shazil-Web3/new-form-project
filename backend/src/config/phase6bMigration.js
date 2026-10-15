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

async function runPhase6bMigration(poolOrConnection) {
  console.log('🔄 Running Phase 6B Database Security Migrations...');
  const isPool = typeof poolOrConnection.getConnection === 'function';
  const connection = isPool ? await poolOrConnection.getConnection() : poolOrConnection;

  try {
    // =========================================================================
    // 1. Auxiliary Tables Verification (SEC-DB-07)
    // =========================================================================
    
    // 1.1 attachments table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`attachments\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`association_type\` enum('template','document','temp') NOT NULL,
        \`association_id\` varchar(255) NOT NULL,
        \`file_name\` varchar(255) NOT NULL,
        \`file_path\` text NOT NULL,
        \`file_type\` varchar(100) NOT NULL,
        \`file_size\` int(11) DEFAULT 0,
        \`uploaded_by\` int(11) NOT NULL,
        \`uploaded_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // 1.2 task_comments table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`task_comments\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`task_id\` int(11) NOT NULL,
        \`user_id\` int(11) NOT NULL,
        \`message\` text NOT NULL,
        \`parent_id\` int(11) DEFAULT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`task_id\` (\`task_id\`),
        KEY \`user_id\` (\`user_id\`),
        CONSTRAINT \`fk_task_comments_task\` FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_task_comments_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // 1.3 user_pins table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`user_pins\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`user_id\` int(11) NOT NULL,
        \`item_type\` varchar(32) NOT NULL,
        \`item_id\` int(11) NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`unique_user_item\` (\`user_id\`, \`item_type\`, \`item_id\`),
        KEY \`user_id\` (\`user_id\`),
        CONSTRAINT \`fk_user_pins_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // 1.4 editor_references table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`editor_references\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`association_type\` varchar(50) NOT NULL,
        \`association_id\` varchar(255) NOT NULL,
        \`ref_index\` int(11) NOT NULL,
        \`ref_text\` text NOT NULL,
        \`ref_anchor\` varchar(100) NOT NULL,
        \`created_by\` int(11) NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`created_by\` (\`created_by\`),
        CONSTRAINT \`fk_editor_references_user\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    // =========================================================================
    // 2. SEC-DB-02: Refresh Token Index (refresh_tokens.token_hash)
    // =========================================================================
    const [rtIndexes] = await connection.query("SHOW INDEX FROM `refresh_tokens`");
    const rtIndexNames = new Set(rtIndexes.map(i => i.Key_name));
    if (!rtIndexNames.has('idx_refresh_token_hash')) {
      try {
        await connection.query("ALTER TABLE `refresh_tokens` ADD INDEX `idx_refresh_token_hash` (`token_hash`)");
        console.log('  ✅ Added index idx_refresh_token_hash on refresh_tokens(token_hash)');
      } catch (err) {
        console.warn('  ⚠️ Notice adding idx_refresh_token_hash:', err.message);
      }
    }

    // =========================================================================
    // 3. SEC-DB-03: Attachment Association Index (attachments)
    // =========================================================================
    const [attIndexes] = await connection.query("SHOW INDEX FROM `attachments`");
    const attIndexNames = new Set(attIndexes.map(i => i.Key_name));
    if (!attIndexNames.has('idx_attachments_association')) {
      try {
        await connection.query("ALTER TABLE `attachments` ADD INDEX `idx_attachments_association` (`association_type`, `association_id`)");
        console.log('  ✅ Added composite index idx_attachments_association on attachments(association_type, association_id)');
      } catch (err) {
        console.warn('  ⚠️ Notice adding idx_attachments_association:', err.message);
      }
    }

    // =========================================================================
    // 4. SEC-DB-04: Document Permissions Uniqueness (documentpermissions)
    // =========================================================================
    // 4.1 Safe Deduplication: Identify superseded duplicate (document_id, user_id) pairs
    const [dupPerms] = await connection.query(`
      SELECT document_id, user_id, COUNT(*) as count
      FROM \`documentpermissions\`
      GROUP BY document_id, user_id
      HAVING count > 1
    `);

    if (dupPerms.length > 0) {
      console.log(`  ℹ️ Found ${dupPerms.length} duplicate (document_id, user_id) pairs in documentpermissions. Cleaning superseded rows...`);
      for (const pair of dupPerms) {
        // Fetch all rows for this pair ordered by status ('active' first) and id DESC (most recent first)
        const [rows] = await connection.query(`
          SELECT id, status, permission_type, assigned_at
          FROM \`documentpermissions\`
          WHERE document_id = ? AND user_id = ?
          ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END ASC, id DESC
        `, [pair.document_id, pair.user_id]);

        if (rows.length > 1) {
          const keepId = rows[0].id;
          const deleteIds = rows.slice(1).map(r => r.id);
          await connection.query(
            `DELETE FROM \`documentpermissions\` WHERE id IN (${deleteIds.map(() => '?').join(',')})`,
            deleteIds
          );
          console.log(`    - Retained latest permission ID ${keepId} (${rows[0].permission_type}, ${rows[0].status}) for Doc ${pair.document_id} / User ${pair.user_id}, purged ${deleteIds.length} superseded row(s).`);
        }
      }
    }

    // 4.2 Add unique constraint
    const [dpIndexes] = await connection.query("SHOW INDEX FROM `documentpermissions`");
    const dpIndexNames = new Set(dpIndexes.map(i => i.Key_name));
    if (!dpIndexNames.has('uniq_doc_user_perm')) {
      try {
        await connection.query("ALTER TABLE \`documentpermissions\` ADD UNIQUE KEY \`uniq_doc_user_perm\` (\`document_id\`, \`user_id\`)");
        console.log('  ✅ Added unique constraint uniq_doc_user_perm on documentpermissions(document_id, user_id)');
      } catch (err) {
        console.warn('  ⚠️ Notice adding uniq_doc_user_perm:', err.message);
      }
    }

    // =========================================================================
    // 5. SEC-DB-05: Invited Users Integrity (invited_users)
    // =========================================================================
    // 5.1 Deduplicate any duplicate (organization_id, email) rows if present
    const [dupInvites] = await connection.query(`
      SELECT organization_id, email, COUNT(*) as count
      FROM \`invited_users\`
      GROUP BY organization_id, email
      HAVING count > 1
    `);
    if (dupInvites.length > 0) {
      for (const pair of dupInvites) {
        const [rows] = await connection.query(`
          SELECT id FROM \`invited_users\`
          WHERE organization_id = ? AND email = ?
          ORDER BY id DESC
        `, [pair.organization_id, pair.email]);
        const deleteIds = rows.slice(1).map(r => r.id);
        await connection.query(
          `DELETE FROM \`invited_users\` WHERE id IN (${deleteIds.map(() => '?').join(',')})`,
          deleteIds
        );
      }
    }

    const [invIndexes] = await connection.query("SHOW INDEX FROM `invited_users`");
    const invIndexNames = new Set(invIndexes.map(i => i.Key_name));

    // 5.2 Add index on organization_id
    if (!invIndexNames.has('idx_invited_users_org') && !invIndexNames.has('organization_id')) {
      try {
        await connection.query("ALTER TABLE \`invited_users\` ADD INDEX \`idx_invited_users_org\` (\`organization_id\`)");
        console.log('  ✅ Added index idx_invited_users_org on invited_users(organization_id)');
      } catch (err) {
        console.warn('  ⚠️ Notice adding idx_invited_users_org:', err.message);
      }
    }

    // 5.3 Add unique constraint on (organization_id, email)
    if (!invIndexNames.has('uniq_org_email_invite')) {
      try {
        await connection.query("ALTER TABLE \`invited_users\` ADD UNIQUE KEY \`uniq_org_email_invite\` (\`organization_id\`, \`email\`)");
        console.log('  ✅ Added unique constraint uniq_org_email_invite on invited_users(organization_id, email)');
      } catch (err) {
        console.warn('  ⚠️ Notice adding uniq_org_email_invite:', err.message);
      }
    }

    // 5.4 Add foreign key to organizations(id)
    const [invFks] = await connection.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invited_users' AND COLUMN_NAME = 'organization_id' AND REFERENCED_TABLE_NAME = 'organizations'
    `);
    if (invFks.length === 0) {
      try {
        await connection.query(`
          ALTER TABLE \`invited_users\`
          ADD CONSTRAINT \`fk_invited_users_org\`
          FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\` (\`id\`) ON DELETE CASCADE
        `);
        console.log('  ✅ Added foreign key fk_invited_users_org on invited_users -> organizations(id)');
      } catch (err) {
        console.warn('  ⚠️ Notice adding fk_invited_users_org:', err.message);
      }
    }

    // =========================================================================
    // 6. SEC-DB-06: Organization Foreign Keys on Secondary Tables
    // =========================================================================

    // 6.1 organizationfolders -> organizations(id)
    const [orgFolderFks] = await connection.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'organizationfolders' AND COLUMN_NAME = 'organization_id' AND REFERENCED_TABLE_NAME = 'organizations'
    `);
    if (orgFolderFks.length === 0) {
      try {
        // Add index on organization_id if missing
        const [ofIdxs] = await connection.query("SHOW INDEX FROM `organizationfolders`");
        if (!ofIdxs.some(i => i.Column_name === 'organization_id')) {
          await connection.query("ALTER TABLE `organizationfolders` ADD INDEX `idx_orgfolders_org` (`organization_id`)");
        }
        await connection.query(`
          ALTER TABLE \`organizationfolders\`
          ADD CONSTRAINT \`fk_orgfolders_org\`
          FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\` (\`id\`) ON DELETE CASCADE
        `);
        console.log('  ✅ Added foreign key fk_orgfolders_org on organizationfolders -> organizations(id)');
      } catch (err) {
        console.warn('  ⚠️ Notice adding fk_orgfolders_org:', err.message);
      }
    }

    // 6.2 template_categories -> organizations(id)
    const [tempCatFks] = await connection.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'template_categories' AND COLUMN_NAME = 'organization_id' AND REFERENCED_TABLE_NAME = 'organizations'
    `);
    if (tempCatFks.length === 0) {
      try {
        const [tcIdxs] = await connection.query("SHOW INDEX FROM `template_categories`");
        if (!tcIdxs.some(i => i.Column_name === 'organization_id')) {
          await connection.query("ALTER TABLE `template_categories` ADD INDEX `idx_template_categories_org` (`organization_id`)");
        }
        await connection.query(`
          ALTER TABLE \`template_categories\`
          ADD CONSTRAINT \`fk_tempcat_org\`
          FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\` (\`id\`) ON DELETE CASCADE
        `);
        console.log('  ✅ Added foreign key fk_tempcat_org on template_categories -> organizations(id)');
      } catch (err) {
        console.warn('  ⚠️ Notice adding fk_tempcat_org:', err.message);
      }
    }

    // 6.3 departments -> organizations(id)
    const [deptFks] = await connection.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'departments' AND COLUMN_NAME = 'organization_id' AND REFERENCED_TABLE_NAME = 'organizations'
    `);
    if (deptFks.length === 0) {
      try {
        const [deptIdxs] = await connection.query("SHOW INDEX FROM `departments`");
        if (!deptIdxs.some(i => i.Column_name === 'organization_id')) {
          await connection.query("ALTER TABLE `departments` ADD INDEX `idx_departments_org` (`organization_id`)");
        }
        await connection.query(`
          ALTER TABLE \`departments\`
          ADD CONSTRAINT \`fk_departments_org\`
          FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\` (\`id\`) ON DELETE CASCADE
        `);
        console.log('  ✅ Added foreign key fk_departments_org on departments -> organizations(id)');
      } catch (err) {
        console.warn('  ⚠️ Notice adding fk_departments_org:', err.message);
      }
    }

    // 6.4 sites -> organizations(id)
    const [siteFks] = await connection.query(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sites' AND COLUMN_NAME = 'organization_id' AND REFERENCED_TABLE_NAME = 'organizations'
    `);
    if (siteFks.length === 0) {
      try {
        await connection.query(`
          ALTER TABLE \`sites\`
          ADD CONSTRAINT \`fk_sites_org\`
          FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\` (\`id\`) ON DELETE CASCADE
        `);
        console.log('  ✅ Added foreign key fk_sites_org on sites -> organizations(id)');
      } catch (err) {
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

module.exports = { runPhase6bMigration };
