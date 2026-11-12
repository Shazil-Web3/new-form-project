import dotenv from "dotenv";
import path from "path";
dotenv.config();
if (!process.env.PG_DATABASE && !process.env.PG_HOST) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}
import { Pool } from "pg";

// Use individual connection parameters to avoid special character parsing issues
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  user: process.env.PG_USER || 'watermelon',
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE || 'watermelon',
  max: 10,
});

export default pool;
