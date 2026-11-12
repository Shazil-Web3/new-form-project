import dotenv from "dotenv";
import path from "path";
dotenv.config();
if (!process.env.ACCESS_SECRET) {
  dotenv.config({ path: path.join(__dirname, '../.env') });
}
if (!process.env.ACCESS_SECRET) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}
import express from "express";
import http from "http";
import cors from "cors";
import pool from "./config/db";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import CryptoJS from "crypto-js";
import bcrypt from "bcrypt";
import jsonwebtoken from "jsonwebtoken";
const jwt: any = jsonwebtoken;
import nodemailer from "nodemailer";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Module Registrars (Folders)
import registerAuthRoutes from "./auth";
import registerTemplateRoutes from "./templates";
import registerDocumentRoutes from "./documents";
import registerCollaboration from "./collaboration";
import registerReferenceRoutes from "./references";
import registerTrainingRoutes from "./training";
import { normalizeDocumentRowForClient } from "./documents/documentHelpers";
import { logAuditEvent } from "./config/auditLogger";
import { runAuditTrailMigration } from "./config/auditMigration";
import { runPhase6bMigration } from "./config/phase6bMigration";
import { runNumberingMigration } from "./config/numberingMigration";
import { runDeduplicationMigration } from "./config/deduplicationMigration";
import { cleanStaleWorkflowApprovers } from "./config/workflowMigration";
import { runGanttMigration } from "./config/ganttMigration";
import { runLmsMigration } from "./config/lmsMigration";
import { runRelatedDocumentsMigration } from "./config/relatedDocumentsMigration";
import { runRbacMigration } from "./rbac/rbacMigration";
import registerRbacRoutes from "./rbac/rbacRoutes";
import {
  canAccess,
  classifyRequest,
  getEffectiveAccess,
  getEffectiveRole,
  isOrganizationMismatch
} from "./access/accessControl";


// Ensure local uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory at:', uploadsDir);
}

