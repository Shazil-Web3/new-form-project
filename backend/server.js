require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const pool = require('./config/db');
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const CryptoJS = require("crypto-js");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Module Registrars (Folders)
const registerAuthRoutes = require('./auth');
const registerTemplateRoutes = require('./templates');
const registerDocumentRoutes = require('./documents');
const registerCollaboration = require('./collaboration');
const registerReferenceRoutes = require('./references');
const registerTrainingRoutes = require('./training');
const { normalizeDocumentRowForClient } = require('./documents/documentHelpers');
const { logAuditEvent } = require('./config/auditLogger');
const { runAuditTrailMigration } = require('./config/auditMigration');
const { runPhase6bMigration } = require('./config/phase6bMigration');
const { runNumberingMigration } = require('./config/numberingMigration');
const { runDeduplicationMigration } = require('./config/deduplicationMigration');
const { cleanStaleWorkflowApprovers } = require('./config/workflowMigration');
const { runGanttMigration } = require('./config/ganttMigration');
const { runLmsMigration } = require('./config/lmsMigration');


// Ensure local uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory at:', uploadsDir);
}

// Multer storage configuration for direct binary uploads
const multer = require('multer');
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
    const err = new Error(`File type ${ext} is not allowed for security reasons.`);
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
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        association_type ENUM('template', 'document', 'temp') NOT NULL,
        association_id VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size INT DEFAULT 0,
        uploaded_by INT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log('✅ Attachments database table is ready');

    // Run safe startup migrations
    await runAuditTrailMigration(pool).catch(e => console.log('Audit trail notice:', e.message));
    await runPhase6bMigration(pool).catch(e => console.log('Phase 6B notice:', e.message));
    await runNumberingMigration(pool).catch(e => console.log('Numbering notice:', e.message));
    await runDeduplicationMigration(pool).catch(e => console.log('Deduplication notice:', e.message));
    await cleanStaleWorkflowApprovers(pool).catch(e => console.log('Workflow notice:', e.message));
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
};
initDb();

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

const crypto = require('crypto');
const {
  authLimiter,
  passwordVerifyLimiter,
  refreshLimiter,
  inviteLimiter,
  aiLimiter,
  uploadLimiter,
  exportLimiter
} = require('./config/rateLimiter');

