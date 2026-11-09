/* Build the PostgreSQL schema from the live MySQL custom_docx schema.
 * Reads MySQL information_schema and issues CREATE TABLE IF NOT EXISTS +
 * CREATE INDEX IF NOT EXISTS into PostgreSQL. No data is copied here.
 * Idempotent: safe to re-run. Foreign keys are intentionally NOT copied
 * (the app enforces relations in code); primary keys and UNIQUE
 * constraints ARE copied because the app uses them in ON CONFLICT targets.
 */
const mysql = require('mysql2/promise');
const { Client } = require('pg');

const MYSQL = { host: 'localhost', user: 'root', password: 'neahys', database: 'custom_docx' };
const PG_URL = process.env.DATABASE_URL
  || 'postgresql://watermelon:Wmelon_PG_2026_local@localhost:5432/watermelon';

function qid(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function pgDefault(col) {
  const d = col.COLUMN_DEFAULT;
  if (d === null || d === undefined) return '';
  const t = String(d);
  if (/^CURRENT_TIMESTAMP/i.test(t)) return ' DEFAULT CURRENT_TIMESTAMP';
  if (/^-?\d+(\.\d+)?$/.test(t)) return ' DEFAULT ' + t;
  return " DEFAULT '" + t.replace(/'/g, "''") + "'";
}

function pgType(col) {
  const dt = String(col.DATA_TYPE).toLowerCase();
  const ct = String(col.COLUMN_TYPE).toLowerCase();
  const m = ct.match(/\((\d+)(,(\d+))?\)/);
  if (dt === 'tinyint' && m && m[1] === '1') return 'BOOLEAN';
  switch (dt) {
    case 'tinyint':
    case 'smallint':
    case 'mediumint':
    case 'year':
      return dt === 'smallint' ? 'SMALLINT' : 'SMALLINT';
    case 'int':
    case 'integer':
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'decimal':
    case 'numeric':
    case 'fixed':
      return m ? `NUMERIC(${m[1]}${m[3] ? ',' + m[3] : ''})` : 'NUMERIC';
    case 'float':
      return 'REAL';
    case 'double':
      return 'DOUBLE PRECISION';
    case 'char':
      return m ? `CHAR(${m[1]})` : 'CHAR(1)';
    case 'varchar':
      return m ? `VARCHAR(${m[1]})` : 'TEXT';
    case 'tinytext':
    case 'text':
    case 'mediumtext':
    case 'longtext':
      return 'TEXT';
    case 'date':
      return 'DATE';
    case 'time':
      return 'TIME';
    case 'datetime':
    case 'timestamp':
      return 'TIMESTAMP';
    case 'json':
      return 'JSONB';
    case 'enum':
    case 'set':
      return 'TEXT';
    default:
      if (dt.includes('blob') || dt.includes('binary') || dt === 'bit') return 'BYTEA';
      return 'TEXT';
  }
}

(async () => {
  const my = await mysql.createConnection(MYSQL);
  const pg = new Client({ connectionString: PG_URL });
  await pg.connect();
  const [tables] = await my.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='custom_docx' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
  let created = 0;
  for (const { TABLE_NAME: t } of tables) {
    const [cols] = await my.query(
      'SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION',
      ['custom_docx', t]);
    const [stats] = await my.query(
      'SELECT NON_UNIQUE, INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY INDEX_NAME, SEQ_IN_INDEX',
      ['custom_docx', t]);
    const pkCols = stats.filter(s => s.INDEX_NAME === 'PRIMARY').map(s => s.COLUMN_NAME);
    const uniq = {};
    for (const s of stats) {
      if (s.INDEX_NAME === 'PRIMARY' || s.NON_UNIQUE !== 0) continue;
      (uniq[s.INDEX_NAME] = uniq[s.INDEX_NAME] || []).push(s.COLUMN_NAME);
    }
    const plainIdx = stats.filter(s => s.NON_UNIQUE !== 0);
    const aiPk = cols.find(c => c.COLUMN_KEY === 'PRI' && String(c.EXTRA).includes('auto_increment')
      && pkCols.length === 1 && ['int', 'bigint'].includes(String(c.DATA_TYPE).toLowerCase()));
    const defs = cols.map(c => {
      if (aiPk && c.COLUMN_NAME === aiPk.COLUMN_NAME) {
        return `  ${qid(c.COLUMN_NAME)} ${String(c.DATA_TYPE).toLowerCase() === 'bigint' ? 'BIGSERIAL' : 'SERIAL'} PRIMARY KEY`;
      }
      let d = `  ${qid(c.COLUMN_NAME)} ${pgType(c)}`;
      // tinyint(1) booleans: normalize numeric defaults
      if (pgType(c) === 'BOOLEAN' && c.COLUMN_DEFAULT !== null && c.COLUMN_DEFAULT !== undefined) {
        d += (/^1$/.test(String(c.COLUMN_DEFAULT)) ? ' DEFAULT TRUE' : ' DEFAULT FALSE');
      } else {
        d += pgDefault(c);
      }
      d += c.IS_NULLABLE === 'NO' ? ' NOT NULL' : ' NULL';
      return d;
    });
    if (!aiPk && pkCols.length > 0) defs.push(`  PRIMARY KEY (${pkCols.map(qid).join(', ')})`);
    for (const [name, ucols] of Object.entries(uniq)) {
      defs.push(`  CONSTRAINT ${qid('uq_imp_' + name)} UNIQUE (${ucols.map(qid).join(', ')})`);
    }
    await pg.query(`CREATE TABLE IF NOT EXISTS ${qid(t)} (\n${defs.join(',\n')}\n)`);
    created++;
    const seenIdx = new Set();
    for (const s of plainIdx) {
      if (seenIdx.has(s.INDEX_NAME)) continue;
      seenIdx.add(s.INDEX_NAME);
      const icols = stats.filter(x => x.INDEX_NAME === s.INDEX_NAME).map(x => x.COLUMN_NAME);
      await pg.query(`CREATE INDEX IF NOT EXISTS ${qid(s.INDEX_NAME)} ON ${qid(t)} (${icols.map(qid).join(', ')})`);
    }
    console.log(`schema ok: ${t} (${cols.length} cols)`);
  }
  console.log(`DONE tables=${created}`);
  await pg.end();
  await my.end();
})().catch(e => { console.error('SCHEMA FAIL: ' + e.message); process.exit(1); });