// Multer storage configuration for direct binary uploads
import multer from "multer";
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${uniqueId}-${safeName}`);
  }
});

// Banned executable & script extensions for defense-in-depth upload security
const BANNED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.scr', '.msi', '.sh', '.bash', '.ps1',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.pif', '.hta', '.cpl',
  '.jar', '.bin', '.dll', '.so', '.dylib', '.command', '.app'
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (BANNED_EXTENSIONS.has(ext)) {
    const err: any = new Error(`File type ${ext} is not allowed for security reasons.`);
    err.status = 400;
    return cb(err);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Database schema initialization
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id SERIAL PRIMARY KEY,
        association_type TEXT NOT NULL,
        association_id VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size INT DEFAULT 0,
        uploaded_by INT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Attachments database table is ready');

    // Run safe startup migrations
    await runAuditTrailMigration(pool).catch(e => console.log('Audit trail notice:', e.message));
    await runPhase6bMigration(pool).catch(e => console.log('Phase 6B notice:', e.message));
    await runNumberingMigration(pool).catch(e => console.log('Numbering notice:', e.message));
    await runDeduplicationMigration(pool).catch(e => console.log('Deduplication notice:', e.message));
    await cleanStaleWorkflowApprovers(pool).catch(e => console.log('Workflow notice:', e.message));
    await runRelatedDocumentsMigration(pool).catch(e => console.log('Related documents notice:', e.message));
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
};
const databaseInitialization = initDb();

function safeJsonStringify(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    try {
      JSON.parse(val);
      return val; // It is already a valid JSON string
    } catch (e) {
      return JSON.stringify(val); // Wrap it as a valid JSON string
    }
  }
  return JSON.stringify(val); // Objects, arrays, numbers, booleans
}

const decodeBase64File = (fileData) => {
  if (!fileData) return Buffer.alloc(0);
  let base64String = fileData;
  if (fileData.includes(';base64,')) {
    base64String = fileData.split(';base64,')[1];
  } else if (fileData.includes(',')) {
    base64String = fileData.split(',')[1];
  }
  return Buffer.from(base64String, 'base64');
};

// Strict fail-closed verification of required secrets on startup
const REQUIRED_SECRETS = ['ACCESS_SECRET', 'REFRESH_SECRET', 'ENCRYPTION_KEY'];
for (const secretName of REQUIRED_SECRETS) {
  if (!process.env[secretName] || !String(process.env[secretName]).trim()) {
    console.error(`FATAL: Required environment variable "${secretName}" is missing or empty. Server exiting.`);
    process.exit(1);
  }
}

import crypto from "crypto";
import {
  authLimiter,
  passwordVerifyLimiter,
  refreshLimiter,
  inviteLimiter,
  aiLimiter,
  uploadLimiter,
  exportLimiter
} from "./config/rateLimiter";

import compression from "compression";

// Centralized Token Lifecycle Configuration
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes for real access tokens
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const JWT_ISSUER = 'custom-docx-api';
const JWT_AUDIENCE = 'custom-docx-app';
const DUMMY_BCRYPT_HASH = '$2b$10$e7f093n98e7fnwef098wenf098w7ef098we7f098we7f098w7e';

// Phase 8B: Dynamic Multi-Origin CORS & Socket.IO Resolver
const DEV_DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173'
];

function getAllowedOrigins() {
  const configured = [];
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach((o) => {
      const trimmed = o.trim();
      if (trimmed) configured.push(trimmed);
    });
  }
  const singleClient = process.env.CLIENT_URL || process.env.FRONTEND_URL || process.env.FRONTENDURL;
  if (singleClient && !configured.includes(singleClient.trim())) {
    configured.push(singleClient.trim());
  }
  if (configured.length === 0) {
    configured.push('http://localhost:3000');
  }
  return configured;
}

const allowedOriginsList = getAllowedOrigins();

function isOriginAllowed(origin) {
  if (!origin) return true; // Allow non-browser, server-to-server, or same-origin requests
  const normalizedOrigin = origin.replace(/\/+$/, '');
  // In development/test mode, always allow standard local dev origins
  if (process.env.NODE_ENV !== 'production') {
    if (DEV_DEFAULT_ORIGINS.includes(normalizedOrigin)) {
      return true;
    }
  }
  return allowedOriginsList.some((allowed) => allowed.replace(/\/+$/, '') === normalizedOrigin);
}

const app = express();
const server = http.createServer(app);

// Phase 8B: Graceful Shutdown State
let isShuttingDown = false;
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.setHeader('Connection', 'close');
    return res.status(503).json({ error: 'Server is shutting down, please try again shortly.' });
  }
  next();
});

// Phase 8B: Configurable Trust Proxy
if (process.env.TRUST_PROXY !== undefined) {
  const tpVal = String(process.env.TRUST_PROXY).trim().toLowerCase();
  if (tpVal === 'true') {
    app.set('trust proxy', true);
  } else if (tpVal === 'false') {
    app.set('trust proxy', false);
  } else if (!isNaN(Number(process.env.TRUST_PROXY))) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY));
  } else if (process.env.TRUST_PROXY.trim()) {
    app.set('trust proxy', process.env.TRUST_PROXY.trim());
  }
}

// Phase 8B: Configure Socket.IO with dynamic origin resolver
const io: any = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy: Not allowed by Socket.IO origin resolver'));
      }
    },
    methods: ["GET", "POST"]
  }
});

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: http: https:; connect-src 'self' ws: wss: http: https:; frame-ancestors 'self';"
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Phase 8B: Response Compression Middleware
app.use(compression());

// Phase 8B: Dynamic Multi-Origin Express CORS
app.use(
  cors({
    origin: function (origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy: Not allowed by Access-Control-Allow-Origin'));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  })
);
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Create Nodemailer transporter with your SparkPost SMTP configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.sparkpostmail.com',
  port: 2525,
  secure: false, // STARTTLS encryption
  auth: {
    user: 'SMTP_Injection',
    pass: process.env.SPARKPOST_PASSWORD
  },
  // Enforce modern TLS (1.2+) for SMTP STARTTLS.
  tls: {
    minVersion: 'TLSv1.2'
  }
});

// Verify transporter configuration asynchronously without blocking event loop
setImmediate(() => {
  transporter.verify((error, success) => {
    if (error) {
      console.warn('SMTP configuration warning:', error.message);
    } else {
      console.log('SMTP server is ready to take our messages');
    }
  });
});

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

const dbOps = {
  // User Management
  async registerUser(
    orgId,
    email,
    password,
    firstName,
    lastName,
    role,
    department,
    template_approver,
    status = 'active',
    site = null,
    accessAssignment = null
  ) {
    const passwordHash = await bcrypt.hash(password, 10);
    // Temp View total window: base duration (1h/4h) plus extra hours (0-8).
    // totalHours is a server-validated integer, safe to interpolate.
    const totalHours = Number.isSafeInteger(accessAssignment?.totalHours)
      ? accessAssignment.totalHours
      : (accessAssignment?.expiresIn === '1h'
        ? 1
        : accessAssignment?.expiresIn === '4h' ? 4 : null);
    const expiresExpression = totalHours
      ? `NOW() + make_interval(hours => ${totalHours})`
      : 'NULL';
    const { rows: newUserRows } = await pool.query(
      `INSERT INTO users (
        organization_id, email, password_hash, first_name, last_name, role,
        department, template_approver, status, site, access_expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${expiresExpression}) RETURNING id`,
      [
        orgId, email, passwordHash, firstName, lastName, role || 'viewer',
        department || null, template_approver || 'no', status || 'active', site || null
      ]
    );
    if (accessAssignment?.roleKey) {
      const { rows: roleRows } = await pool.query(
        'SELECT id FROM roles WHERE role_key = $1',
        [accessAssignment.roleKey]
      );
      if (roleRows.length) {
        await pool.query(
          `INSERT INTO user_roles (user_id, role_id, expires_at)
           VALUES ($1, $2, ${expiresExpression}) ON CONFLICT DO NOTHING`,
          [(newUserRows[0] as any).id, roleRows[0].id]
        );
      }
    }
    return (newUserRows[0] as any).id;
  },

  async loginUser(email) {
    const { rows: users } = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, role, department, template_approver, organization_id, site FROM users WHERE email = $1 AND status = $2',
      [email, 'active']
    );
    return users[0];
  },

  async inviteUser(orgId, email, role, department, message, status, site = null) {
    const { rows: invitedRows } = await pool.query(
      'INSERT INTO invited_users (organization_id, email, role, department, message, status, site) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [orgId, email, role, department, message, status, site]
    );
    return (invitedRows[0] as any).id;
  },

  // Check if invitation exists
  async checkInvitation(token) {
    try {
      const decoded = jwt.verify(token, ENCRYPTION_KEY);

      const { rows: invitations } = await pool.query(
        "SELECT * FROM invited_users WHERE email = $1 AND status = 'invited'",
        [decoded.email]
      );

      if (invitations.length === 0) {
        return null;
      }

      return {
        ...invitations[0],
        ...decoded // Merge the decoded data from token
      };
    } catch (error) {
      console.error('Error checking invitation:', error);
      return null;
    }
  },

  async registerInvitedUser(orgId, email, password, firstName, lastName, role, department, status = null, site = null) {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update invitation status
    const { rows: result } = await pool.query(
      'UPDATE invited_users SET password_hash = $1, first_name = $2, last_name = $3, role = $4, department = $5, site = $6, status = $7 WHERE email = $8 AND organization_id = $9',
      [hashedPassword, firstName, lastName, role, department, site, 'pending', email, orgId]
    );
    return result;
  },

  async updateUserProfile(userId, data) {
    const { firstName, lastName, email, department, status, template_approver, site } = data;
    await pool.query(
      'UPDATE users SET first_name = $1, last_name = $2, email = $3, department = $4, status = $5, template_approver = $6, site = $7 WHERE id = $8',
      [firstName, lastName, email, department, status, template_approver, site || null, userId]
    );
  },

  async changeUserRole(userId, newRole) {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [newRole, userId]);
  },

  // Get Dashboard Data
  async listOrganizationUsers(userId) {
    const { rows: orgResults } = await pool.query(
      'SELECT organization_id FROM users WHERE id = $1 AND status = $2',
      [userId, 'active']
    );

    const orgId = orgResults[0].organization_id;
    const { rows: users } = await pool.query(
      `SELECT u.*,
              (SELECT r.name FROM user_roles ur
               JOIN roles r ON r.id = ur.role_id
               WHERE ur.user_id = u.id
                 AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
               ORDER BY r.is_system DESC, r.name LIMIT 1) AS rbac_role_name,
              (SELECT r.role_key FROM user_roles ur
               JOIN roles r ON r.id = ur.role_id
               WHERE ur.user_id = u.id
                 AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
               ORDER BY r.is_system DESC, r.name LIMIT 1) AS rbac_role_key
       FROM users u
       WHERE u.organization_id = $1 AND u.status != $2`,
      [orgId, 'inactive']
    );
    return users;
  },

  async listInvitedUsers(userId) {
    const { rows: orgResults } = await pool.query(
      'SELECT organization_id FROM users WHERE id = $1 AND status = $2',
      [userId, 'active']
    );

    const orgId = orgResults[0].organization_id;
    const { rows: users } = await pool.query(
      'SELECT * FROM invited_users WHERE organization_id = $1',
      [orgId]
    );
    return users;
  },

  async getAllDocuments() {
    const { rows: docs } = await pool.query(
      `SELECT d.document_id, d.organization_id, d.title, d.template_id, d.created_by,
              d.status, d.version, d.current_revision, d.revision_parent_id, d.created_at,
              d.updated_at, d.approvers, d.required_approvers, d.impact, d.notes,
              d.document_number, d.project_number, d.cost_center_number, d.department,
              concat_ws(' ', u.first_name, u.last_name) AS created_by_name,
              u.email AS created_by_email
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id`
    );
    return docs.map(doc => normalizeDocumentRowForClient(doc));
  },

  async getUserAccessibleDocuments(userId) {
    // IMPORTANT: Project metadata columns for high-performance dashboard & list rendering.
    // Avoid full-content blobs on list queries while preserving document structure.
    const { rows: userRows } = await pool.query(
      'SELECT id, organization_id, role, email FROM users WHERE id = $1',
      [userId]
    );
    const user = userRows[0];
    const orgId = user?.organization_id;
    const isAdmin = user?.role === 'admin';
    const userEmail = user?.email ? String(user.email).trim().toLowerCase() : null;

    let query = `
      SELECT d.document_id, d.organization_id, d.title, d.template_id, d.created_by,
              d.status, d.version, d.current_revision, d.revision_parent_id, d.created_at,
              d.updated_at, d.approvers, d.required_approvers, d.impact, d.notes, d.progress_value,
              d.document_number, d.project_number, d.cost_center_number, d.department,
              concat_ws(' ', u.first_name, u.last_name) AS created_by_name,
              u.email AS created_by_email,
              (SELECT dp.assigned_at FROM documentpermissions dp 
               WHERE dp.document_id = d.document_id AND dp.user_id = ? AND dp.status = 'active' 
               ORDER BY dp.assigned_at DESC LIMIT 1) AS received_at
      FROM documents d
      LEFT JOIN users u ON d.created_by = u.id
    `;
    let params = [];

    const approverParams = [
      `%"userId":${userId}%`,
      `%"userId":"${userId}"%`,
      `%"id":${userId}%`,
      `%"id":"${userId}"%`
    ];
    if (userEmail) {
      approverParams.push(`%"email":"${userEmail}"%`);
    }

    // Numbered ($n) LIKE placeholders for the approvers JSON-match clause.
    const approversClause = (startIdx: number): string => {
      const likes = approverParams.map((_, i) => `d.approvers LIKE $${startIdx + i}`);
      return `OR ( d.approvers IS NOT NULL AND ( ${likes.join(' OR ')} ) )`;
    };
    // $1 is the received_at user id in the base query above.
    query = query.replace('dp.user_id = ? AND dp.status', 'dp.user_id = $1 AND dp.status');
    if (isAdmin && orgId) {
      query += ` WHERE (d.organization_id = $2 OR d.created_by = $3 OR EXISTS (
        SELECT 1 FROM documentpermissions dp
        WHERE dp.document_id = d.document_id AND dp.user_id = $4 AND dp.status = 'active'
      ) ${approversClause(5)})`;
      params = [userId, orgId, userId, userId, ...approverParams];
    } else {
      query += ` WHERE (d.created_by = $2 OR EXISTS (
        SELECT 1 FROM documentpermissions dp
        WHERE dp.document_id = d.document_id AND dp.user_id = $3 AND dp.status = 'active'
      ) ${approversClause(4)})`;
      params = [userId, userId, userId, ...approverParams];
    }

    query += ` ORDER BY d.created_at DESC`;

    const { rows: docs } = await pool.query(query, params);
    return docs.map(doc => normalizeDocumentRowForClient(doc));
  },

  async getTasks(userId) {
    const { rows: tasks } = await pool.query(
      `SELECT t.* FROM tasks t JOIN taskassignments ta ON t.id = ta.task_id WHERE ta.assigned_to = $1 AND ta.status != 'completed'`,
      [userId]
    );
    return tasks;
  },

  async getTemplates(userId) {
    const { rows: templates } = await pool.query(
      `SELECT t.id, t.organization_id, t.name, t.description, t.category_id, t.created_by,
              t.created_at, t.updated_at, t.status, t.version, t.revision_parent_id,
              t.required_approvers, t.template_approvers, t.template_structure,
              t.custom_document_approvers, t.notes,
              concat_ws(' ', u2.first_name, u2.last_name) AS created_by_name,
              u2.email AS created_by_email
       FROM templates t 
       JOIN users u ON t.organization_id = u.organization_id 
       LEFT JOIN users u2 ON t.created_by = u2.id
       WHERE u.id = $1`,
      [userId]
    );

    return templates.map(template => {
      // Ensure JSON structure fields are parsed if stringified
      if (template.template_structure && typeof template.template_structure === 'string') {
        try { template.template_structure = JSON.parse(template.template_structure); } catch (e) {}
      }
      if (template.required_approvers && typeof template.required_approvers === 'string') {
        try { template.required_approvers = JSON.parse(template.required_approvers); } catch (e) {}
      }
      if (template.template_approvers && typeof template.template_approvers === 'string') {
        try { template.template_approvers = JSON.parse(template.template_approvers); } catch (e) {}
      }
      if (template.template_approvers && typeof template.template_approvers === 'object') {
        const reviewers = Array.isArray(template.template_approvers.reviewers) ? template.template_approvers.reviewers : [];
        const approvers = Array.isArray(template.template_approvers.approvers) ? template.template_approvers.approvers : [];
        const matched = [...reviewers, ...approvers].find(p => String(p.userId || p.id) === String(userId));
        if (matched && (matched.received_at || matched.assigned_at)) {
          template.received_at = matched.received_at || matched.assigned_at;
        }
      }
      return template;
    });
  },

  async getEvents(userId) {
    const { rows: events } = await pool.query(
      `SELECT e.* FROM events e JOIN eventparticipants ep ON e.id = ep.event_id WHERE ep.user_id = $1 AND e.status = 'scheduled' AND e.end_time > NOW() ORDER BY e.start_time ASC`,
      [userId]
    );
    return events;
  },

  // Document Management
  async createDocument(data) {
    const { orgId, templateId, title, content, elements, createdBy, status = 'draft', coverPageData } = data;
    const docId = uuidv4();
    await pool.query(
      'INSERT INTO documents (document_id, organization_id, template_id, title, content, elements, current_revision, created_by, status, cover_page_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [docId, orgId, templateId, title, JSON.stringify(content || {}), JSON.stringify(elements || {}), 1.0, createdBy, status, JSON.stringify(coverPageData || {})]
    );
    return docId;
  },

  async updateDocumentStatus(docId, status) {
    await pool.query(
      'UPDATE documents SET status = $1, updated_at = NOW() WHERE document_id = $2',
      [status, docId]
    );
  },

  async getDocumentById(docId) {
    const { rows: docs } = await pool.query(
      `SELECT d.*, u.email AS created_by_email, u.email AS author_email,
              concat_ws(' ', u.first_name, u.last_name) AS created_by_name
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.document_id = $1`,
      [docId]
    );
    return docs[0];
  },

  async searchDocuments(searchTerm) {
    const { rows: docs } = await pool.query(
      'SELECT document_id, title, status FROM documents WHERE title LIKE $1 OR content LIKE $2',
      [`%${searchTerm}%`, `%${searchTerm}%`]
    );
    return docs;
  },


  async getDocumentRevisionHistory(docId) {
    const { rows: revisions } = await pool.query(
      'SELECT dr.revision_number, dr.created_at, u.first_name, u.last_name FROM documentrevisions dr JOIN users u ON dr.created_by = u.id WHERE dr.document_id = $1 ORDER BY dr.revision_number DESC',
      [docId]
    );
    return revisions;
  },

  async createDocumentRevision(docId, revisionNumber, content, elements, createdBy, status = 'draft') {
    await pool.query(
      'INSERT INTO documentrevisions (document_id, revision_number, content, elements, created_by, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [docId, revisionNumber, JSON.stringify(content), JSON.stringify(elements), createdBy, status]
    );
  },

  // Document Permissions
  async addDocumentPermission(docId, userId, permissionType, assignedBy) {
    await pool.query(
      'INSERT INTO documentpermissions (document_id, user_id, permission_type, assigned_by, status) VALUES ($1, $2, $3, $4, $5)',
      [docId, userId, permissionType, assignedBy, 'active']
    );
  },

  async requestDocumentAccess(docId, requestedBy, permissionType) {
    await pool.query(
      'INSERT INTO accessrequests (document_id, requested_by, requested_permission_type, status) VALUES ($1, $2, $3, $4)',
      [docId, requestedBy, permissionType, 'pending']
    );
  },

  async getPendingAccessRequests(docId) {
    const { rows: requests } = await pool.query(
      'SELECT ar.id, ar.requested_by, ar.requested_permission_type, u.first_name, u.last_name, u.email FROM accessrequests ar JOIN users u ON ar.requested_by = u.id WHERE ar.document_id = $1 AND ar.status = $2',
      [docId, 'pending']
    );
    return requests;
  },

  async approveAccessRequest(requestId, resolvedBy) {
    const client: any = await pool.connect();
    try {
      await client.query("BEGIN");

      // Update request status
      await client.query(
        'UPDATE accessrequests SET status = $1, resolved_by = $2, resolved_at = NOW() WHERE id = $3',
        ['approved', resolvedBy, requestId]
      );

      // Get request details
      const { rows: requests } = await client.query(
        'SELECT document_id, requested_by, requested_permission_type, resolved_by FROM accessrequests WHERE id = $1',
        [requestId]
      );
      const request = requests[0];

      // Create permission
      await client.query(
        'INSERT INTO documentpermissions (document_id, user_id, permission_type, assigned_by, status) VALUES ($1, $2, $3, $4, $5)',
        [request.document_id, request.requested_by, request.requested_permission_type, request.resolved_by, 'active']
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  // Template Management

  // Review Management
  async setupReviewStage(docId, stageOrder, stageType, isMandatory = true) {
    const { rows: stageRows } = await pool.query(
      'INSERT INTO reviewstages (document_id, stage_order, stage_type, is_mandatory) VALUES ($1, $2, $3, $4) RETURNING id',
      [docId, stageOrder, stageType, isMandatory ? 1 : 0]
    );
    return (stageRows[0] as any).id;
  },

  async assignReviewer(stageId, userId, isMandatory = true) {
    await pool.query(
      'INSERT INTO reviewassignments (review_stage_id, user_id, is_mandatory) VALUES ($1, $2, $3)',
      [stageId, userId, isMandatory ? 1 : 0]
    );
  },

  async getPendingReviews(userId) {
    const { rows: reviews } = await pool.query(
      'SELECT d.document_id, d.title, rs.id AS review_stage_id FROM documents d JOIN reviewstages rs ON d.document_id = rs.document_id JOIN reviewassignments ra ON rs.id = ra.review_stage_id WHERE ra.user_id = $1 AND ra.status = $2',
      [userId, 'pending']
    );
    return reviews;
  },

  // Task Management
  async createTask(orgId, documentId, title, description, dueDate, priority, createdBy) {
    const { rows: taskRows } = await pool.query(
      'INSERT INTO tasks (organization_id, document_id, title, description, due_date, priority, created_by, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [orgId, documentId || null, title, description, dueDate, priority, createdBy, 'not_started']
    );
    return (taskRows[0] as any).id;
  },

  async assignTask(taskId, assignedTo, assignedBy) {
    await pool.query(
      'INSERT INTO taskassignments (task_id, assigned_to, assigned_by, status) VALUES ($1, $2, $3, $4)',
      [taskId, assignedTo, assignedBy, 'pending']
    );
  },

  async completeTask(taskId, userId) {
    await pool.query(
      'UPDATE taskassignments SET status = $1, completed_at = NOW() WHERE task_id = $2 AND assigned_to = $3',
      ['completed', taskId, userId]
    );

    await pool.query(`
      UPDATE tasks t
      SET status = 
        CASE
          WHEN (SELECT COUNT(*) FROM taskassignments WHERE task_id = t.id) = 
               (SELECT COUNT(*) FROM taskassignments WHERE task_id = t.id AND status = 'completed')
          THEN 'completed'
          WHEN (SELECT COUNT(*) FROM taskassignments WHERE task_id = t.id AND status = 'in_progress') > 0
          THEN 'in_progress'
          ELSE t.status
        END
      WHERE id = $1`,
      [taskId]
    );
  },

  // Event Management
  async createEvent(orgId, title, description, startTime, endTime, createdBy) {
    const { rows: eventRows } = await pool.query(
      'INSERT INTO events (organization_id, title, description, start_time, end_time, created_by, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [orgId, title, description, startTime, endTime, createdBy, 'scheduled']
    );
    return (eventRows[0] as any).id;
  },

  async addEventParticipant(eventId, userId) {
    await pool.query(
      'INSERT INTO eventparticipants (event_id, user_id, status) VALUES ($1, $2, $3)',
      [eventId, userId, 'invited']
    );
  },

  async acceptEventInvitation(eventId, userId) {
    await pool.query(
      'UPDATE eventparticipants SET status = $1 WHERE event_id = $2 AND user_id = $3',
      ['accepted', eventId, userId]
    );
  },

  async linkDocumentsToEvent(eventId, docId) {
    await pool.query(
      'INSERT INTO eventdocuments (event_id, document_id) VALUES ($1, $2)',
      [eventId, docId]
    );
  },

  // Notes and Comments
  async addNote(userId, docId, content, isPrivate = false) {
    const { rows: noteRows } = await pool.query(
      'INSERT INTO notes (user_id, document_id, content, is_private) VALUES ($1, $2, $3, $4) RETURNING id',
      [userId, docId, content, isPrivate ? 1 : 0]
    );
    return (noteRows[0] as any).id;
  },

  async shareNote(noteId, recipientId) {
    await pool.query(
      'INSERT INTO noterecipients (note_id, recipient_id, status) VALUES ($1, $2, $3)',
      [noteId, recipientId, 'delivered']
    );
  },

  async markNoteAsRead(noteId, recipientId) {
    await pool.query(
      'UPDATE noterecipients SET status = $1, read_at = NOW() WHERE note_id = $2 AND recipient_id = $3',
      ['read', noteId, recipientId]
    );
  },

  // Organization Management
  async createOrganization(name, settings = {}) {
    const { rows: orgRows } = await pool.query(
      'INSERT INTO organizations (name, settings) VALUES ($1, $2) RETURNING id',
      [name, JSON.stringify(settings)]
    );
    return (orgRows[0] as any).id;
  },

  async updateOrganizationSettings(orgId, settings) {
    await pool.query(
      'UPDATE organizations SET settings = $1 WHERE id = $2',
      [JSON.stringify(settings), orgId]
    );
  },

  // Audit Trail
  async addAuditRecord(orgId, userId, actionType, docId, details, ipAddress, userAgent = null, status = 'success') {
    await logAuditEvent(pool, {
      orgId,
      userId,
      actionType,
      documentId: docId,
      resourceType: 'document',
      resourceId: docId,
      details,
      ipAddress,
      userAgent,
      status
    });
  },

  async getDocumentAuditTrail(docId) {
    const { rows: records } = await pool.query(
      "SELECT a.action_type, a.details, a.created_at, a.status, COALESCE(a.user_name, concat(u.first_name, ' ', u.last_name)) as full_name, COALESCE(a.user_email, u.email) as email FROM audittrail a LEFT JOIN users u ON a.user_id = u.id WHERE (a.document_id = $1 OR (a.resource_type = 'document' AND a.resource_id = $2)) ORDER BY a.created_at DESC",
      [docId, docId]
    );
    return records;
  }
};


// Middlewares


function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET, {
      algorithms: ['HS256']
    });

    const targetUserId = decoded.userId || decoded.sub;
    if (!targetUserId) {
      return res.status(401).json({ error: 'Invalid token claims' });
    }

    // Server-side account state and token_version enforcement
    const { rows: users } = await pool.query(
      'SELECT id, email, organization_id, role, status, token_version FROM users WHERE id = $1',
      [targetUserId]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'User not found or session revoked', code: 'USER_NOT_FOUND' });
    }

    const user = users[0];

    if (user.status !== 'active') {
      return res.status(401).json({ error: 'Account is deactivated or inactive', code: 'ACCOUNT_INACTIVE' });
    }

    // Check token_version if present in token
    if (decoded.token_version !== undefined && Number(decoded.token_version) !== Number(user.token_version)) {
      return res.status(401).json({ error: 'Session invalidated, please log in again', code: 'TOKEN_VERSION_STALE' });
    }

    let effectiveRole = user.role;
    let effectiveUserId = user.id;
    let effectiveEmail = user.email;
    if (process.env.NODE_ENV !== 'production') {
      if (req.headers['x-mock-role']) {
        effectiveRole = String(req.headers['x-mock-role']).trim().toLowerCase();
      }
      if (req.headers['x-mock-user-id']) {
        effectiveUserId = Number(req.headers['x-mock-user-id']) || user.id;
      }
      if (req.headers['x-mock-email']) {
        effectiveEmail = String(req.headers['x-mock-email']).trim().toLowerCase();
      }
    }

    const access = await getEffectiveAccess(pool, {
      ...user,
      role: effectiveRole,
      ignoreAccessLevelAssignment: process.env.NODE_ENV !== 'production' && Boolean(req.headers['x-mock-role'])
    });
    if (access.expired) {
      return res.status(403).json({
        error: 'Access has expired. Contact a super admin for a new assignment.',
        code: 'ACCESS_EXPIRED'
      });
    }

    const authenticatedUser = {
      userId: effectiveUserId,
      id: effectiveUserId,
      email: effectiveEmail,
      organization_id: user.organization_id,
      orgId: user.organization_id,
      role: getEffectiveRole(effectiveRole, access.accessLevel?.key, access.isSuperAdmin),
      legacyRole: effectiveRole,
      token_version: user.token_version,
      accessLevel: access.accessLevel,
      permissions: access.permissions,
      accessExpiresAt: access.expiresAt,
      isSuperAdmin: access.isSuperAdmin
    };

    if (isOrganizationMismatch(req, authenticatedUser)) {
      return res.status(403).json({ error: 'Access denied: organization mismatch' });
    }

    // Self-service RBAC and user reads only need a valid, active session (checked above).
    const isSelfRead = req.method === 'GET' &&
      (req.path === '/api/rbac/me' || req.path === '/api/rbac/check' || req.path === '/api/users/me');
    const requiredPermission = classifyRequest(req);
    const isAdminAccessLevels = (authenticatedUser.role === 'admin' || authenticatedUser.legacyRole === 'admin') &&
      requiredPermission.feature === 'access_levels';
    if (!isSelfRead && !authenticatedUser.isSuperAdmin && !isAdminAccessLevels &&
      !canAccess(authenticatedUser.permissions, requiredPermission.feature, requiredPermission.action)) {
      return res.status(403).json({
        error: 'Access denied: permission required',
        code: 'PERMISSION_REQUIRED',
        requiredPermission: `${requiredPermission.feature}.${requiredPermission.action}`
      });
    }

    req.user = authenticatedUser;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Create invitation link with encrypted data
const generateInvitationToken = (data) => {
  // Only include necessary fields and set expiration
  const tokenData = {
    email: data.email,
    role: data.role,
    department: data.department,
    site: data.site,
    orgId: data.orgId,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days expiration
  };

  return jwt.sign(tokenData, ENCRYPTION_KEY, { algorithm: 'HS256' });
};

// ==================== HELPER FUNCTIONS ====================

// Helper function to calculate folder path
async function calculateFolderPath(categoryId, parentCategoryId, connection) {
  const db = connection || pool;

  if (!parentCategoryId) {
    return categoryId.toString();
  }

  const query = `
    SELECT folder_path FROM template_categories
    WHERE category_id = $1
  `;

  const { rows: results } = await db.query(query, [parentCategoryId]);

  if (results.length === 0 || !results[0].folder_path) {
    return categoryId.toString();
  }

  return `${results[0].folder_path}/${categoryId}`;
}

// Helper function to build folder path for a category
function buildFolderPath(category, allCategories) {
  if (!category.parent_category_id) {
    return category.category_id.toString();
  }

  const parentIds = [];
  let currentCategory = category;

  // Build path by traversing up the hierarchy
  while (currentCategory.parent_category_id) {
    parentIds.unshift(currentCategory.category_id);
    const nextParent = allCategories.find(c => c.category_id === currentCategory.parent_category_id);
    if (!nextParent) break;
    currentCategory = nextParent;
  }

  // Add the root parent
  parentIds.unshift(currentCategory.category_id);

  return parentIds.join('/');
}

// Check for circular references
async function checkCircularReference(categoryId, parentId) {
  // Get all ancestors of the potential parent
  const ancestors = await getCategoryAncestors(parentId);
  // If the category ID is in the ancestors, it would create a circular reference
  return ancestors.some(ancestor => ancestor.category_id.toString() === categoryId.toString());
}

// Get all ancestors of a category
async function getCategoryAncestors(categoryId) {
  const ancestors = [];
  let currentId = categoryId;

  while (currentId) {
    const query = `
      SELECT parent_category_id FROM template_categories
      WHERE category_id = $1
    `;

    const { rows: results } = await pool.query(query, [currentId]);

    if (results.length === 0 || !results[0].parent_category_id) {
      break;
    }

    currentId = results[0].parent_category_id;
    ancestors.push({ category_id: currentId });
  }

  return ancestors;
}

// Update paths of all child categories when a parent's path changes
async function updateChildrenPaths(parentId, connection) {
  const db = connection || pool;

  // Get direct children
  const childrenQuery = `
    SELECT category_id, parent_category_id FROM template_categories
    WHERE parent_category_id = $1
  `;

  const { rows: children } = await db.query(childrenQuery, [parentId]);

  for (const child of children) {
    // Calculate new path for this child
    const newPath = await calculateFolderPath(child.category_id, child.parent_category_id, db);

    // Update the child's path
    const updateQuery = `
      UPDATE template_categories
      SET folder_path = $1
      WHERE category_id = $2
    `;

    await db.query(updateQuery, [newPath, child.category_id]);

    // Recursively update all descendants
    await updateChildrenPaths(child.category_id, db);
  }
}

// ==================== REGISTER MODULES ====================

// 1. Auth Module
registerAuthRoutes({
  app,
  pool,
  authenticateToken,
  dbOps,
  transporter,
  generateInvitationToken,
  upload,
  uploadsDir,
  calculateFolderPath,
  buildFolderPath,
  checkCircularReference,
  getCategoryAncestors,
  updateChildrenPaths,
  bcrypt,
  jwt,
  uuidv4,
  fs,
  path,
  CryptoJS,
  ENCRYPTION_KEY,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS,
  JWT_ISSUER,
  JWT_AUDIENCE,
  DUMMY_BCRYPT_HASH,
  authLimiter,
  passwordVerifyLimiter,
  refreshLimiter,
  inviteLimiter,
  aiLimiter,
  uploadLimiter,
  logAuditEvent
});

// 2. Templates Module
registerTemplateRoutes({
  app,
  pool,
  authenticateToken,
  dbOps,
  io,
  safeJsonStringify,
  GoogleGenerativeAI,
  uuidv4,
  fs,
  path,
  aiLimiter,
  logAuditEvent,
  uploadsDir
});

// 3. Documents Module
registerDocumentRoutes({
  app,
  pool,
  authenticateToken,
  dbOps,
  io,
  safeJsonStringify,
  uploadsDir,
  uuidv4,
  fs,
  path,
  uploadLimiter,
  exportLimiter,
  logAuditEvent
});

// 4. Real-time Socket.IO Collaboration
registerCollaboration({ io, pool });

// 5. References Module
registerReferenceRoutes({ app, pool, authenticateToken, logAuditEvent });

// 6. RBAC (roles / permissions / user_roles)
registerRbacRoutes({ app, pool, authenticateToken, logAuditEvent });

// 7. Training / LMS Module
registerTrainingRoutes({
  app,
  pool,
  authenticateToken,
  dbOps,
  transporter,
  generateInvitationToken,
  upload,
  uploadsDir,
  fs,
  path,
  logAuditEvent,
});

// ==================== GLOBAL ERROR HANDLER ====================
// Centralized Express Global JSON Error Handler
app.use((err, req, res, next) => {
  console.error('🚨 [GlobalErrorHandler] Error caught:', err.message || err);

  // Handle JSON parse errors from express.json()
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON payload format'
    });
  }

  // Handle Multer file size / upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File size exceeds the 100MB limit. Please upload a file smaller than 100MB.'
    });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: `Upload error: ${err.message}`
    });
  }

  const statusCode = (err.status && typeof err.status === 'number' && err.status >= 400 && err.status < 600)
    ? err.status
    : (err.statusCode && typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600)
      ? err.statusCode
      : 500;

  const safeMessage = statusCode === 500
    ? 'Internal server error'
    : (err.message || 'An error occurred processing your request');

  res.status(statusCode).json({
    error: safeMessage
  });
});

// ==================== STARTUP MIGRATIONS & SERVER ====================

// Run startup database migrations
async function runMigrations() {
  try {
    const client: any = await pool.connect();
    try {
      // 1. Check if custom_document_approvers exists in templates table
      try {
        const { rows: columns } = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'custom_document_approvers'");
        if (columns.length === 0) {
          await client.query('ALTER TABLE templates ADD COLUMN custom_document_approvers TEXT DEFAULT NULL');
          console.log('✅ Successfully added custom_document_approvers column to templates table');
        }
      } catch (err) {
        console.warn('Notice checking templates.custom_document_approvers:', err.message);
      }

      // 2. Sanitize template_approver on users table if it has invalid duplicate '' enum definition
      try {
        await client.query("ALTER TABLE users ALTER COLUMN template_approver SET DEFAULT 'no'");
        console.log('✅ Sanitized users.template_approver column definition');
      } catch (err) {
        // Ignored if table doesn't exist yet or already matching
      }

      // 3. Add token_version to users table if missing
      try {
        const { rows: uCols } = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'token_version'");
        if (uCols.length === 0) {
          await client.query('ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 1');
          console.log('✅ Successfully added token_version column to users table');
        }
      } catch (err) {
        console.warn('Notice checking users.token_version:', err.message);
      }

      // 4. Add last_login to users table if missing
      try {
        const { rows: llCols } = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_login'");
        if (llCols.length === 0) {
          await client.query('ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL');
          console.log('✅ Successfully added last_login column to users table');
        }
      } catch (err) {
        console.warn('Notice checking users.last_login:', err.message);
      }

      // 5. Add token_hash, revoked_at, replaced_by_hash to refresh_tokens table if missing
      try {
        const { rows: rtCols } = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'refresh_tokens' AND column_name = 'token_hash'");
        if (rtCols.length === 0) {
          await client.query('ALTER TABLE refresh_tokens ADD COLUMN token_hash VARCHAR(64) DEFAULT NULL, ADD COLUMN revoked_at TIMESTAMP NULL DEFAULT NULL, ADD COLUMN replaced_by_hash VARCHAR(64) DEFAULT NULL');
          console.log('✅ Successfully enhanced refresh_tokens schema with token_hash and revoked_at');
        }
      } catch (err) {
        console.warn('Notice checking refresh_tokens schema:', err.message);
      }

      // 6. Self-heal: ensure all author permissions are active
      try {
        await client.query("UPDATE documentpermissions SET status = 'active' WHERE permission_type = 'author'");
        console.log('✅ Self-healed active status for all author permissions');
      } catch (err) {
        // Ignored if table doesn't exist yet
      }

      // 7. Self-heal: ensure active documentpermissions exist for all pending workflow approvers and reviewers
      try {
        const { rows: pendingDocs } = await client.query(
          `SELECT document_id, created_by, approvers FROM documents 
           WHERE status IN ('pending_review', 'pending_approval', 'pending_archive_approval') 
             AND approvers IS NOT NULL`
        );
        for (const doc of pendingDocs) {
          if (!doc.approvers) continue;
          let wf = doc.approvers;
          if (typeof wf === 'string') {
            try { wf = JSON.parse(wf); } catch (_) { continue; }
          }
          const creatorId = doc.created_by;
          const syncList = async (list, pType) => {
            for (const u of list || []) {
              const uid = Number(u.userId ?? u.id);
              if (!uid || uid === Number(creatorId)) continue;
              await client.query(
                `INSERT INTO documentpermissions (document_id, user_id, permission_type, assigned_by, status)
                 VALUES ($1, $2, $3, $4, 'active')
                 ON CONFLICT (document_id, user_id) DO UPDATE SET permission_type = EXCLUDED.permission_type, status = 'active'`,
                [doc.document_id, uid, pType, creatorId]
              );
            }
          };
          await syncList(wf.reviewers, 'reviewer');
          await syncList(wf.approvers, 'approver');
        }
        console.log('✅ Self-healed active status for pending workflow reviewers and approvers');
      } catch (wfPermErr) {
        console.warn('Notice self-healing workflow permissions:', wfPermErr.message);
      }
    } finally {
      client.release();
    }

    // 7. Run Phase 3 Audit Trail Migration
    await runAuditTrailMigration(pool);

    // 8. Run Phase 6B Database Security Migration
    await runPhase6bMigration(pool);

    // 9. Run Numbering System Migration
    await runNumberingMigration(pool);

    // 10. Run Gantt / Calendar Schema Migration
    await runGanttMigration(pool);

    // 11. Run Training / LMS Module Migration
    await runLmsMigration(pool);

  } catch (err) {
    console.error('❌ Error running database migrations on startup:', err);
  }
}

// SEC-DB-08: Retention cleanup for expired/revoked refresh tokens older than 30 days
async function cleanupExpiredTokens() {
  try {
    const purged: any = await pool.query(`
      DELETE FROM refresh_tokens
      WHERE (expires_at < NOW() - make_interval(days => 30))
         OR (revoked_at IS NOT NULL AND revoked_at < NOW() - make_interval(days => 30))
    `);
    if (purged && purged.rowCount > 0) {
      console.log(`🧹 [Retention] Purged ${purged.rowCount} expired/revoked refresh token(s) older than 30 days`);
    }
  } catch (err) {
    console.warn('Notice during periodic token cleanup:', err.message);
  }
}

// Schedule token cleanup periodically every 24 hours
const tokenCleanupTimer = setInterval(cleanupExpiredTokens, 24 * 60 * 60 * 1000);
if (tokenCleanupTimer && tokenCleanupTimer.unref) {
  tokenCleanupTimer.unref();
}

const PORT = process.env.PORT || 5000;
runMigrations().then(async () => {
  await databaseInitialization;
  await runRbacMigration(pool);
  // Run initial token cleanup after migrations have ensured revoked_at column exists
  cleanupExpiredTokens();
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Startup migration error:', err);
  process.exit(1);
});

// Phase 8B: Graceful Process Shutdown Handler (SIGTERM & SIGINT)
let shutdownInProgress = false;
async function gracefulShutdown(signal) {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  isShuttingDown = true;
  console.log(`\n🛑 [Shutdown] Received ${signal}. Starting graceful shutdown...`);

  // Hard exit fallback timer (10 seconds) to prevent hanging during process manager stops
  const forceExitTimer = setTimeout(() => {
    console.error('🚨 [Shutdown] Forced shutdown due to 10s timeout.');
    process.exit(1);
  }, 10000);
  if (forceExitTimer.unref) forceExitTimer.unref();

  try {
    // 1. Stop accepting new HTTP connections and close server
    await new Promise<void>((resolve) => {
      server.close((err) => {
        if (err) console.warn('Notice closing HTTP server:', err.message);
        else console.log('✅ [Shutdown] HTTP server closed.');
        resolve();
      });
    });

    // 2. Disconnect Socket.IO active clients cleanly
    if (io) {
      await new Promise<void>((resolve) => {
        io.close(() => {
          console.log('✅ [Shutdown] Socket.IO server closed.');
          resolve();
        });
      });
    }

    // 3. Close database connection pool cleanly
    if (pool && typeof pool.end === 'function') {
      await pool.end();
      console.log('✅ [Shutdown] Database connection pool drained.');
    }

    console.log('🏁 [Shutdown] Graceful shutdown completed cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('🚨 [Shutdown] Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