const compression = require('compression');

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
const io = require('socket.io')(server, {
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
  // Additional options for better compatibility
  tls: {
    ciphers: 'SSLv3'
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
  async registerUser(orgId, email, password, firstName, lastName, role, department, template_approver, status = 'active', site = null) {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, department, template_approver, status, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [orgId, email, passwordHash, firstName, lastName, role || 'viewer', department || null, template_approver || 'no', status || 'active', site || null]
    );
    return result.insertId;
  },

  async loginUser(email) {
    const [users] = await pool.execute(
      'SELECT id, email, password_hash, first_name, last_name, role, department, template_approver, organization_id, site FROM users WHERE email = ? AND status = ?',
      [email, 'active']
    );
    return users[0];
  },

  async inviteUser(orgId, email, role, department, message, status, site = null) {
    const [result] = await pool.execute(
      'INSERT INTO invited_users (organization_id, email, role, department, message, status, site) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [orgId, email, role, department, message, status, site]
    );
    return result.insertId;
  },

  // Check if invitation exists
  async checkInvitation(token) {
    try {
      const decoded = jwt.verify(token, ENCRYPTION_KEY);

      const [invitations] = await pool.execute(
        'SELECT * FROM invited_users WHERE email = ? AND status = "invited"',
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
    const [result] = await pool.execute(
      'UPDATE invited_users SET password_hash = ?, first_name = ?, last_name = ?, role = ?, department = ?, site = ?, status = ? WHERE email = ? AND organization_id = ?',
      [hashedPassword, firstName, lastName, role, department, site, 'pending', email, orgId]
    );
    return result;
  },

  async updateUserProfile(userId, data) {
    const { firstName, lastName, email, department, status, template_approver, site } = data;
    await pool.execute(
      'UPDATE users SET first_name = ?, last_name = ?, email = ?, department = ?, status = ?, template_approver = ?, site = ? WHERE id = ?',
      [firstName, lastName, email, department, status, template_approver, site || null, userId]
    );
  },

  async changeUserRole(userId, newRole) {
    await pool.execute('UPDATE users SET role = ? WHERE id = ?', [newRole, userId]);
  },

  // Get Dashboard Data
  async listOrganizationUsers(userId) {
    const [orgResults] = await pool.execute(
      'SELECT organization_id FROM users WHERE id = ? AND status = ?',
      [userId, 'active']
    );

    const orgId = orgResults[0].organization_id;
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE organization_id = ? AND status != ?',
      [orgId, 'inactive']
    );
    return users;
  },

  async listInvitedUsers(userId) {
    const [orgResults] = await pool.execute(
      'SELECT organization_id FROM users WHERE id = ? AND status = ?',
      [userId, 'active']
    );

    const orgId = orgResults[0].organization_id;
    const [users] = await pool.execute(
      'SELECT * FROM invited_users WHERE organization_id = ?',
      [orgId]
    );
    return users;
  },

  async getAllDocuments() {
    const [docs] = await pool.execute(
      `SELECT d.document_id, d.organization_id, d.title, d.template_id, d.created_by,
              d.status, d.version, d.current_revision, d.revision_parent_id, d.created_at,
              d.updated_at, d.approvers, d.required_approvers, d.impact, d.notes,
              d.document_number, d.project_number, d.cost_center_number, d.department,
              CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name,
              u.email AS created_by_email
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id`
    );
    return docs.map(doc => normalizeDocumentRowForClient(doc));
  },

  async getUserAccessibleDocuments(userId) {
    // IMPORTANT: Project metadata columns for high-performance dashboard & list rendering.
    // Avoid full-content blobs on list queries while preserving document structure.
    const [userRows] = await pool.execute(
      'SELECT id, organization_id, role, email FROM users WHERE id = ?',
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
              CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name,
              u.email AS created_by_email,
              (SELECT dp.assigned_at FROM documentpermissions dp 
               WHERE dp.document_id = d.document_id AND dp.user_id = ? AND dp.status = 'active' 
               ORDER BY dp.assigned_at DESC LIMIT 1) AS received_at
      FROM documents d
      LEFT JOIN users u ON d.created_by = u.id
    `;
    let params = [];

    const approversClause = `OR (
      d.approvers IS NOT NULL AND (
        d.approvers LIKE ? OR d.approvers LIKE ? OR d.approvers LIKE ? OR d.approvers LIKE ?
        ${userEmail ? 'OR LOWER(d.approvers) LIKE ?' : ''}
      )
    )`;
    const approverParams = [
      `%"userId":${userId}%`,
      `%"userId":"${userId}"%`,
      `%"id":${userId}%`,
      `%"id":"${userId}"%`
    ];
    if (userEmail) {
      approverParams.push(`%"email":"${userEmail}"%`);
    }

    if (isAdmin && orgId) {
      query += ` WHERE (d.organization_id = ? OR d.created_by = ? OR EXISTS (
        SELECT 1 FROM documentpermissions dp
        WHERE dp.document_id = d.document_id AND dp.user_id = ? AND dp.status = 'active'
      ) ${approversClause})`;
      params = [userId, orgId, userId, userId, ...approverParams];
    } else {
      query += ` WHERE (d.created_by = ? OR EXISTS (
        SELECT 1 FROM documentpermissions dp
        WHERE dp.document_id = d.document_id AND dp.user_id = ? AND dp.status = 'active'
      ) ${approversClause})`;
      params = [userId, userId, userId, ...approverParams];
    }

    query += ` ORDER BY d.created_at DESC`;

    const [docs] = await pool.execute(query, params);
    return docs.map(doc => normalizeDocumentRowForClient(doc));
  },

  async getTasks(userId) {
    const [tasks] = await pool.execute(
      `SELECT t.* FROM tasks t JOIN taskassignments ta ON t.id = ta.task_id WHERE ta.assigned_to = ? AND ta.status != 'completed'`,
      [userId]
    );
    return tasks;
  },

  async getTemplates(userId) {
    const [templates] = await pool.execute(
      `SELECT t.id, t.organization_id, t.name, t.description, t.category_id, t.created_by,
              t.created_at, t.updated_at, t.status, t.version, t.revision_parent_id,
              t.required_approvers, t.template_approvers, t.template_structure,
              t.custom_document_approvers, t.notes,
              CONCAT_WS(' ', u2.first_name, u2.last_name) AS created_by_name,
              u2.email AS created_by_email
       FROM templates t 
       JOIN users u ON t.organization_id = u.organization_id 
       LEFT JOIN users u2 ON t.created_by = u2.id
       WHERE u.id = ?`,
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
    const [events] = await pool.execute(
      `SELECT e.* FROM events e JOIN eventparticipants ep ON e.id = ep.event_id WHERE ep.user_id = ? AND e.status = 'scheduled' AND e.end_time > NOW() ORDER BY e.start_time ASC`,
      [userId]
    );
    return events;
  },

  // Document Management
  async createDocument(data) {
    const { orgId, templateId, title, content, elements, createdBy, status = 'draft', coverPageData } = data;
    const docId = uuidv4();
    await pool.execute(
      'INSERT INTO documents (document_id, organization_id, template_id, title, content, elements, current_revision, created_by, status, cover_page_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [docId, orgId, templateId, title, JSON.stringify(content || {}), JSON.stringify(elements || {}), 1.0, createdBy, status, JSON.stringify(coverPageData || {})]
    );
    return docId;
  },

  async updateDocumentStatus(docId, status) {
    await pool.execute(
      'UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
      [status, docId]
    );
  },

  async getDocumentById(docId) {
    const [docs] = await pool.execute(
      `SELECT d.*, u.email AS created_by_email, u.email AS author_email,
              CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.document_id = ?`,
      [docId]
    );
    return docs[0];
  },

  async searchDocuments(searchTerm) {
    const [docs] = await pool.execute(
      'SELECT document_id, title, status FROM documents WHERE title LIKE ? OR content LIKE ?',
      [`%${searchTerm}%`, `%${searchTerm}%`]
    );
    return docs;
  },


  async getDocumentRevisionHistory(docId) {
    const [revisions] = await pool.execute(
      'SELECT dr.revision_number, dr.created_at, u.first_name, u.last_name FROM documentrevisions dr JOIN users u ON dr.created_by = u.id WHERE dr.document_id = ? ORDER BY dr.revision_number DESC',
      [docId]
    );
    return revisions;
  },

  async createDocumentRevision(docId, revisionNumber, content, elements, createdBy, status = 'draft') {
    await pool.execute(
      'INSERT INTO documentrevisions (document_id, revision_number, content, elements, created_by, status) VALUES (?, ?, ?, ?, ?, ?)',
      [docId, revisionNumber, JSON.stringify(content), JSON.stringify(elements), createdBy, status]
    );
  },

  // Document Permissions
  async addDocumentPermission(docId, userId, permissionType, assignedBy) {
    await pool.execute(
      'INSERT INTO documentpermissions (document_id, user_id, permission_type, assigned_by, status) VALUES (?, ?, ?, ?, ?)',
      [docId, userId, permissionType, assignedBy, 'active']
    );
  },

  async requestDocumentAccess(docId, requestedBy, permissionType) {
    await pool.execute(
      'INSERT INTO accessrequests (document_id, requested_by, requested_permission_type, status) VALUES (?, ?, ?, ?)',
      [docId, requestedBy, permissionType, 'pending']
    );
  },

  async getPendingAccessRequests(docId) {
    const [requests] = await pool.execute(
      'SELECT ar.id, ar.requested_by, ar.requested_permission_type, u.first_name, u.last_name, u.email FROM accessrequests ar JOIN users u ON ar.requested_by = u.id WHERE ar.document_id = ? AND ar.status = ?',
      [docId, 'pending']
    );
    return requests;
  },

  async approveAccessRequest(requestId, resolvedBy) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Update request status
      await connection.execute(
        'UPDATE accessrequests SET status = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['approved', resolvedBy, requestId]
      );

      // Get request details
      const [requests] = await connection.execute(
        'SELECT document_id, requested_by, requested_permission_type, resolved_by FROM accessrequests WHERE id = ?',
        [requestId]
      );
      const request = requests[0];

      // Create permission
      await connection.execute(
        'INSERT INTO documentpermissions (document_id, user_id, permission_type, assigned_by, status) VALUES (?, ?, ?, ?, ?)',
        [request.document_id, request.requested_by, request.requested_permission_type, request.resolved_by, 'active']
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Template Management

  // Review Management
  async setupReviewStage(docId, stageOrder, stageType, isMandatory = true) {
    const [result] = await pool.execute(
      'INSERT INTO reviewstages (document_id, stage_order, stage_type, is_mandatory) VALUES (?, ?, ?, ?)',
      [docId, stageOrder, stageType, isMandatory ? 1 : 0]
    );
    return result.insertId;
  },

  async assignReviewer(stageId, userId, isMandatory = true) {
    await pool.execute(
      'INSERT INTO reviewassignments (review_stage_id, user_id, is_mandatory) VALUES (?, ?, ?)',
      [stageId, userId, isMandatory ? 1 : 0]
    );
  },

  async getPendingReviews(userId) {
    const [reviews] = await pool.execute(
      'SELECT d.document_id, d.title, rs.id AS review_stage_id FROM documents d JOIN reviewstages rs ON d.document_id = rs.document_id JOIN reviewassignments ra ON rs.id = ra.review_stage_id WHERE ra.user_id = ? AND ra.status = ?',
      [userId, 'pending']
    );
    return reviews;
  },

  // Task Management
  async createTask(orgId, documentId, title, description, dueDate, priority, createdBy) {
    const [result] = await pool.execute(
      'INSERT INTO tasks (organization_id, document_id, title, description, due_date, priority, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [orgId, documentId || null, title, description, dueDate, priority, createdBy, 'not_started']
    );
    return result.insertId;
  },

  async assignTask(taskId, assignedTo, assignedBy) {
    await pool.execute(
      'INSERT INTO taskassignments (task_id, assigned_to, assigned_by, status) VALUES (?, ?, ?, ?)',
      [taskId, assignedTo, assignedBy, 'pending']
    );
  },

  async completeTask(taskId, userId) {
    await pool.execute(
      'UPDATE taskassignments SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE task_id = ? AND assigned_to = ?',
      ['completed', taskId, userId]
    );

    await pool.execute(`
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
      WHERE id = ?`,
      [taskId]
    );
  },

  // Event Management
  async createEvent(orgId, title, description, startTime, endTime, createdBy) {
    const [result] = await pool.execute(
      'INSERT INTO events (organization_id, title, description, start_time, end_time, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [orgId, title, description, startTime, endTime, createdBy, 'scheduled']
    );
    return result.insertId;
  },

  async addEventParticipant(eventId, userId) {
    await pool.execute(
      'INSERT INTO eventparticipants (event_id, user_id, status) VALUES (?, ?, ?)',
      [eventId, userId, 'invited']
    );
  },

  async acceptEventInvitation(eventId, userId) {
    await pool.execute(
      'UPDATE eventparticipants SET status = ? WHERE event_id = ? AND user_id = ?',
      ['accepted', eventId, userId]
    );
  },

  async linkDocumentsToEvent(eventId, docId) {
    await pool.execute(
      'INSERT INTO eventdocuments (event_id, document_id) VALUES (?, ?)',
      [eventId, docId]
    );
  },

  // Notes and Comments
  async addNote(userId, docId, content, isPrivate = false) {
    const [result] = await pool.execute(
      'INSERT INTO notes (user_id, document_id, content, is_private) VALUES (?, ?, ?, ?)',
      [userId, docId, content, isPrivate ? 1 : 0]
    );
    return result.insertId;
  },

  async shareNote(noteId, recipientId) {
    await pool.execute(
      'INSERT INTO noterecipients (note_id, recipient_id, status) VALUES (?, ?, ?)',
      [noteId, recipientId, 'delivered']
    );
  },

  async markNoteAsRead(noteId, recipientId) {
    await pool.execute(
      'UPDATE noterecipients SET status = ?, read_at = CURRENT_TIMESTAMP WHERE note_id = ? AND recipient_id = ?',
      ['read', noteId, recipientId]
    );
  },

  // Organization Management
  async createOrganization(name, settings = {}) {
    const [result] = await pool.execute(
      'INSERT INTO organizations (name, settings) VALUES (?, ?)',
      [name, JSON.stringify(settings)]
    );
    return result.insertId;
  },

  async updateOrganizationSettings(orgId, settings) {
    await pool.execute(
      'UPDATE organizations SET settings = ? WHERE id = ?',
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
    const [records] = await pool.execute(
      'SELECT a.action_type, a.details, a.created_at, a.status, COALESCE(a.user_name, CONCAT(u.first_name, " ", u.last_name)) as full_name, COALESCE(a.user_email, u.email) as email FROM audittrail a LEFT JOIN users u ON a.user_id = u.id WHERE (a.document_id = ? OR (a.resource_type = "document" AND a.resource_id = ?)) ORDER BY a.created_at DESC',
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
    const [users] = await pool.execute(
      'SELECT id, email, organization_id, role, status, token_version FROM users WHERE id = ?',
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

    req.user = {
      userId: effectiveUserId,
      id: effectiveUserId,
      email: effectiveEmail,
      organization_id: user.organization_id,
      orgId: user.organization_id,
      role: effectiveRole,
      token_version: user.token_version
    };

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
    WHERE category_id = ?
  `;

  const [results] = await db.execute(query, [parentCategoryId]);

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
      WHERE category_id = ?
    `;

    const [results] = await pool.execute(query, [currentId]);

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
    WHERE parent_category_id = ?
  `;

  const [children] = await db.execute(childrenQuery, [parentId]);

  for (const child of children) {
    // Calculate new path for this child
    const newPath = await calculateFolderPath(child.category_id, child.parent_category_id, db);

    // Update the child's path
    const updateQuery = `
      UPDATE template_categories
      SET folder_path = ?
      WHERE category_id = ?
    `;

    await db.execute(updateQuery, [newPath, child.category_id]);

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
  logAuditEvent
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

// 6. Training / LMS Module
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
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
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
    const connection = await pool.getConnection();
    try {
      // 1. Check if custom_document_approvers exists in templates table
      try {
        const [columns] = await connection.query('SHOW COLUMNS FROM templates LIKE "custom_document_approvers"');
        if (columns.length === 0) {
          await connection.query('ALTER TABLE templates ADD COLUMN custom_document_approvers LONGTEXT DEFAULT NULL');
          console.log('✅ Successfully added custom_document_approvers column to templates table');
        }
      } catch (err) {
        console.warn('Notice checking templates.custom_document_approvers:', err.message);
      }

      // 2. Sanitize template_approver on users table if it has invalid duplicate '' enum definition
      try {
        await connection.query("ALTER TABLE users MODIFY COLUMN template_approver ENUM('yes','no') DEFAULT 'no'");
        console.log('✅ Sanitized users.template_approver column definition');
      } catch (err) {
        // Ignored if table doesn't exist yet or already matching
      }

      // 3. Add token_version to users table if missing
      try {
        const [uCols] = await connection.query('SHOW COLUMNS FROM users LIKE "token_version"');
        if (uCols.length === 0) {
          await connection.query('ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 1');
          console.log('✅ Successfully added token_version column to users table');
        }
      } catch (err) {
        console.warn('Notice checking users.token_version:', err.message);
      }

      // 4. Add last_login to users table if missing
      try {
        const [llCols] = await connection.query('SHOW COLUMNS FROM users LIKE "last_login"');
        if (llCols.length === 0) {
          await connection.query('ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL');
          console.log('✅ Successfully added last_login column to users table');
        }
      } catch (err) {
        console.warn('Notice checking users.last_login:', err.message);
      }

      // 5. Add token_hash, revoked_at, replaced_by_hash to refresh_tokens table if missing
      try {
        const [rtCols] = await connection.query('SHOW COLUMNS FROM refresh_tokens LIKE "token_hash"');
        if (rtCols.length === 0) {
          await connection.query('ALTER TABLE refresh_tokens ADD COLUMN token_hash VARCHAR(64) DEFAULT NULL, ADD COLUMN revoked_at TIMESTAMP NULL DEFAULT NULL, ADD COLUMN replaced_by_hash VARCHAR(64) DEFAULT NULL');
          console.log('✅ Successfully enhanced refresh_tokens schema with token_hash and revoked_at');
        }
      } catch (err) {
        console.warn('Notice checking refresh_tokens schema:', err.message);
      }

      // 6. Self-heal: ensure all author permissions are active
      try {
        await connection.query('UPDATE documentpermissions SET status = "active" WHERE permission_type = "author"');
        console.log('✅ Self-healed active status for all author permissions');
      } catch (err) {
        // Ignored if table doesn't exist yet
      }

      // 7. Self-heal: ensure active documentpermissions exist for all pending workflow approvers and reviewers
      try {
        const [pendingDocs] = await connection.query(
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
              await connection.query(
                `INSERT INTO documentpermissions (document_id, user_id, permission_type, assigned_by, status)
                 VALUES (?, ?, ?, ?, 'active')
                 ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type), status = 'active'`,
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
      connection.release();
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
    const [result] = await pool.execute(`
      DELETE FROM refresh_tokens 
      WHERE (expires_at < DATE_SUB(NOW(), INTERVAL 30 DAY))
         OR (revoked_at IS NOT NULL AND revoked_at < DATE_SUB(NOW(), INTERVAL 30 DAY))
    `);
    if (result && result.affectedRows > 0) {
      console.log(`🧹 [Retention] Purged ${result.affectedRows} expired/revoked refresh token(s) older than 30 days`);
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
runMigrations().then(() => {
  // Run initial token cleanup after migrations have ensured revoked_at column exists
  cleanupExpiredTokens();
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Startup migration error:', err);
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
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
    await new Promise((resolve) => {
      server.close((err) => {
        if (err) console.warn('Notice closing HTTP server:', err.message);
        else console.log('✅ [Shutdown] HTTP server closed.');
        resolve();
      });
    });

    // 2. Disconnect Socket.IO active clients cleanly
    if (io) {
      await new Promise((resolve) => {
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


