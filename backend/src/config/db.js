require("dotenv").config();
const mysql = require("mysql2/promise");

// Helper function to auto-create database if it doesn't exist
async function ensureDatabaseExists() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 3306,
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
    await connection.end();
  } catch (err) {
    console.error("Warning: Could not check/create database automatically:", err.message);
  }
}

ensureDatabaseExists();

// SSL/TLS Configuration for remote database environments (SEC-DB-09)
function getSslConfig() {
  if (process.env.DB_SSL_ENABLED === "true" || process.env.DB_SSL === "true") {
    const sslConfig = {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
    };
    if (process.env.DB_SSL_CA) {
      const fs = require("fs");
      try {
        if (fs.existsSync(process.env.DB_SSL_CA)) {
          sslConfig.ca = fs.readFileSync(process.env.DB_SSL_CA, "utf8");
        } else {
          sslConfig.ca = process.env.DB_SSL_CA;
        }
      } catch (e) {
        console.warn("Notice loading DB_SSL_CA:", e.message);
      }
    }
    return sslConfig;
  }
  return undefined;
}

// Create a MySQL connection pool with least-privilege user support (SEC-DB-01) and TLS support (SEC-DB-09)
const poolConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_APP_USER || process.env.DB_USER,
  password: process.env.DB_APP_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const ssl = getSslConfig();
if (ssl) {
  poolConfig.ssl = ssl;
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;

