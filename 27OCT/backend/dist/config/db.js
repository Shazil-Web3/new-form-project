"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
if (!process.env.PG_DATABASE && !process.env.PG_HOST) {
    dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
}
const pg_1 = require("pg");
// Use individual connection parameters to avoid special character parsing issues
const pool = new pg_1.Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'watermelon',
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE || 'watermelon',
    max: 10,
});
exports.default = pool;
