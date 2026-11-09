const mysql = require('mysql2/promise');
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MYSQL = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'custom_docx'
};

const PG_URL = process.env.DATABASE_URL;

const BATCH = 250;
const qid = (n) => '"' + String(n).replace(/"/g, '""') + '"';
const mid = (n) => '`' + String(n).replace(/`/g, '``') + '`';

function mapValue(v, isBool, isJson) {
  if (v === null || v === undefined) return null;
  if (isBool) return Number(v) ? true : false;
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Date) return v;
  if (isJson) {
    if (typeof v === 'string') {
      try {
        JSON.parse(v);
        return v;
      } catch (_) {
        return JSON.stringify(v);
      }
    }
    return JSON.stringify(v);
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

async function run() {
  console.log('Connecting to MySQL and PostgreSQL...');
  const my = await mysql.createConnection(MYSQL);
  const pg = new Client({ connectionString: PG_URL });
  await pg.connect();
  console.log('Connected to both databases successfully!');

  // 1. Ensure required PG tables exist
  console.log('\n--- Step 1: Ensuring required PG tables exist ---');
  await pg.query(`
    CREATE TABLE IF NOT EXISTS taskassignments (
      id SERIAL PRIMARY KEY,
      task_id INT NOT NULL,
      assigned_to INT NOT NULL,
      assigned_by INT NOT NULL,
      assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL,
      status VARCHAR(50) DEFAULT 'pending'
    )
  `);
  console.log('  Checked/created taskassignments');

  // 2. Add missing columns to PG tables so schemas match MySQL data
  console.log('\n--- Step 2: Adding missing columns in PG ---');
  const schemaAdditions = [
    { table: 'organizations', column: 'settings', type: 'TEXT' },
    { table: 'users', column: 'password', type: 'VARCHAR(255)' },
    { table: 'documents', column: 'related_document_ids', type: 'JSONB' },
    { table: 'templates', column: 'logo', type: 'TEXT' },
    { table: 'templates', column: 'header_text', type: 'TEXT' },
    { table: 'templates', column: 'footer_text', type: 'TEXT' },
    { table: 'templates', column: 'required_approvers', type: 'TEXT' },
    { table: 'templates', column: 'related_document_ids', type: 'JSONB' },
    { table: 'gantt_projects', column: 'start_date', type: 'DATE' },
    { table: 'gantt_projects', column: 'end_date', type: 'DATE' },
    { table: 'invited_users', column: 'message', type: 'TEXT' },
    { table: 'invited_users', column: 'password_hash', type: 'VARCHAR(255)' },
    { table: 'invited_users', column: 'first_name', type: 'VARCHAR(255)' },
    { table: 'invited_users', column: 'last_name', type: 'VARCHAR(255)' },
    { table: 'sites', column: 'status', type: 'VARCHAR(50) DEFAULT \'active\'' },
    { table: 'template_categories', column: 'category_id', type: 'INTEGER' },
    { table: 'template_categories', column: 'category_name', type: 'VARCHAR(255)' },
    { table: 'template_categories', column: 'category_prefix', type: 'VARCHAR(50)' },
    { table: 'template_categories', column: 'folder_path', type: 'TEXT' },
    { table: 'template_categories', column: 'parent_category_id', type: 'INTEGER' }
  ];

  for (const { table, column, type } of schemaAdditions) {
    try {
      await pg.query(`ALTER TABLE ${qid(table)} ADD COLUMN IF NOT EXISTS ${qid(column)} ${type}`);
    } catch (e) {
      console.log(`  Note on ${table}.${column}: ${e.message}`);
    }
  }

  // Relax constraints that could block valid data
  try {
    await pg.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL`);
  } catch (e) {}
  try {
    await pg.query(`ALTER TABLE templates ALTER COLUMN title DROP NOT NULL`);
    await pg.query(`ALTER TABLE templates ALTER COLUMN title SET DEFAULT 'Untitled Template'`);
  } catch (e) {}
  try {
    await pg.query(`ALTER TABLE tasks ALTER COLUMN user_id DROP NOT NULL`);
  } catch (e) {}
  try {
    await pg.query(`ALTER TABLE invited_users ALTER COLUMN invited_by DROP NOT NULL`);
    await pg.query(`ALTER TABLE invited_users ALTER COLUMN invited_by SET DEFAULT 1`);
  } catch (e) {}

  // 3. Get all MySQL tables
  const [tables] = await my.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='custom_docx' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME"
  );
  let tableNames = tables.map(t => t.TABLE_NAME);

  const { rows: pgTableRows } = await pg.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
  );
  const existingPgTables = new Set(pgTableRows.map(r => r.table_name));

  tableNames = tableNames.filter(t => existingPgTables.has(t) || t === 'documentreferences');

  const priorityOrder = ['organizations', 'users', 'sites', 'departments', 'documents', 'templates', 'tasks', 'taskassignments'];
  tableNames.sort((a, b) => {
    const idxA = priorityOrder.indexOf(a);
    const idxB = priorityOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  console.log(`\n--- Step 3: Migrating tables in dependency order (${tableNames.length} tables) ---`);

  // Disable triggers / foreign key checks during import for safety
  await pg.query('SET session_replication_role = replica');

  for (const t of tableNames) {
    const targetTable = (t === 'documentreferences' && !existingPgTables.has(t) && existingPgTables.has('document_references'))
      ? 'document_references'
      : t;

    if (!existingPgTables.has(targetTable)) {
      console.log(`Skipping ${t} (no target table in PG)`);
      continue;
    }

    const { rows: pgCols } = await pg.query(
      'SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=$1',
      [targetTable]
    );
    const pgColMap = new Map(pgCols.map(c => [c.column_name, c.data_type]));

    const [rows] = await my.query(`SELECT * FROM ${mid(t)}`);
    if (rows.length === 0) {
      console.log(`  Table ${targetTable}: 0 rows in MySQL, skipped`);
      continue;
    }

    // Apply special mappings for rows
    if (targetTable === 'templates') {
      for (const row of rows) {
        if (!row.template_id) row.template_id = row.id;
        if (!row.id) row.id = row.template_id;
        const finalTitle = (row.title && String(row.title).trim()) || (row.name && String(row.name).trim()) || 'Untitled Template';
        row.title = finalTitle;
        row.name = finalTitle;
      }
    } else if (targetTable === 'users') {
      for (const row of rows) {
        if (!row.password && row.password_hash) row.password = row.password_hash;
        if (!row.full_name) row.full_name = `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email;
        if (!row.username && row.email) row.username = row.email.split('@')[0];
        if (row.is_admin === undefined) row.is_admin = (row.role === 'admin');
        if (row.is_active === undefined) row.is_active = (row.status === 'active');
      }
    } else if (targetTable === 'tasks') {
      for (const row of rows) {
        if (!row.user_id && row.created_by) row.user_id = row.created_by;
      }
    } else if (targetTable === 'invited_users') {
      for (const row of rows) {
        if (!row.invited_by) row.invited_by = 1;
      }
    } else if (targetTable === 'template_categories') {
      for (const row of rows) {
        if (!row.id && row.category_id) row.id = row.category_id;
        if (!row.name && row.category_name) row.name = row.category_name;
      }
    }

    // Determine union of all keys across rows that exist in PG
    const colNameSet = new Set();
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (pgColMap.has(k)) colNameSet.add(k);
      }
    }
    const colNames = Array.from(colNameSet);

    const boolCols = new Set(colNames.filter(c => pgColMap.get(c) === 'boolean'));
    const jsonCols = new Set(colNames.filter(c => pgColMap.get(c) === 'jsonb' || pgColMap.get(c) === 'json'));

    // Truncate PG table
    await pg.query(`TRUNCATE ${qid(targetTable)} CASCADE`);

    // Insert rows in chunks
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const vals = [];
      const params = [];
      chunk.forEach((row, ri) => {
        const base = ri * colNames.length;
        vals.push(`(${colNames.map((_, ci) => `$${base + ci + 1}`).join(', ')})`);
        for (const cn of colNames) {
          params.push(mapValue(row[cn], boolCols.has(cn), jsonCols.has(cn)));
        }
      });

      await pg.query(
        `INSERT INTO ${qid(targetTable)} (${colNames.map(qid).join(', ')}) VALUES ${vals.join(', ')}`,
        params
      );
    }

    const { rows: pgc } = await pg.query(`SELECT COUNT(*)::int AS n FROM ${qid(targetTable)}`);
    console.log(`  ✅ ${targetTable}: ${rows.length} rows migrated (PG count: ${pgc[0].n})`);
  }

  // Re-enable triggers and foreign keys
  await pg.query('SET session_replication_role = DEFAULT');

  // 4. Ensure admin@test.com exists alongside the migrated users
  console.log('\n--- Step 4: Ensuring admin@test.com test user exists ---');
  const adminTestHash = await bcrypt.hash('Admin123!', 10);
  await pg.query(`
    INSERT INTO users (
      organization_id, email, password, password_hash,
      full_name, first_name, last_name, username,
      is_admin, status, is_active, created_at, updated_at
    ) VALUES (
      1, 'admin@test.com', $1, $1,
      'Test Admin', 'Test', 'Admin', 'admin',
      true, 'active', true, NOW(), NOW()
    ) ON CONFLICT (email) DO UPDATE SET password_hash = $1, password = $1, status = 'active'
  `, [adminTestHash]);
  console.log('  ✅ admin@test.com verified with password Admin123!');

  // Also make sure admin123@gmail.com has a working password (Admin123!) so both passwords work if desired
  const admin123Hash = await bcrypt.hash('Admin123!', 10);
  await pg.query(`
    UPDATE users SET password_hash = $1, password = $1 WHERE email = 'admin123@gmail.com'
  `, [admin123Hash]);
  console.log('  ✅ admin123@gmail.com password updated to Admin123!');

  // 5. Populate user_roles for all users based on their legacy role
  console.log('\n--- Step 5: Assigning RBAC user_roles ---');
  const { rows: allUsers } = await pg.query('SELECT id, email, role FROM users');
  const { rows: allRoles } = await pg.query('SELECT id, role_key FROM roles');
  const roleKeyToId = new Map(allRoles.map(r => [r.role_key, r.id]));

  for (const u of allUsers) {
    let targetKey = 'view_only';
    const roleStr = String(u.role || '').toLowerCase();
    if (roleStr === 'admin' || u.email === 'admin@test.com' || u.email === 'admin123@gmail.com') {
      targetKey = (u.email === 'admin@test.com' || u.email === 'admin123@gmail.com' || u.role === 'admin') ? 'super_admin' : 'org_admin';
    } else if (roleStr === 'reviewer' || roleStr === 'approver') {
      targetKey = 'review_approval';
    } else if (roleStr === 'author') {
      targetKey = 'author';
    } else if (roleStr === 'project_manager') {
      targetKey = 'project_manager';
    } else if (roleStr === 'people_manager') {
      targetKey = 'people_manager';
    }

    const rId = roleKeyToId.get(targetKey);
    if (rId) {
      await pg.query(`
        INSERT INTO user_roles (user_id, role_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT DO NOTHING
      `, [u.id, rId]);
    }
  }
  console.log(`  ✅ Assigned RBAC roles for ${allUsers.length} users`);

  // 6. Reset all SERIAL sequences in PG
  console.log('\n--- Step 6: Resetting sequences ---');
  const serials = await pg.query(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_default LIKE 'nextval%'"
  );
  for (const s of serials.rows) {
    try {
      await pg.query(
        `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX(${qid(s.column_name)}) FROM ${qid(s.table_name)}), 1))`,
        [s.table_name, s.column_name]
      );
    } catch (e) {
      // Ignore
    }
  }
  console.log(`  ✅ Reset ${serials.rows.length} sequences`);

  await pg.end();
  await my.end();
  console.log('\n🎉 ALL DONE! Migration completed successfully!');
}

run().catch(e => {
  console.error('\n❌ MIGRATION FAILED:', e);
  process.exit(1);
});
