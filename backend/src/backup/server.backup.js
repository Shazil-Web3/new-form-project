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
const upload = multer({ storage });

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
  } catch (error) {
    console.error('❌ Error initializing attachments table:', error);
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

const app = express();
const server = http.createServer(app);

// Configure CORS to allow frontend access
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('🔌 New client connected');

  // Handle joining template room
  socket.on('joinTemplateRoom', (data) => {
    const { templateId, userId, userName, userEmail, role } = data;
    const roomId = `template:${templateId}`;

    console.log(`👥 User ${userName} joining room ${roomId}`);

    // Join the room
    socket.join(roomId);

    // Broadcast user presence to others in the room
    socket.to(roomId).emit('userPresence', {
      type: 'joined',
      templateId,
      userId,
      userName,
      userEmail,
      role,
      timestamp: Date.now()
    });
  });

  // Handle content changes
  socket.on('templateContentChange', (data) => {
    const { templateId, content, userId, userName } = data;
    const roomId = `template:${templateId}`;

    console.log(`📝 Content update from ${userName} in ${roomId}`);

    // Broadcast to all clients except sender
    socket.to(roomId).emit('templateContentUpdate', {
      templateId,
      content,
      userId,
      userName,
      timestamp: Date.now()
    });
  });

  // Handle cursor position updates
  socket.on('templateCursorUpdate', (data) => {
    const { templateId, userId, userName, position } = data;
    const roomId = `template:${templateId}`;

    socket.to(roomId).emit('templateCursorUpdate', {
      templateId,
      userId,
      userName,
      position,
      timestamp: Date.now()
    });
  });

  // Handle leaving template room
  socket.on('leaveTemplateRoom', (data) => {
    const { templateId } = data;
    const roomId = `template:${templateId}`;

    console.log(`👋 Client leaving room ${roomId}`);
    socket.leave(roomId);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('👋 Client disconnected');
  });
});

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

const SECRET_KEY = process.env.JWT_SECRET || 'your-very-secure-secret-key';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-very-secure-secret-key';

// Database operations
const dbOps = {
  // User Management
  async registerUser(orgId, email, password, firstName, lastName, role, department, template_approver, status = 'active', site = null) {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, department, template_approver, status, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [orgId, email, passwordHash, firstName, lastName, role, department, template_approver, status, site]
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
      'SELECT * FROM documents',
    );
    return docs.map(doc => normalizeDocumentRowForClient(doc));
  },

  async getUserAccessibleDocuments(userId) {
    // IMPORTANT: never use SELECT * with JOIN here — documentpermissions.status ('active')
    // overwrites documents.status ('draft', 'pending_review', ...) in the driver row object.
    const [docs] = await pool.execute(
      `SELECT d.* FROM documents d
       WHERE EXISTS (
         SELECT 1 FROM documentpermissions dp
         WHERE dp.document_id = d.document_id AND dp.user_id = ? AND dp.status = 'active'
       )`,
      [userId]
    );
    return docs.map(doc => normalizeDocumentRowForClient(doc));
  },

  async getTasks(userId) {
    const [tasks] = await pool.execute(
      `SELECT t.* FROM tasks t JOIN taskassignments ta ON t.id = ta.task_id WHERE ta.assigned_to = ? AND ta.status != 'completed'`
      [userId]
    );
    return tasks;
  },

  async getTemplates(userId) {
    const [templates] = await pool.execute(
      'SELECT t.* FROM templates t JOIN users u ON t.organization_id = u.organization_id WHERE u.id = ?',
      [userId]
    );

    // Flatten metadata from comments JSON for each template
    return templates.map(template => {
      if (template.comments) {
        try {
          let metadata = template.comments;
          if (typeof metadata === 'string') {
            try { metadata = JSON.parse(metadata); } catch (_) {}
          }
          if (typeof metadata === 'string') {
            try { metadata = JSON.parse(metadata); } catch (_) {}
          }
          if (metadata && typeof metadata === 'object') {
            template.headerHTML = metadata.headerHTML || '';
            template.footerHTML = metadata.footerHTML || '';
            template.logo = metadata.logo || null;
            template.logoText = metadata.logoText || '';
            template.logoTextRight = metadata.logoTextRight || '';
            template.orientation = metadata.orientation || 'portrait';
            template.paperSize = metadata.paperSize || 'A4';
            template.pagesState = metadata.pagesState || null;
          }
        } catch (e) {
          // Ignore parse errors
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
      'SELECT * FROM documents WHERE document_id = ?',
      [docId]
    );
    return docs[0];
  },

  async searchDocuments(searchTerm) {
    const [docs] = await pool.execute(
      'SELECT id, title, status FROM documents WHERE title LIKE ? OR content LIKE ?',
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
  async addAuditRecord(orgId, userId, actionType, docId, details, ipAddress) {
    await pool.execute(
      'INSERT INTO audittrail (organization_id, user_id, action_type, document_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [orgId, userId, actionType, docId, details, ipAddress]
    );
  },

  async getDocumentAuditTrail(docId) {
    const [records] = await pool.execute(
      'SELECT a.action_type, a.details, a.created_at, u.first_name, u.last_name FROM audittrail a JOIN users u ON a.user_id = u.id WHERE a.document_id = ? ORDER BY a.created_at DESC',
      [docId]
    );
    return records;
  }
};

//Middlewares
// token cleanup on server startup
const cleanupExpiredTokens = async () => {
  try {
    await pool.execute('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
    console.log('Expired tokens cleaned up');
  } catch (error) {
    console.error('Error cleaning up tokens:', error);
  }
};

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
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
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days expiration
  };

  return jwt.sign(tokenData, ENCRYPTION_KEY);
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

// ========================= API ROUTES ========================

// Create Organization
app.post('/api/organization/register', async (req, res) => {
  try {
    const { name, settings } = req.body;
    const orgId = await dbOps.createOrganization(name, settings);
    res.status(201).json({ id: orgId, message: 'Organization registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User routes
app.post('/api/users/register', async (req, res) => {
  try {
    const { orgId, email, password, firstName, lastName, role } = req.body;
    const department = null;
    const template_approver = 'no';
    const userId = await dbOps.registerUser(orgId, email, password, firstName, lastName, role, department, template_approver);
    res.status(201).json({ id: userId, message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Verify invitation token endpoint
app.get('/api/invitations/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const invitation = await dbOps.checkInvitation(token);

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    // Return relevant invitation data (excluding sensitive info)
    res.json({
      email: invitation.email,
      role: invitation.role,
      department: invitation.department,
      site: invitation.site,
      orgId: invitation.orgId
    });
  } catch (error) {
    console.error('Error verifying invitation:', error);
    res.status(500).json({ error: 'Failed to verify invitation' });
  }
});

// Register invited user endpoint
app.post('/api/invitations/register', async (req, res) => {
  try {
    const { token, firstName, lastName, password } = req.body;

    if (!token || !firstName || !lastName || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Verify and decode the invitation token
    const invitation = await dbOps.checkInvitation(token);

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    // Register the invited user
    const userData = await dbOps.registerInvitedUser(
      invitation.orgId,
      invitation.email,
      password,
      firstName,
      lastName,
      invitation.role || null,
      invitation.department || null,
      null, // status is handled by default
      invitation.site || null
    );

    res.status(201).json({
      user: userData,
      message: 'Registration successful'
    });
  } catch (error) {
    console.error('Error registering invited user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await dbOps.loginUser(email);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // In production, generate JWT token here
    const userData = { ...user };
    delete userData.password_hash;

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.ACCESS_SECRET,
      { expiresIn: '7d' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Store refresh token in database
    await pool.execute(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );

    // Return both tokens and user data
    res.json({
      accessToken,
      refreshToken,
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Password verification endpoint
app.post('/api/verify-password', authenticateToken, async (req, res) => {
  try {
    const { userId, password } = req.body;

    // 1. Get the user from MySQL database
    const [users] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // 2. Verify the password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ verified: false, error: 'Incorrect password' });
    }

    // 3. If successful
    res.json({ verified: true });

  } catch (error) {
    console.error('Password verification error:', error);
    res.status(500).json({ error: 'Password verification failed' });
  }
});

// Add this route to get current user data
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const [user] = await pool.execute(
      'SELECT id, email, first_name, last_name, role, template_approver, organization_id FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user[0].id,
      email: user[0].email,
      firstName: user[0].first_name,
      lastName: user[0].last_name,
      role: user[0].role,
      orgId: user[0].organization_id,
      template_approver: user[0].template_approver
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Add this route to handle logouts
app.post('/api/auth/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Delete the refresh token from database
    await pool.execute(
      'DELETE FROM refresh_tokens WHERE token = ?',
      [refreshToken]
    );

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    } catch (verifyError) {
      // Clean up expired or invalid token from database
      await pool.execute(
        'DELETE FROM refresh_tokens WHERE token = ?',
        [refreshToken]
      ).catch(() => {});

      if (verifyError.name === 'TokenExpiredError' || verifyError.name === 'JsonWebTokenError') {
        console.warn('⚠️ Refresh token expired or invalid:', verifyError.message);
        return res.status(401).json({ error: 'Refresh token expired', code: 'TOKEN_EXPIRED' });
      }
      throw verifyError;
    }

    // Check if refresh token exists in DB
    const [validToken] = await pool.execute(
      'SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ? AND expires_at > NOW()',
      [refreshToken, decoded.userId]
    );

    if (!validToken.length) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Get user data
    const [user] = await pool.execute(
      'SELECT id, email FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { userId: user[0].id, email: user[0].email },
      process.env.ACCESS_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// Routes for Dashboard Get requests
//Route Get Users
app.get('/api/org_members/:userId', authenticateToken, async (req, res) => {
  try {
    const users = await dbOps.listOrganizationUsers(req.params.userId);

    // Remove sensitive data
    const sanitizedUsers = users.map(user => {
      const { password_hash, ...userData } = user;
      return userData;
    });

    res.json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

//Route Get Invited Users
app.get('/api/invited_users/:userId', authenticateToken, async (req, res) => {
  try {
    const users = await dbOps.listInvitedUsers(req.params.userId);

    res.json(users);
  } catch (error) {
    console.error('Error fetching invited members:', error);
    res.status(500).json({ error: 'Failed to fetch invited members' });
  }
});

//Route Get Documents
app.get('/api/all-docs', authenticateToken, async (req, res) => {
  try {
    const docs = await dbOps.getAllDocuments();
    res.json(docs);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

app.get('/api/my-docs/:userId', authenticateToken, async (req, res) => {
  try {
    const docs = await dbOps.getUserAccessibleDocuments(req.params.userId);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Check if a newer published version of the document's template is available
app.get('/api/template-update-notice/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;

    // 1. Get the document's template_id
    const [docs] = await pool.execute(
      'SELECT template_id FROM documents WHERE document_id = ?',
      [documentId]
    );

    if (!docs.length || !docs[0].template_id) {
      return res.json({ hasNewerVersion: false });
    }

    const originalTemplateId = docs[0].template_id;

    // 2. Try to get the original template info
    let isBaseDocument = false;
    let originalTemplate = null;

    const [originalRows] = await pool.execute(
      'SELECT id, name, version FROM templates WHERE id = ?',
      [originalTemplateId]
    );

    if (originalRows.length) {
      originalTemplate = originalRows[0];
    } else {
      // Not in templates, check if it exists in documents (as a base document)
      const [originalDocRows] = await pool.execute(
        'SELECT document_id as id, title as name, version FROM documents WHERE document_id = ?',
        [originalTemplateId]
      );
      if (originalDocRows.length) {
        originalTemplate = originalDocRows[0];
        isBaseDocument = true;
      }
    }

    if (!originalTemplate) {
      return res.json({ hasNewerVersion: false });
    }

    // 3. Walk the FULL revision chain to find the latest published version.
    let currentId = originalTemplateId;
    let latestPublished = null;
    const MAX_DEPTH = 50; // safety cap

    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      let children = [];
      if (isBaseDocument) {
        const [rows] = await pool.execute(
          `SELECT document_id as id, title as name, version, status FROM documents
           WHERE revision_parent_id = ?
           ORDER BY version DESC LIMIT 1`,
          [currentId]
        );
        children = rows;
      } else {
        const [rows] = await pool.execute(
          `SELECT id, name, version, status FROM templates
           WHERE revision_parent_id = ?
           ORDER BY version DESC LIMIT 1`,
          [currentId]
        );
        children = rows;
      }

      if (!children.length) break; // end of chain

      const child = children[0];
      currentId = child.id;

      // Track the furthest published/revised version we encounter
      if (child.status === 'published' || child.status === 'revised') {
        latestPublished = child;
      }
    }

    if (!latestPublished || latestPublished.id === originalTemplateId) {
      return res.json({ hasNewerVersion: false });
    }

    return res.json({
      hasNewerVersion: true,
      newTemplate: {
        id: latestPublished.id,
        name: latestPublished.name,
        version: latestPublished.version,
      },
      oldTemplate: {
        id: originalTemplateId,
        name: originalTemplate.name,
        version: originalTemplate.version,
      }
    });
  } catch (error) {
    console.error('Error checking template update notice:', error);
    res.status(500).json({ error: 'Failed to check template update' });
  }
});

// Check if a newer published version of the template itself is available
app.get('/api/template-version-notice/:templateId', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.params;

    // 1. Get the template info
    const [originalRows] = await pool.execute(
      'SELECT id, name, version FROM templates WHERE id = ?',
      [templateId]
    );
    if (!originalRows.length) {
      return res.json({ hasNewerVersion: false });
    }
    const originalTemplate = originalRows[0];

    // 2. Walk the FULL revision chain to find the latest published version.
    let currentId = templateId;
    let latestPublished = null;
    const MAX_DEPTH = 50; // safety cap

    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      const [children] = await pool.execute(
        `SELECT id, name, version, status FROM templates
         WHERE revision_parent_id = ?
         ORDER BY version DESC LIMIT 1`,
        [currentId]
      );

      if (!children.length) break; // end of chain

      const child = children[0];
      currentId = child.id;

      // Track the furthest published/revised version we encounter
      if (child.status === 'published' || child.status === 'revised') {
        latestPublished = child;
      }
    }

    if (!latestPublished || latestPublished.id === templateId) {
      return res.json({ hasNewerVersion: false });
    }

    return res.json({
      hasNewerVersion: true,
      newTemplate: {
        id: latestPublished.id,
        name: latestPublished.name,
        version: latestPublished.version,
      },
      oldTemplate: {
        id: templateId,
        name: originalTemplate.name,
        version: originalTemplate.version,
      }
    });
  } catch (error) {
    console.error('Error checking template version notice:', error);
    res.status(500).json({ error: 'Failed to check template version update' });
  }
});

//Route Get Tasks
app.get('/api/tasks/my-tasks', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const searchTerm = req.query?.search ? String(req.query.search).trim() : '';
    const search = searchTerm.length > 0 ? `%${searchTerm.toLowerCase()}%` : null;

    let query = `
      SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at, t.created_by,
             t.document_id,
             d.title AS document_title,
             ta.assigned_to, ta.status AS assignment_status,
             sender.first_name AS created_by_first_name, sender.last_name AS created_by_last_name,
             assignee.first_name AS assigned_to_first_name, assignee.last_name AS assigned_to_last_name
      FROM tasks t
      LEFT JOIN taskassignments ta ON ta.task_id = t.id
      LEFT JOIN users sender ON sender.id = t.created_by
      LEFT JOIN users assignee ON assignee.id = ta.assigned_to
      LEFT JOIN documents d ON d.document_id = t.document_id
      WHERE ta.assigned_to = ? OR t.created_by = ?
    `;
    const params = [userId, userId];

    if (search) {
      query += ` AND (LOWER(t.title) LIKE ? OR LOWER(t.description) LIKE ? OR LOWER(CONCAT(sender.first_name, ' ', sender.last_name)) LIKE ?)`;
      params.push(search, search, search);
    }

    query += ` ORDER BY t.created_at DESC`;

    const [tasks] = await pool.execute(query, params);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching my-tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

app.get('/api/tasks/sent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const searchTerm = req.query?.search ? String(req.query.search).trim() : '';
    const search = searchTerm.length > 0 ? `%${searchTerm.toLowerCase()}%` : null;

    let query = `
      SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, t.created_at, t.created_by,
             t.document_id,
             d.title AS document_title,
             ta.assigned_to, ta.status AS assignment_status,
             sender.first_name AS created_by_first_name, sender.last_name AS created_by_last_name,
             assignee.first_name AS assigned_to_first_name, assignee.last_name AS assigned_to_last_name
      FROM tasks t
      LEFT JOIN taskassignments ta ON ta.task_id = t.id
      LEFT JOIN users sender ON sender.id = t.created_by
      LEFT JOIN users assignee ON assignee.id = ta.assigned_to
      LEFT JOIN documents d ON d.document_id = t.document_id
      WHERE t.created_by = ?
    `;
    const params = [userId];

    if (search) {
      query += ` AND (LOWER(t.title) LIKE ? OR LOWER(t.description) LIKE ? OR LOWER(CONCAT(sender.first_name, ' ', sender.last_name)) LIKE ? OR LOWER(CONCAT(assignee.first_name, ' ', assignee.last_name)) LIKE ?)`;
      params.push(search, search, search, search);
    }

    query += ` ORDER BY t.created_at DESC`;

    const [tasks] = await pool.execute(query, params);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching sent tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sent tasks' });
  }
});

app.get('/api/tasks/:id/comments', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const [comments] = await pool.execute(
      `SELECT tc.*, CONCAT(u.first_name, ' ', u.last_name) AS user_name 
       FROM task_comments tc 
       JOIN users u ON tc.user_id = u.id 
       WHERE tc.task_id = ? 
       ORDER BY tc.created_at ASC`,
      [taskId]
    );
    res.json({ success: true, data: comments });
  } catch (error) {
    console.error('Error fetching task comments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch task comments' });
  }
});

app.post('/api/tasks/:id/comments', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user?.userId || req.user?.id;
    const { message, parent_id } = req.body || {};

    if (!message) {
      return res.status(400).json({ success: false, error: 'Comment message is required' });
    }

    const [result] = await pool.execute(
      'INSERT INTO task_comments (task_id, user_id, message, parent_id) VALUES (?, ?, ?, ?)',
      [taskId, userId, message, parent_id || null]
    );

    res.json({ success: true, commentId: result.insertId });
  } catch (error) {
    console.error('Error adding task comment:', error);
    res.status(500).json({ success: false, error: 'Failed to add task comment' });
  }
});

// --- Task Creation Endpoint (from Intern taskController.js) ---
app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user?.organization_id || req.user?.orgId || 1;
    const createdBy = req.user?.userId || req.user?.id;
    const { title, description, due_date, priority, assigned_to, document_id } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Task title is required' });
    }

    const normalizedDocId = document_id && String(document_id).trim() ? String(document_id).trim() : null;

    // Safely parse due_date to YYYY-MM-DD or NULL if invalid
    let validDueDate = null;
    if (due_date && typeof due_date === 'string' && due_date.trim()) {
      const parsedDate = new Date(due_date.trim());
      if (!isNaN(parsedDate.getTime())) {
        const year = parsedDate.getFullYear();
        if (year >= 1970 && year <= 2100) {
          validDueDate = parsedDate.toISOString().split('T')[0];
        }
      }
    }

    const normalizedPriority = ['low', 'medium', 'high'].includes(String(priority || '').toLowerCase())
      ? String(priority).toLowerCase()
      : 'medium';

    const [result] = await pool.execute(
      'INSERT INTO tasks (organization_id, document_id, title, description, due_date, priority, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [orgId, normalizedDocId, title.trim(), description || '', validDueDate, normalizedPriority, createdBy, 'not_started']
    );
    const taskId = result.insertId;

    const targetAssignee = assigned_to || createdBy;
    if (targetAssignee) {
      await pool.execute(
        'INSERT INTO taskassignments (task_id, assigned_to, assigned_by, status) VALUES (?, ?, ?, ?)',
        [taskId, targetAssignee, createdBy, 'pending']
      );
    }

    res.json({ success: true, taskId, id: taskId });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

// --- Workspace Users Helper Endpoint (from Intern userRoutes.js) ---
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user?.organization_id || req.user?.orgId || 1;
    const [users] = await pool.execute(
      'SELECT id, first_name, last_name, email, role, department, site FROM users WHERE organization_id = ? AND status != ?',
      [orgId, 'inactive']
    );
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// --- Workspace Documents Helper Endpoint (from Intern documentRoutes.js) ---
app.get('/api/documents', authenticateToken, async (req, res) => {
  try {
    const [docs] = await pool.execute(
      'SELECT document_id AS id, document_id, title, status, created_at FROM documents ORDER BY created_at DESC'
    );
    res.json(docs);
  } catch (error) {
    console.error('Error fetching documents list:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch documents' });
  }
});


app.get('/api/tasks/:userId', authenticateToken, async (req, res) => {
  try {
    const [tasks] = await pool.execute(
      `SELECT t.* FROM tasks t 
       JOIN taskassignments ta ON t.id = ta.task_id 
       WHERE ta.assigned_to = ? AND ta.status != 'completed'`,
      [req.params.userId]
    );
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create Task Route
app.post('/api/create-task', authenticateToken, async (req, res) => {
  try {
    const { title, description, due_date, priority, assigned_to, document_id, created_by } = req.body;

    // Get user's organization_id
    const [user] = await pool.execute(
      'SELECT organization_id FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (!user.length) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const orgId = user[0].organization_id;

    // Create the task
    const taskId = await dbOps.createTask(orgId, document_id, title, description, due_date, priority, created_by);

    // Assign the task if assigned_to is provided
    if (assigned_to) {
      await dbOps.assignTask(taskId, assigned_to, created_by);
    }

    res.status(201).json({ success: true, taskId });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

// Update Task Route
app.put('/api/update-task/:taskId', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const { completed } = req.body;
    const userId = req.user.userId;

    const assignmentStatus = completed ? 'completed' : 'pending';
    const taskStatus = completed ? 'completed' : 'not_started';

    // Update task assignment status
    if (completed) {
      await pool.execute(
        'UPDATE taskassignments SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE task_id = ? AND assigned_to = ?',
        [assignmentStatus, taskId, userId]
      );
    } else {
      await pool.execute(
        'UPDATE taskassignments SET status = ?, completed_at = NULL WHERE task_id = ? AND assigned_to = ?',
        [assignmentStatus, taskId, userId]
      );
    }

    // Also update the main task status
    await pool.execute(
      'UPDATE tasks SET status = ? WHERE id = ?',
      [taskStatus, taskId]
    );

    res.json({ success: true, message: 'Task updated successfully' });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

/* app.get('/api/notifications/:userId', authenticateToken, async (req, res) => {
  try {
    const [notifications] = await pool.execute(
      `SELECT * FROM notifications 
       WHERE user_id = ? AND status = 'unread' 
       ORDER BY created_at DESC LIMIT 10`,
      [req.params.userId]
    );
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}); */

//Route Get Events
app.get('/api/calendar-events/:userId', authenticateToken, async (req, res) => {
  try {
    const events = await dbOps.getEvents(req.params.userId);
    res.json(events);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

//Route Get Audit Trail
app.get('/api/activity-log/:userId', authenticateToken, async (req, res) => {
  try {
    const [activities] = await pool.execute(
      `SELECT a.* FROM audittrail a
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC LIMIT 20`,
      [req.params.userId]
    );
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

// ==================== ATTACHMENTS ROUTES ====================

// Route to upload an attachment
app.post('/api/attachments/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let { association_type, association_id } = req.body;
    const file_name = req.file.originalname;
    const serverFileName = req.file.filename;
    const file_type_safe = req.file.mimetype || 'application/octet-stream';
    const file_size = req.file.size || 0;

    // Handle temporary uploads (when creating a new template or document without an ID yet)
    if (!association_id || association_id === 'null' || association_id === 'undefined') {
      association_type = 'temp';
      association_id = 'temp-session';
    }

    console.log(`📁 File written to disk via multer: ${req.file.path} (${file_size} bytes)`);

    // Insert record into attachments database table
    const [result] = await pool.execute(
      'INSERT INTO attachments (association_type, association_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [association_type, association_id, file_name, serverFileName, file_type_safe, file_size, userId]
    );

    // Fetch the inserted record to return it with user details
    const [inserted] = await pool.execute(
      `SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name 
       FROM attachments a 
       LEFT JOIN users u ON a.uploaded_by = u.id 
       WHERE a.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Attachment uploaded successfully',
      attachment: inserted[0]
    });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

// Route to download an attachment
app.get('/api/attachments/download/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute('SELECT * FROM attachments WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).send('Attachment not found');
    }

    const attachment = rows[0];
    const serverFilePath = path.join(uploadsDir, attachment.file_path);

    if (!fs.existsSync(serverFilePath)) {
      return res.status(404).send('File not found on server');
    }

    res.download(serverFilePath, attachment.file_name);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).send('Error downloading file');
  }
});

// Route to view/open an attachment inline in new tab
app.get('/api/attachments/view/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute('SELECT * FROM attachments WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).send('Attachment not found');
    }

    const attachment = rows[0];
    const serverFilePath = path.join(uploadsDir, attachment.file_path);

    if (!fs.existsSync(serverFilePath)) {
      return res.status(404).send('File not found on server');
    }

    res.setHeader('Content-Type', attachment.file_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.file_name)}"`);
    res.sendFile(serverFilePath);
  } catch (error) {
    console.error('Error viewing attachment:', error);
    res.status(500).send('Error opening file');
  }
});

// Route to get all attachments for a specific association
app.get('/api/attachments/:association_type/:association_id', authenticateToken, async (req, res) => {
  try {
    const { association_type, association_id } = req.params;

    const [rows] = await pool.execute(
      `SELECT a.*, CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name 
       FROM attachments a 
       LEFT JOIN users u ON a.uploaded_by = u.id 
       WHERE a.association_type = ? AND a.association_id = ?
       ORDER BY a.uploaded_at ASC`,
      [association_type, association_id]
    );

    res.json(rows);
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// Route to delete an attachment
app.delete('/api/attachments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch attachment details to find the file path
    const [rows] = await pool.execute('SELECT * FROM attachments WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = rows[0];
    const serverFilePath = path.join(uploadsDir, attachment.file_path);

    // Delete file from server disk if it exists
    if (fs.existsSync(serverFilePath)) {
      try {
        fs.unlinkSync(serverFilePath);
        console.log(`📁 File deleted from disk: ${serverFilePath}`);
      } catch (err) {
        console.error(`Error deleting file ${serverFilePath} from disk:`, err);
      }
    }

    // Delete from database
    await pool.execute('DELETE FROM attachments WHERE id = ?', [id]);

    res.json({ success: true, message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// ==================== TEMPLATES ROUTES ====================


//Route Get Templates
app.get('/api/templates/:userId', authenticateToken, async (req, res) => {
  try {
    // Assuming templates are organization-wide
    const templates = await dbOps.getTemplates(req.params.userId);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get a specific template by ID
app.get('/api/get_template/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;

    const [templates] = await pool.execute(
      'SELECT * FROM templates WHERE id = ?',
      [templateId]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templates[0];
    // Flatten metadata from comments JSON
    if (template.comments) {
      try {
        let metadata = template.comments;
        if (typeof metadata === 'string') {
          try { metadata = JSON.parse(metadata); } catch (_) {}
        }
        if (typeof metadata === 'string') {
          try { metadata = JSON.parse(metadata); } catch (_) {}
        }
        if (metadata && typeof metadata === 'object') {
          template.headerHTML = metadata.headerHTML || '';
          template.footerHTML = metadata.footerHTML || '';
          template.logo = metadata.logo || null;
          template.logoText = metadata.logoText || '';
          template.logoTextRight = metadata.logoTextRight || '';
          template.orientation = metadata.orientation || 'portrait';
          template.paperSize = metadata.paperSize || 'A4';
          template.pagesState = metadata.pagesState || null;
        }
      } catch (e) {
        // Ignore
      }
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Get only the latest template content (from comments.content or content field)
app.get('/api/get_template_content/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const [rows] = await pool.execute(
      'SELECT content, comments FROM templates WHERE id = ?',
      [templateId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const row = rows[0];
    let finalContent = '';
    let metadata = {
      headerHTML: '',
      footerHTML: '',
      logo: null,
      logoText: '',
      logoTextRight: ''
    };

    // Prefer comments.content if present
    if (row.comments) {
      try {
        const commentsData = JSON.parse(row.comments);
        if (commentsData && typeof commentsData.content === 'string') {
          finalContent = commentsData.content;
        }

        // Extract metadata
        if (commentsData) {
          metadata.headerHTML = commentsData.headerHTML || '';
          metadata.footerHTML = commentsData.footerHTML || '';
          metadata.logo = commentsData.logo || null;
          metadata.logoText = commentsData.logoText || '';
          metadata.logoTextRight = commentsData.logoTextRight || '';
          metadata.orientation = commentsData.orientation || 'portrait';
          metadata.paperSize = commentsData.paperSize || 'A4';
          metadata.pagesState = commentsData.pagesState || null;
        }
      } catch (e) {
        // ignore parse errors, fallback below
      }
    }

    // Fallback to content field
    if (!finalContent && row.content) {
      try {
        // Check if it's a JSON string like {"content": "..."}
        if (typeof row.content === 'string' && row.content.trim().startsWith('{')) {
          const parsed = JSON.parse(row.content);
          finalContent = parsed.content || row.content;
        } else {
          finalContent = row.content;
        }
      } catch (e) {
        finalContent = row.content;
      }
    }

    return res.json({
      success: true,
      content: finalContent || '',
      ...metadata
    });
  } catch (error) {
    console.error('Error fetching template content:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch template content' });
  }
});

// Debug endpoint to check comments in templates
app.get('/api/debug_template_comments/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;

    const [templates] = await pool.execute(
      'SELECT id, name, content, comments FROM templates WHERE id = ?',
      [templateId]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templates[0];
    let parsedContent = null;
    let parsedComments = null;

    // Parse content
    if (template.content) {
      try {
        parsedContent = JSON.parse(template.content);
      } catch (e) {
        parsedContent = { error: 'Failed to parse content', raw: template.content };
      }
    }

    // Parse comments
    if (template.comments) {
      try {
        parsedComments = JSON.parse(template.comments);
      } catch (e) {
        parsedComments = { error: 'Failed to parse comments', raw: template.comments };
      }
    }

    res.json({
      id: template.id,
      name: template.name,
      content: parsedContent,
      comments: parsedComments,
      debug: {
        hasContent: !!template.content,
        hasComments: !!template.comments,
        contentType: typeof template.content,
        commentsType: typeof template.comments,
        commentsLength: template.comments ? template.comments.length : 0,
        contentLength: template.content ? template.content.length : 0
      }
    });
  } catch (error) {
    console.error('Error fetching template for debug:', error);
    res.status(500).json({ error: 'Failed to fetch template debug info' });
  }
});

app.post('/api/newtemplate', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      description,
      created_by,
      organization_id,
      category_id,
      approvers,
      impact,
      locked_elements,
      allowAttachments,
      includeTableOfContents,
      content,
      comments,
      notes,
      status,
      version,
      template_approvers,
      revision_parent_id,
      tempAttachments
    } = req.body;

    if (!name || !created_by || !organization_id) {
      return res.status(400).json({
        success: false,
        message: 'Complete the information in Basic Tab'
      });
    }

    // Check if the name is unique across all templates and documents in the organization
    // EXCEPTION: Allow revisions to reuse the same name as their parent or other templates
    if (!revision_parent_id) {
      const uniquenessCheckQuery = `
        SELECT 'template' as type FROM templates WHERE name = ? AND organization_id = ?
        UNION ALL
        SELECT 'document' as type FROM documents WHERE title = ? AND organization_id = ?
      `;
      const [existingRecords] = await pool.execute(uniquenessCheckQuery, [name, organization_id, name, organization_id]);

      if (existingRecords.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'A template or document with this exact name already exists in your organization. Please create a unique name.'
        });
      }
    }

    // Initialize category_id as null if not provided
    let finalCategoryId = category_id || null;

    // If category_id is provided, verify it exists and belongs to the organization
    if (finalCategoryId) {
      const categoryCheckQuery = `
        SELECT category_id FROM template_categories
        WHERE category_id = ? AND organization_id = ?
      `;

      const [categories] = await pool.execute(categoryCheckQuery, [finalCategoryId, organization_id]);

      if (categories.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Category not found'
        });
      }
    }

    const templateId = uuidv4();

    // Create template structure with additional fields
    const templateStructure = {
      locked_elements: locked_elements || {},
      allowAttachments: allowAttachments || false,
      includeTableOfContents: includeTableOfContents || false
    };

    await pool.execute(
      `INSERT INTO templates 
      (id, organization_id, name, description, content, template_structure, required_approvers, impact, notes, template_approvers, comments, created_by, category_id, created_at, updated_at, status, version, revision_parent_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?)`,
      [
        templateId,
        organization_id,
        name,
        description || null,
        content ? JSON.stringify(content) : null,
        JSON.stringify(templateStructure),
        approvers ? JSON.stringify(approvers) : '[]',
        impact ? JSON.stringify(impact) : null,
        notes || null,
        template_approvers ? JSON.stringify(template_approvers) : null,
        comments ? JSON.stringify(comments) : null,
        created_by,
        finalCategoryId,
        status || 'draft',
        version,
        revision_parent_id || null
      ]
    );

    // Clone attachments if this is a revision of another template
    if (revision_parent_id) {
      try {
        const [parentAttachments] = await pool.execute(
          'SELECT * FROM attachments WHERE association_type = "template" AND association_id = ?',
          [revision_parent_id]
        );
        for (const attachment of parentAttachments) {
          const oldFilePath = path.join(uploadsDir, attachment.file_path);
          if (fs.existsSync(oldFilePath)) {
            const uniqueId = uuidv4();
            const newServerFileName = `${uniqueId}-${attachment.file_name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
            const newFilePath = path.join(uploadsDir, newServerFileName);
            fs.copyFileSync(oldFilePath, newFilePath);

            await pool.execute(
              'INSERT INTO attachments (association_type, association_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
              ['template', templateId, attachment.file_name, newServerFileName, attachment.file_type, attachment.file_size, created_by]
            );
          }
        }
        console.log(`✅ Copied attachments from parent template ${revision_parent_id} to new revised template ${templateId}`);
      } catch (copyErr) {
        console.error('Error copying parent template attachments:', copyErr);
      }
    }

    // Process new uploaded attachments if provided
    if (Array.isArray(tempAttachments) && tempAttachments.length > 0) {
      try {
        const ids = tempAttachments
          .map(t => (typeof t === 'object' && t !== null) ? t.id : t)
          .filter(id => id && !String(id).startsWith('temp-'));

        if (ids.length > 0) {
          await pool.execute(
            `UPDATE attachments SET association_type = 'template', association_id = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
            [templateId, ...ids]
          );
          console.log(`✅ Associated ${ids.length} temp attachments to new template ${templateId}`);
        }
      } catch (attachErr) {
        console.error('Error saving temp template attachments:', attachErr);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Template created successfully',
      templateId: templateId
    });
  } catch (error) {
    console.error('Error creating template:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating template'
    });
  }
});

app.put('/api/update_template/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const {
      name,
      description,
      category_id,
      content,
      comments,
      notes,
      template_approvers,
      status,
      approvers,
      impact,
      locked_elements,
      allowAttachments,
      includeTableOfContents,
      version,
      revision_parent_id
    } = req.body;

    // Validate template ID
    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID'
      });
    }

    // Build query parts
    let updateParts = [];
    let params = [];

    // Handle basic fields
    if (name !== undefined) {
      updateParts.push('name = ?');
      params.push(name);
    }

    if (description !== undefined) {
      updateParts.push('description = ?');
      params.push(description);
    }

    if (category_id !== undefined) {
      updateParts.push('category_id = ?');
      params.push(category_id);
    }

    if (notes !== undefined) {
      updateParts.push('notes = ?');
      params.push(notes);
    }

    // Handle content update — avoid double-encoding if value is already a JSON string from DB
    if (content !== undefined) {
      updateParts.push('content = ?');
      params.push(safeJsonStringify(content));
    }

    // Handle comments update — avoid double-encoding if value is already a JSON string from DB
    if (comments !== undefined) {
      updateParts.push('comments = ?');
      params.push(safeJsonStringify(comments));
    }

    // Handle template structure updates
    let templateStructureUpdates = {};

    if (locked_elements !== undefined) {
      templateStructureUpdates.locked_elements = locked_elements;
    }

    if (allowAttachments !== undefined) {
      templateStructureUpdates.allowAttachments = allowAttachments;
    }

    if (includeTableOfContents !== undefined) {
      templateStructureUpdates.includeTableOfContents = includeTableOfContents;
    }

    // Only fetch current template structure if we have updates to merge
    if (Object.keys(templateStructureUpdates).length > 0) {
      const [currentTemplate] = await pool.execute(
        'SELECT template_structure FROM templates WHERE id = ?',
        [templateId]
      );

      let currentStructure = {};
      if (currentTemplate.length > 0 && currentTemplate[0].template_structure) {
        try {
          currentStructure = JSON.parse(currentTemplate[0].template_structure);
        } catch (e) {
          console.error('Error parsing template structure:', e);
          currentStructure = {};
        }
      }

      // Merge updates
      const updatedStructure = { ...currentStructure, ...templateStructureUpdates };
      updateParts.push('template_structure = ?');
      params.push(safeJsonStringify(updatedStructure));
    }

    // Handle approvers update
    if (approvers !== undefined) {
      updateParts.push('required_approvers = ?');
      params.push(safeJsonStringify(approvers));
    }

    // Handle impact update
    if (impact !== undefined) {
      updateParts.push('impact = ?');
      params.push(safeJsonStringify(impact));
    }

    // Handle status
    if (status !== undefined) {
      updateParts.push('status = ?');
      params.push(status || 'draft');
    }

    // Handle status
    if (version !== undefined) {
      updateParts.push('version = ?');
      params.push(version || '1');
    }

    // Handle status
    if (revision_parent_id !== undefined) {
      updateParts.push('revision_parent_id = ?');
      params.push(revision_parent_id || null);
    }

    // Handle approvers update
    if (template_approvers !== undefined) {
      updateParts.push('template_approvers = ?');
      params.push(safeJsonStringify(template_approvers));
    }

    // Add updated_at timestamp
    updateParts.push('updated_at = CURRENT_TIMESTAMP');

    // Check if we have any fields to update
    if (updateParts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    // Add template ID to params for WHERE clause
    params.push(templateId);

    // Execute the query
    const [result] = await pool.execute(
      `UPDATE templates SET ${updateParts.join(', ')} WHERE id = ?`,
      params
    );

    // Check if any rows were affected
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found or no changes made'
      });
    }

    res.json({
      success: true,
      message: 'Template updated successfully',
      templateId: templateId
    });

  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Route to update template metadata (name, description, category)
app.put('/api/update_template_metadata/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const { 
      name, 
      description, 
      category_id, 
      approvers, 
      template_approvers, 
      impact, 
      notes,
      locked_elements,
      allowAttachments,
      includeTableOfContents
    } = req.body;

    if (!templateId) {
      return res.status(400).json({ success: false, error: 'Template ID is required' });
    }

    let updateParts = [];
    let params = [];

    if (name !== undefined) {
      updateParts.push('name = ?');
      params.push(name);
    }

    if (description !== undefined) {
      updateParts.push('description = ?');
      params.push(description);
    }

    if (category_id !== undefined) {
      updateParts.push('category_id = ?');
      params.push(category_id);
    }

    if (notes !== undefined) {
      updateParts.push('notes = ?');
      params.push(notes);
    }

    if (approvers !== undefined) {
      updateParts.push('required_approvers = ?');
      params.push(safeJsonStringify(approvers));
    }

    if (template_approvers !== undefined) {
      updateParts.push('template_approvers = ?');
      params.push(safeJsonStringify(template_approvers));
    }

    if (impact !== undefined) {
      updateParts.push('impact = ?');
      params.push(safeJsonStringify(impact));
    }

    // Handle template structure updates
    let templateStructureUpdates = {};
    if (locked_elements !== undefined) templateStructureUpdates.locked_elements = locked_elements;
    if (allowAttachments !== undefined) templateStructureUpdates.allowAttachments = allowAttachments;
    if (includeTableOfContents !== undefined) templateStructureUpdates.includeTableOfContents = includeTableOfContents;

    if (Object.keys(templateStructureUpdates).length > 0) {
      const [currentTemplate] = await pool.execute(
        'SELECT template_structure FROM templates WHERE id = ?',
        [templateId]
      );

      let currentStructure = {};
      if (currentTemplate.length > 0 && currentTemplate[0].template_structure) {
        try {
          currentStructure = JSON.parse(currentTemplate[0].template_structure);
        } catch (e) {
          currentStructure = {};
        }
      }

      const updatedStructure = { ...currentStructure, ...templateStructureUpdates };
      updateParts.push('template_structure = ?');
      params.push(safeJsonStringify(updatedStructure));
    }

    if (updateParts.length === 0) {
      return res.status(400).json({ success: false, error: 'No metadata fields to update' });
    }

    updateParts.push('updated_at = CURRENT_TIMESTAMP');
    params.push(templateId);

    const [result] = await pool.execute(
      `UPDATE templates SET ${updateParts.join(', ')} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({
      success: true,
      message: 'Template metadata updated successfully',
      templateId
    });
  } catch (error) {
    console.error('Error updating template metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template metadata',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Real-time template content update endpoint for collaboration
app.put('/api/update_template_content/:templateId', authenticateToken, async (req, res) => {
  console.log('\n========= 💾 TEMPLATE SAVE REQUEST START =========');
  console.log('⏰ Time:', new Date().toISOString());

  try {
    const templateId = req.params.templateId;
    const { content, userId } = req.body;

    console.log('📝 Request details:', {
      templateId,
      userId,
      contentLength: content ? content.length : 0,
      contentPreview: content ? content.substring(0, 100) + '...' : 'No content',
      hasAuthHeader: !!req.headers.authorization,
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
      requestBodyKeys: Object.keys(req.body)
    });

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID is required'
      });
    }

    // Get current template data to understand the structure
    console.log('🔍 Querying database for template:', templateId);
    const [currentTemplate] = await pool.execute(
      'SELECT content, comments, template_approvers, status FROM templates WHERE id = ?',
      [templateId]
    );

    console.log('📁 Database query result:', {
      found: currentTemplate.length > 0,
      templateExists: !!currentTemplate[0],
      hasContent: currentTemplate[0] ? !!currentTemplate[0].content : false,
      hasComments: currentTemplate[0] ? !!currentTemplate[0].comments : false,
      currentContentLength: currentTemplate[0] ? (currentTemplate[0].content?.length || 0) : 0
    });

    if (currentTemplate.length === 0) {
      console.log('❌ Template not found in database:', templateId);
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Parse existing comments/suggestions or use provided ones
    let finalCommentsData = {};
    const commentsInput = req.body.comments;

    // Use provided comments data if available
    if (commentsInput) {
      try {
        finalCommentsData = typeof commentsInput === 'string' ? JSON.parse(commentsInput) : commentsInput;
        console.log('📦 Using provided comments data:', {
          commentsCount: finalCommentsData.comments?.length || 0,
          suggestionsCount: finalCommentsData.suggestions?.length || 0
        });
      } catch (e) {
        console.error('Error parsing input comments:', e);
      }
    }

    // If no valid input comments, fall back to existing DB comments
    if (!finalCommentsData.comments && !finalCommentsData.suggestions) {
      try {
        if (currentTemplate[0].comments) {
          const dbComments = JSON.parse(currentTemplate[0].comments);
          // If the DB has the newer structure { comments: [], suggestions: [] }
          if (dbComments.comments || dbComments.suggestions) {
            finalCommentsData = dbComments;
          } else {
            // Backward compatibility or empty
            finalCommentsData = { comments: [], suggestions: [] };
          }
        }
      } catch (e) {
        console.warn('Could not parse existing comments from DB:', e.message);
      }
    }

    // Parse existing DB comments for deep fallback
    let dbCommentsData = {};
    try {
      if (currentTemplate[0].comments) {
        dbCommentsData = typeof currentTemplate[0].comments === 'string'
          ? JSON.parse(currentTemplate[0].comments)
          : currentTemplate[0].comments;
      }
    } catch (e) {
      console.warn('Could not parse existing comments from DB:', e.message);
    }

    // Merge logic: use incoming data if present and not "empty", otherwise fall back to DB
    const updatedCommentsData = {
      content: content || finalCommentsData.content || dbCommentsData.content || '',
      comments: finalCommentsData.comments || dbCommentsData.comments || [],
      suggestions: finalCommentsData.suggestions || dbCommentsData.suggestions || [],
      references: finalCommentsData.references || dbCommentsData.references || [],
      manualReferences: finalCommentsData.manualReferences || dbCommentsData.manualReferences || [],
      headerHTML: (finalCommentsData.headerHTML && finalCommentsData.headerHTML.trim()) ? finalCommentsData.headerHTML : (dbCommentsData.headerHTML || ''),
      footerHTML: (finalCommentsData.footerHTML && finalCommentsData.footerHTML.trim()) ? finalCommentsData.footerHTML : (dbCommentsData.footerHTML || ''),
      logo: finalCommentsData.logo ? finalCommentsData.logo : (dbCommentsData.logo || null),
      logoText: (finalCommentsData.logoText && finalCommentsData.logoText.trim()) ? finalCommentsData.logoText : (dbCommentsData.logoText || ''),
      logoTextRight: (finalCommentsData.logoTextRight && finalCommentsData.logoTextRight.trim()) ? finalCommentsData.logoTextRight : (dbCommentsData.logoTextRight || ''),
      orientation: finalCommentsData.orientation || dbCommentsData.orientation || 'portrait',
      paperSize: finalCommentsData.paperSize || dbCommentsData.paperSize || 'A4',
      pagesState: finalCommentsData.pagesState || dbCommentsData.pagesState || null,
      lastModified: new Date().toISOString(),
      lastModifiedBy: userId
    };

    // Store content as a JSON object so it satisfies the json_valid CHECK constraint
    const contentJsonString = JSON.stringify({ content: content || '' });

    // Check if the user is a reviewer who previously marked it as reviewed
    let dbTemplateApprovers = currentTemplate[0].template_approvers;
    let dbStatus = currentTemplate[0].status;
    let shouldUpdateApprovers = false;

    const stripHtml = (html) => {
      if (!html) return '';
      return html
        .replace(/<\/?[p|div|br|tr|td|li][^>]*>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    let dbContent = '';
    if (currentTemplate[0].content) {
      try {
        const parsed = JSON.parse(currentTemplate[0].content);
        dbContent = parsed.content || '';
      } catch (e) {
        dbContent = currentTemplate[0].content;
      }
    }
    const isContentModified = stripHtml(content) !== stripHtml(dbContent);

    // Auto-revert reviewers: Only revert if content is actually being saved (isContentModified)
    // AND status is already "reviewed". Don't revert just because status is reviewed.
    if (dbTemplateApprovers && isContentModified && dbStatus === 'reviewed') {
      try {
        let parsedApprovers = typeof dbTemplateApprovers === 'string' ? JSON.parse(dbTemplateApprovers) : dbTemplateApprovers;
        let modified = false;

        // Fetch user email since reviewer objects often only contain email
        let userEmail = null;
        try {
          const [userRows] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
          if (userRows && userRows.length > 0) userEmail = userRows[0].email;
        } catch (err) {
          console.error("Error fetching user email for reviewer reset:", err);
        }

        if (parsedApprovers.reviewers && Array.isArray(parsedApprovers.reviewers)) {
          parsedApprovers.reviewers = parsedApprovers.reviewers.map(reviewer => {
            const isReviewed = reviewer.status && reviewer.status.toLowerCase() === 'reviewed';

            // Revert ANY reviewed reviewer back to pending (regardless of who is editing)
            if (isReviewed) {
              console.log(`[TemplateAutosave] Reverting reviewer ${reviewer.email || reviewer.name} from 'reviewed' to 'pending' due to content modification`);
              modified = true;
              return { ...reviewer, status: 'pending' };
            }
            return reviewer;
          });
        }

        if (modified) {
          dbTemplateApprovers = JSON.stringify(parsedApprovers);
          shouldUpdateApprovers = true;
          // Revert template status to pending_review if it was reviewed
          if (dbStatus === 'reviewed') {
            dbStatus = 'pending_review';
            console.log(`[TemplateAutosave] Reverting template status from 'reviewed' to 'pending_review' due to content modification`);
          }
        }
      } catch (e) {
        console.warn('Could not parse template_approvers for status reset:', e);
      }
    }

    let result;
    if (shouldUpdateApprovers) {
      [result] = await pool.execute(
        'UPDATE templates SET content = ?, comments = ?, template_approvers = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [contentJsonString, JSON.stringify(updatedCommentsData), dbTemplateApprovers, dbStatus, templateId]
      );

      // Attempt to emit socket event if io is available
      try {
        if (typeof io !== 'undefined') {
          io.to(`template-${templateId}`).emit('templateApproversUpdated', {
            templateId,
            template_approvers: JSON.parse(dbTemplateApprovers),
            status: dbStatus
          });
        }
      } catch (e) {
        console.warn('Could not emit socket event for approver update:', e);
      }
    } else {
      [result] = await pool.execute(
        'UPDATE templates SET content = ?, comments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [contentJsonString, JSON.stringify(updatedCommentsData), templateId]
      );
    }

    console.log('🧪 DB Update result:', { affectedRows: result.affectedRows, changedRows: result.changedRows });

    if (result.affectedRows === 0) {
      console.warn('⚠️ Template ID not found in UPDATE query:', templateId);
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    console.log('✅ Template updated successfully in DB');

    // Re-read the row to confirm persistence
    const [verifyRows] = await pool.execute(
      'SELECT content, comments, updated_at FROM templates WHERE id = ?',
      [templateId]
    );

    const persistedContent = verifyRows[0]?.content || '';
    console.log(`✅ Template content saved successfully:`, {
      templateId,
      requestedContentLength: content ? content.length : 0,
      persistedContentLength: persistedContent.length,
      commentsCount: updatedCommentsData.comments?.length || 0,
      suggestionsCount: updatedCommentsData.suggestions?.length || 0,
      updated_at: verifyRows[0]?.updated_at
    });

    const responseData = {
      success: true,
      message: 'Template content updated successfully',
      templateId: templateId,
      contentLength: (content || '').length,
      savedAt: new Date().toISOString(),
      persisted: true,
      status: dbStatus,
      template_approvers: typeof dbTemplateApprovers === 'string' ? JSON.parse(dbTemplateApprovers) : dbTemplateApprovers
    };

    console.log('✅ Sending success response:', responseData);
    console.log('=== TEMPLATE SAVE REQUEST END ===\n');

    res.json(responseData);

  } catch (error) {
    console.error('❌ Error updating template content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template content',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.put('/api/update_content/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const { comments } = req.body;

    // Validate template ID and comments
    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID'
      });
    }

    if (comments === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Comments data is required'
      });
    }

    // Also update the content field if the comments contain content
    let commentsData;
    try {
      commentsData = JSON.parse(comments);
    } catch (e) {
      commentsData = { content: "", comments: [] };
    }

    // If we have content in the comments data, update both fields
    if (commentsData && commentsData.content) {
      const [result] = await pool.execute(
        'UPDATE templates SET comments = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [comments, comments, templateId]
      );

      // Check if any rows were affected
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Template not found or no changes made'
        });
      }
    } else {
      // Otherwise just update comments
      const [result] = await pool.execute(
        'UPDATE templates SET comments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [comments, templateId]
      );

      // Check if any rows were affected
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Template not found or no changes made'
        });
      }
    }

    res.json({
      success: true,
      message: 'Comments updated successfully',
      templateId: templateId
    });

  } catch (error) {
    console.error('Error updating comments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update comments',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Review endpoint - Fixed
app.put('/api/template_review/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const { userId, userEmail, userName } = req.body;

    if (!templateId || !userId || !userEmail) {
      return res.status(400).json({
        success: false,
        error: 'Template ID and user information are required'
      });
    }

    // Get current template data
    const [templateResult] = await pool.execute(
      'SELECT template_approvers, status FROM templates WHERE id = ?',
      [templateId]
    );

    if (templateResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const currentTemplate = templateResult[0];

    // Parse template_approvers
    let templateApprovers = { reviewers: [], approvers: [] };
    try {
      templateApprovers = currentTemplate.template_approvers ?
        JSON.parse(currentTemplate.template_approvers) : { reviewers: [], approvers: [] };
    } catch (e) {
      console.error('Error parsing template_approvers:', e);
    }

    // Find and update reviewer status
    const reviewerIndex = templateApprovers.reviewers.findIndex(
      reviewer => reviewer.userId === userId || reviewer.email === userEmail
    );

    if (reviewerIndex === -1) {
      return res.status(403).json({
        success: false,
        error: 'User is not authorized to review this template'
      });
    }

    // Update reviewer status
    templateApprovers.reviewers[reviewerIndex] = {
      ...templateApprovers.reviewers[reviewerIndex],
      status: 'Reviewed',
      reviewedAt: new Date().toISOString()
    };

    // Check if all reviewers have reviewed
    const allReviewed = templateApprovers.reviewers.every(r => r.status === 'Reviewed');
    const newStatus = allReviewed ? 'reviewed' : 'pending_review';

    // Update template
    await pool.execute(
      `UPDATE templates 
       SET template_approvers = ?, 
           status = ?,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [JSON.stringify(templateApprovers), newStatus, templateId]
    );

    res.json({
      success: true,
      message: 'Template reviewed successfully',
      templateId: templateId,
      status: newStatus,
      templateApprovers: templateApprovers
    });

  } catch (error) {
    console.error('Error reviewing template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to review template',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Revert template reviewers status endpoint
app.put('/api/template_revert_reviewers/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID is required'
      });
    }

    // Get current template data
    const [templateResult] = await pool.execute(
      'SELECT template_approvers, status FROM templates WHERE id = ?',
      [templateId]
    );

    if (templateResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const currentTemplate = templateResult[0];

    // Parse template_approvers
    let templateApprovers = { reviewers: [], approvers: [] };
    try {
      templateApprovers = currentTemplate.template_approvers ?
        JSON.parse(currentTemplate.template_approvers) : { reviewers: [], approvers: [] };
    } catch (e) {
      console.error('Error parsing template_approvers:', e);
    }

    // Revert status from 'Reviewed' to 'pending'
    const targetEmails = req.body.emails;
    const shouldRevertAll = !targetEmails || !Array.isArray(targetEmails) || targetEmails.length === 0;

    let updated = false;
    if (templateApprovers.reviewers && Array.isArray(templateApprovers.reviewers)) {
      templateApprovers.reviewers = templateApprovers.reviewers.map(reviewer => {
        const matchesTarget = shouldRevertAll || targetEmails.includes(reviewer.email);
        if (matchesTarget && reviewer.status === 'Reviewed') {
          updated = true;
          const { reviewedAt, ...rest } = reviewer;
          return {
            ...rest,
            status: 'pending'
          };
        }
        return reviewer;
      });
    }

    // Update template status if we reverted any reviewer or if overall status was 'reviewed'
    let newStatus = currentTemplate.status;
    const hasAnyPendingReviewer = templateApprovers.reviewers && templateApprovers.reviewers.some(r => r.status === 'pending');
    if (hasAnyPendingReviewer && newStatus === 'reviewed') {
      newStatus = 'pending_review';
      updated = true;
    }

    if (updated) {
      await pool.execute(
        `UPDATE templates 
         SET template_approvers = ?, 
             status = ?,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [JSON.stringify(templateApprovers), newStatus, templateId]
      );
    }

    res.json({
      success: true,
      message: 'Template reviewers status reverted successfully',
      status: newStatus,
      templateApprovers: templateApprovers
    });

  } catch (error) {
    console.error('Error reverting template reviewers status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revert reviewers status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// Approve endpoint
app.put('/api/template_approve/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const { userId, userEmail, userName } = req.body;

    if (!templateId || !userId || !userEmail) {
      return res.status(400).json({
        success: false,
        error: 'Template ID and user information are required'
      });
    }

    // Get current template data
    const [templateResult] = await pool.execute(
      'SELECT template_approvers, status FROM templates WHERE id = ?',
      [templateId]
    );

    if (templateResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const currentTemplate = templateResult[0];

    // Parse template_approvers
    let templateApprovers = { reviewers: [], approvers: [] };
    try {
      templateApprovers = currentTemplate.template_approvers ?
        JSON.parse(currentTemplate.template_approvers) : { reviewers: [], approvers: [] };
    } catch (e) {
      console.error('Error parsing template_approvers:', e);
    }

    // Find and update approver status
    const approverIndex = templateApprovers.approvers.findIndex(
      approver => approver.userId === userId || approver.email === userEmail
    );

    if (approverIndex === -1) {
      return res.status(403).json({
        success: false,
        error: 'User is not authorized to approve this template'
      });
    }

    // Update approver status
    templateApprovers.approvers[approverIndex] = {
      ...templateApprovers.approvers[approverIndex],
      status: 'Approved',
      approvedAt: new Date().toISOString()
    };

    // Check if all approvers have approved
    const allApproved = templateApprovers.approvers.every(a => a.status === 'Approved');
    const newStatus = allApproved ? 'approved' : 'pending_approval';

    // Update template
    await pool.execute(
      `UPDATE templates 
       SET template_approvers = ?, 
           status = ?,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [JSON.stringify(templateApprovers), newStatus, templateId]
    );

    res.json({
      success: true,
      message: 'Template approved successfully',
      templateId: templateId,
      status: newStatus,
      templateApprovers: templateApprovers
    });

  } catch (error) {
    console.error('Error approving template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve template',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Reject endpoint
app.put('/api/template_reject/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const { userId, userEmail, userName, comment } = req.body;

    if (!templateId || !userId || !userEmail) {
      return res.status(400).json({
        success: false,
        error: 'Template ID and user information are required'
      });
    }

    // Get current template data
    const [templateResult] = await pool.execute(
      'SELECT template_approvers, status FROM templates WHERE id = ?',
      [templateId]
    );

    if (templateResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const currentTemplate = templateResult[0];

    // Parse template_approvers
    let templateApprovers = { reviewers: [], approvers: [] };
    try {
      templateApprovers = currentTemplate.template_approvers ?
        JSON.parse(currentTemplate.template_approvers) : { reviewers: [], approvers: [] };
    } catch (e) {
      console.error('Error parsing template_approvers:', e);
    }

    // Find and update approver status
    const approverIndex = templateApprovers.approvers.findIndex(
      approver => approver.userId === userId || approver.email === userEmail
    );

    if (approverIndex === -1) {
      return res.status(403).json({
        success: false,
        error: 'User is not authorized to reject this template'
      });
    }

    // Update approver status
    templateApprovers.approvers[approverIndex] = {
      ...templateApprovers.approvers[approverIndex],
      status: 'Rejected',
      rejectedAt: new Date().toISOString(),
      comment: comment || ''
    };

    const newStatus = currentTemplate.status;

    // Update template
    await pool.execute(
      `UPDATE templates 
       SET template_approvers = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [JSON.stringify(templateApprovers), templateId]
    );

    res.json({
      success: true,
      message: 'Template rejected successfully',
      templateId: templateId,
      status: newStatus,
      templateApprovers: templateApprovers
    });

  } catch (error) {
    console.error('Error rejecting template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject template',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update Template Status
app.put('/api/templates/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate template ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }

    // Validate status is provided and valid
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Update the template and return the updated record
    const [result] = await pool.query(
      'UPDATE templates SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    // Check if template was found and updated
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      message: 'Template status updated successfully',
    });

  } catch (error) {
    console.error('Error updating template status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Remove Template
app.delete('/api/remove_template/:templateId', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.params;

    // Soft delete - Update status to 'inactive'
    await pool.execute(
      'DELETE FROM templates WHERE status = ? AND id = ?',
      ['draft', templateId]
    );

    res.json({ message: 'Template removed successfully' });
  } catch (error) {
    console.error('Error removing template:', error);
    res.status(500).json({ error: 'Failed to remove template' });
  }
});

// ==================== REVISION HISTORY & AI ROUTES ====================

// Helper to clean HTML content for AI processing (token optimization)
const cleanContentForAI = (html) => {
  if (!html) return "";
  try {
    // If it's a JSON string, try to parse it first
    let content = html;
    if (typeof html === 'string' && (html.trim().startsWith('{') || html.trim().startsWith('['))) {
      try {
        const parsed = JSON.parse(html);
        if (parsed.content) content = parsed.content;
        else if (Array.isArray(parsed)) content = JSON.stringify(parsed);
      } catch (e) {
        // Not JSON or failed to parse, use as is
      }
    }

    // Simple regex to strip HTML tags
    let text = content.replace(/<[^>]*>?/gm, ' ');
    // Remove multiple spaces and newlines
    text = text.replace(/\s+/g, ' ').trim();
    // Limit length to avoid excessive token usage (e.g., first 10k chars)
    return text.substring(0, 10000);
  } catch (err) {
    console.error("Error cleaning content for AI:", err);
    return "";
  }
};

// Get Revision History for a template (using lineage-chain walking)
app.get('/api/templates/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get the target template first to obtain its lineage information
    const [targetTemplate] = await pool.execute(
      'SELECT id, name, organization_id, revision_parent_id, version FROM templates WHERE id = ?',
      [id]
    );

    if (!targetTemplate.length) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const target = targetTemplate[0];
    const { organization_id } = target;

    // Collect all template IDs in this lineage
    const lineageIds = new Set();
    lineageIds.add(target.id);

    // Walk UP to find the root and collect all ancestors
    let currentParentId = target.revision_parent_id;
    const MAX_DEPTH = 100;
    let depth = 0;

    while (currentParentId && depth < MAX_DEPTH) {
      lineageIds.add(currentParentId);
      const [parentRows] = await pool.execute(
        'SELECT id, revision_parent_id FROM templates WHERE id = ? AND organization_id = ?',
        [currentParentId, organization_id]
      );
      if (parentRows.length === 0) {
        break;
      }
      currentParentId = parentRows[0].revision_parent_id;
      depth++;
    }

    // Walk DOWN from all collected ancestors/target to find all descendants (children, grandchildren, etc.)
    let idsToExpand = Array.from(lineageIds);
    depth = 0;
    while (idsToExpand.length > 0 && depth < MAX_DEPTH) {
      const placeholders = idsToExpand.map(() => '?').join(',');
      const [childRows] = await pool.execute(
        `SELECT id FROM templates 
         WHERE revision_parent_id IN (${placeholders}) AND organization_id = ?`,
        [...idsToExpand, organization_id]
      );

      const newChildren = [];
      for (const row of childRows) {
        if (!lineageIds.has(row.id)) {
          lineageIds.add(row.id);
          newChildren.push(row.id);
        }
      }
      idsToExpand = newChildren;
      depth++;
    }

    // Fetch all details for these specific templates in the lineage
    const idPlaceholders = Array.from(lineageIds).map(() => '?').join(',');
    const [history] = await pool.execute(
      `SELECT t.id, t.version, t.status, t.updated_at, t.ai_change_summary, t.revision_parent_id,
              u.first_name, u.last_name
       FROM templates t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id IN (${idPlaceholders})
       ORDER BY t.version DESC, t.updated_at DESC`,
      Array.from(lineageIds)
    );

    res.json(history);
  } catch (error) {
    console.error('Error fetching template history:', error);
    res.status(500).json({ error: 'Failed to fetch revision history' });
  }
});

// Generate AI Summary for a template revision (Manual Trigger)
app.post('/api/templates/:id/generate-ai-summary', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get the current template and its parent ID
    const [currentRows] = await pool.execute(
      'SELECT content, comments, revision_parent_id, version, ai_change_summary FROM templates WHERE id = ?',
      [id]
    );

    if (!currentRows.length) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const currentTemplate = currentRows[0];

    // If it's Version 1 or has no parent, we don't need a summary
    if (currentTemplate.version <= 1 || !currentTemplate.revision_parent_id) {
      return res.status(400).json({ error: 'AI summary is only available for revised versions (v2+)' });
    }

    // If summary already exists, return it
    if (currentTemplate.ai_change_summary) {
      return res.json({ summary: currentTemplate.ai_change_summary });
    }

    // 2. Get the parent template's content
    const [parentRows] = await pool.execute(
      'SELECT content, comments FROM templates WHERE id = ?',
      [currentTemplate.revision_parent_id]
    );

    if (!parentRows.length) {
      return res.status(404).json({ error: 'Parent version not found' });
    }

    const parentTemplate = parentRows[0];

    // 3. Prepare content for Gemini
    const extractContent = (tmpl) => {
      let html = "";
      if (tmpl.comments) {
        try {
          const parsed = JSON.parse(tmpl.comments);
          if (parsed.content) html = parsed.content;
        } catch (e) { }
      }
      if (!html && tmpl.content) {
        try {
          const parsed = JSON.parse(tmpl.content);
          html = parsed.content || tmpl.content;
        } catch (e) {
          html = tmpl.content;
        }
      }
      return html;
    };

    const oldContent = extractContent(parentTemplate);
    const newContent = extractContent(currentTemplate);

    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is missing from environment');
      return res.status(503).json({ error: 'AI service not configured (API key missing)' });
    }

    // 4. Call Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Using gemini-2.5-flash as requested. Explicitly setting API version to v1 for stability.
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }, { apiVersion: 'v1' });

    const prompt = `
      Compare the following two versions of a document template and generate a concise, human-readable summary of the changes introduced in the new version.
      Focus on added sections, removed paragraphs, updated requirements, or modified terminology.
      Format the response as a bulleted list.
      
      New Version Content:
      "${cleanContentForAI(newContent)}"
      
      Previous Version Content:
      "${cleanContentForAI(oldContent)}"
      
      Summary of changes in the New Version:
    `;

    console.log('Sending request to Gemini 2.5 Flash...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();
    console.log('AI summary generated successfully');

    // 5. Save the summary
    await pool.execute(
      'UPDATE templates SET ai_change_summary = ? WHERE id = ?',
      [summary, id]
    );

    // 6. Add Audit Record
    try {
      const [templateInfo] = await pool.execute('SELECT organization_id, name FROM templates WHERE id = ?', [id]);
      if (templateInfo.length) {
        await dbOps.addAuditRecord(
          templateInfo[0].organization_id,
          req.user.userId,
          'AI_SUMMARY_GENERATED',
          null, // document_id is null for templates
          JSON.stringify({ templateId: id, templateName: templateInfo[0].name, version: currentTemplate.version }),
          req.ip
        );
      }
    } catch (auditErr) {
      console.error('Failed to add audit record for AI summary:', auditErr);
    }

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error generating AI summary:', error);

    // Check for networking errors
    if (error.message && error.message.includes('fetch failed')) {
      return res.status(502).json({
        error: 'Connection to AI service failed. This is likely a network issue or the Google API service is temporarily unavailable.',
        details: error.stack
      });
    }

    // Enhanced error handling for Gemini API
    if (error.status === 429) {
      return res.status(429).json({
        error: 'AI Quota exceeded. Google Gemini API rate limit reached. Please wait a few minutes and try again.',
        details: error.message
      });
    }

    if (error.status === 404) {
      return res.status(404).json({
        error: 'AI Model (gemini-2.5-flash) not found or not supported for this API key. Please verify model availability in your region.',
        details: error.message
      });
    }

    res.status(500).json({ error: 'Failed to generate AI summary', details: error.message, stack: error.stack });
  }
});

// ==================== DEPARTMENTS ROUTES ====================

// Route Get Departments
app.get('/api/departments/:orgId', authenticateToken, async (req, res) => {
  try {
    const { orgId } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM departments WHERE organization_id = ? ORDER BY name',
      [orgId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Add new department
app.post('/api/add_department/:orgId', authenticateToken, async (req, res) => {
  try {
    const { name, manager } = req.body;
    const { orgId } = req.params;
    const status = 'active';

    // Check if department already exists
    const [existing] = await pool.query(
      'SELECT id FROM departments WHERE organization_id = ? AND name = ?',
      [orgId, name]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Department already exists' });
    }

    // Insert new department
    await pool.query(
      'INSERT INTO departments (organization_id, name, manager, status) VALUES (?, ?, ?, ?)',
      [orgId, name, manager, status]
    );

    // Also update manager's department in users table
    if (manager) {
      await pool.query(
        'UPDATE users SET department = ? WHERE id = ? AND organization_id = ?',
        [name, manager, orgId]
      );
    }

    // Return success without the created object (since we'll refetch)
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error adding department:', error);
    res.status(500).json({ error: 'Failed to add department' });
  }
});

// Edit department
app.put('/api/edit_department/:deptId', authenticateToken, async (req, res) => {
  try {
    const { name, manager, status, orgId } = req.body;
    const { deptId } = req.params;

    // Validate input
    if (!name) {
      return res.status(400).json({ error: 'Name are required' });
    }

    // Update existing department
    await pool.query(
      'UPDATE departments SET name = ?, manager = ?, status = ? WHERE id = ? AND organization_id = ?',
      [name, manager, status, deptId, orgId]
    );

    // Also update manager's department in users table
    if (manager) {
      await pool.query(
        'UPDATE users SET department = ? WHERE id = ? AND organization_id = ?',
        [name, manager, orgId]
      );
    }

    // Return success
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// Route Get Sites
app.get('/api/sites/:orgId', authenticateToken, async (req, res) => {
  try {
    const { orgId } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM sites WHERE organization_id = ? ORDER BY name',
      [orgId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// Add new site
app.post('/api/add_site/:orgId', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const { orgId } = req.params;
    const status = 'active';

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check if site already exists
    const [existing] = await pool.query(
      'SELECT id FROM sites WHERE organization_id = ? AND name = ?',
      [orgId, name]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Site already exists' });
    }

    // Insert new site
    await pool.query(
      'INSERT INTO sites (organization_id, name, status) VALUES (?, ?, ?)',
      [orgId, name, status]
    );

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error adding site:', error);
    res.status(500).json({ error: 'Failed to add site' });
  }
});

// Edit site
app.put('/api/edit_site/:siteId', authenticateToken, async (req, res) => {
  try {
    const { name, status, orgId } = req.body;
    const { siteId } = req.params;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Update existing site
    await pool.query(
      'UPDATE sites SET name = ?, status = ? WHERE id = ? AND organization_id = ?',
      [name, status, siteId, orgId]
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating site:', error);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

// Bulk invite multiple organization members
app.post('/api/invite_multiple_org_members/:orgId', authenticateToken, async (req, res) => {
  try {
    const { emails, role, department, message, site } = req.body;
    const { orgId } = req.params;
    const status = 'invited';

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'At least one email is required' });
    }

    // Get organization name
    const [orgs] = await pool.execute(
      'SELECT name FROM organizations WHERE id = ?',
      [orgId]
    );

    if (orgs.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    const orgName = orgs[0].name;

    const invitedEmails = [];
    const failedEmails = [];

    for (const email of emails) {
      try {
        // Check if user already exists
        const [existingUsers] = await pool.execute(
          'SELECT id FROM invited_users WHERE email = ?',
          [email]
        );

        if (existingUsers.length > 0) {
          failedEmails.push({ email, error: 'User already exists' });
          continue;
        }

        const userId = await dbOps.inviteUser(orgId, email, role, department, message, status, site);

        // Generate invitation token with encrypted data
        const invitationToken = generateInvitationToken({
          email,
          role,
          department,
          site,
          orgId
        });

        // Create invitation link
        const invitationLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/join/${invitationToken}`;

        // Send email invitation
        await transporter.sendMail({
          from: process.env.FROM_EMAIL || 'noreply@example.com',
          to: email,
          subject: `Invitation to join ${orgName}`,
          html: `
            <h1>You've been invited to join ${orgName}</h1>
            <p>${message || 'Please join our organization by clicking the link below:'}</p>
            <p><a href="${invitationLink}">Click here to accept the invitation</a></p>
            <p>This invitation link will expire in 7 days.</p>
          `
        });

        invitedEmails.push(email);
      } catch (err) {
        console.error(`Error inviting ${email}:`, err);
        failedEmails.push({ email, error: err.message });
      }
    }

    res.status(201).json({
      success: true,
      invited: invitedEmails,
      failed: failedEmails,
      message: `${invitedEmails.length} team members invited successfully. ${failedEmails.length} failed.`
    });
  } catch (error) {
    console.error('Error in bulk inviting:', error);
    res.status(500).json({ error: 'Failed to process bulk invitations' });
  }
});

// ==================== TEMPLATE CATEGORIES ROUTES ====================

// Get all template categories for an organization
app.get('/api/template_categories/:orgId', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.params.orgId;

    const query = `
      SELECT category_id, organization_id, category_name, category_prefix, folder_path, parent_category_id
      FROM template_categories
      WHERE organization_id = ?
      ORDER BY category_name
    `;

    const [categories] = await pool.execute(query, [organizationId]);

    // Calculate folder paths based on parent-child relationships
    categories.forEach(category => {
      if (!category.folder_path) {
        category.folder_path = buildFolderPath(category, categories);
      }
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching template categories:', error);
    res.status(500).json({ error: 'Failed to fetch template categories' });
  }
});

// Create a new template category
app.post('/api/add_category/:orgId', authenticateToken, async (req, res) => {
  try {
    const { category_name, category_prefix, parent_category_id } = req.body;
    const organization_id = parseInt(req.params.orgId);

    if (!category_name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Insert new category
      const insertQuery = `
        INSERT INTO template_categories 
        (organization_id, category_name, category_prefix, parent_category_id, folder_path)
        VALUES (?, ?, ?, ?, '')
      `;

      const [result] = await connection.execute(insertQuery, [
        organization_id,
        category_name,
        category_prefix,
        parent_category_id || null
      ]);

      const category_id = result.insertId;

      // Calculate and update folder path
      const folder_path = await calculateFolderPath(category_id, parent_category_id, connection);

      const updatePathQuery = `
        UPDATE template_categories
        SET folder_path = ?
        WHERE category_id = ?
      `;

      await connection.execute(updatePathQuery, [folder_path, category_id]);

      // Commit transaction
      await connection.commit();
      connection.release();

      res.status(201).json({
        category_id,
        organization_id,
        category_name,
        category_prefix,
        parent_category_id: parent_category_id || null,
        folder_path
      });
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error creating template category:', error);
    res.status(500).json({ error: 'Failed to create template category' });
  }
});

// Update a template category
app.put('/api/update_category/:orgId', authenticateToken, async (req, res) => {
  try {
    const { categoryId, category_name, category_prefix, parent_category_id } = req.body;
    const organization_id = req.params.orgId;

    if (!category_name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Check if category exists and belongs to the organization
    const checkQuery = `
      SELECT category_id FROM template_categories 
      WHERE category_id = ? AND organization_id = ?
    `;

    const [existingCategories] = await pool.execute(checkQuery, [categoryId, organization_id]);

    if (existingCategories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Prevent circular reference - a category cannot be its own parent
    if (parent_category_id && parent_category_id.toString() === categoryId.toString()) {
      return res.status(400).json({ error: 'A category cannot be its own parent' });
    }

    // Check for circular references in the hierarchy
    if (parent_category_id) {
      const isCircular = await checkCircularReference(categoryId, parent_category_id);
      if (isCircular) {
        return res.status(400).json({ error: 'Circular reference detected in category hierarchy' });
      }
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Update the category
      const updateQuery = `
        UPDATE template_categories
        SET category_name = ?, category_prefix = ?, parent_category_id = ?
        WHERE category_id = ? AND organization_id = ?
      `;

      await connection.execute(updateQuery, [
        category_name,
        category_prefix,
        parent_category_id || null,
        categoryId,
        organization_id
      ]);

      // Calculate and update folder path
      const folder_path = await calculateFolderPath(categoryId, parent_category_id, connection);

      const updatePathQuery = `
        UPDATE template_categories
        SET folder_path = ?
        WHERE category_id = ?
      `;

      await connection.execute(updatePathQuery, [folder_path, categoryId]);

      // Update paths of all child categories
      await updateChildrenPaths(categoryId, connection);

      // Commit transaction
      await connection.commit();
      connection.release();

      res.json({
        category_id: parseInt(categoryId),
        organization_id,
        category_name,
        category_prefix,
        parent_category_id: parent_category_id || null,
        folder_path
      });
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error updating template category:', error);
    res.status(500).json({ error: 'Failed to update template category' });
  }
});

// Delete a template category
app.delete('/api/delete_category', authenticateToken, async (req, res) => {
  try {
    const { categoryId, organization_id } = req.body;
    console.log(organization_id, categoryId);

    // Check if category exists and belongs to the organization
    const checkQuery = `
      SELECT category_id FROM template_categories 
      WHERE category_id = ? AND organization_id = ?
    `;

    const [existingCategories] = await pool.execute(checkQuery, [categoryId, organization_id]);

    if (existingCategories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if category has templates
    const templateCheckQuery = `
      SELECT id FROM templates 
      WHERE category_id = ? AND organization_id = ?
      LIMIT 1
    `;

    const [existingTemplates] = await pool.execute(templateCheckQuery, [categoryId, organization_id]);

    if (existingTemplates.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete category that contains templates. Move or delete the templates first.'
      });
    }

    // Check if category has subcategories
    const subcategoryCheckQuery = `
      SELECT category_id FROM template_categories 
      WHERE parent_category_id = ?
      LIMIT 1
    `;

    const [existingSubcategories] = await pool.execute(subcategoryCheckQuery, [categoryId]);

    if (existingSubcategories.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete category that has subcategories. Delete or move subcategories first.'
      });
    }

    // Delete the category
    const deleteQuery = `
      DELETE FROM template_categories
      WHERE category_id = ? AND organization_id = ?
    `;

    await pool.execute(deleteQuery, [categoryId, organization_id]);

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting template category:', error);
    res.status(500).json({ error: 'Failed to delete template category' });
  }
});

// Invite new team member
app.post('/api/invite_org_member/:orgId', authenticateToken, async (req, res) => {
  try {
    const { email, role, department, message, site } = req.body;
    console.log(req.body);
    // Validation
    if (!email) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM invited_users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const { orgId } = req.params;
    const status = 'invited';

    const userId = await dbOps.inviteUser(orgId, email, role, department, message, status, site);

    // Get organization name
    const [orgs] = await pool.execute(
      'SELECT name FROM organizations WHERE id = ?',
      [orgId]
    );

    if (orgs.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const orgName = orgs[0].name;

    // Generate invitation token with encrypted data
    const invitationToken = generateInvitationToken({
      email,
      role,
      department,
      site,
      orgId
    });

    // Create invitation link
    const invitationLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/join/${invitationToken}`;

    // Send email invitation
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || 'noreply@example.com',
      to: email,
      subject: `Invitation to join ${orgName}`,
      html: `
        <h1>You've been invited to join ${orgName}</h1>
        <p>${message || 'Please join our organization by clicking the link below:'}</p>
        <p><a href="${invitationLink}">Click here to accept the invitation</a></p>
        <p>This invitation link will expire in 7 days.</p>
      `
    });

    res.status(201).json({
      id: userId,
      link: invitationLink,
      message: 'Team member invited successfully'
    });
  } catch (error) {
    console.error('Error inviting team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Remove Invited User
app.delete('/api/cancel_invite/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Soft delete - Update status to 'inactive'
    await pool.execute(
      'DELETE FROM invited_users WHERE status = ? AND id = ?',
      ['invited', userId]
    );

    res.json({ message: 'Invited user removed successfully' });
  } catch (error) {
    console.error('Error removing invited user:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// Approve Invited User
app.post('/api/approve_invite/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // 2. Fix the query to get a single row and destructure properly
    const [rows] = await pool.execute(
      'SELECT * FROM invited_users WHERE status = ? AND id = ?',
      ['pending', userId]
    );

    // 3. Check if user exists
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invited user not found or already approved' });
    }

    const userData = rows[0];

    // 4. Fix variable naming conflict (userId is already declared)
    const template_approver = 'no';
    const newUserId = await dbOps.registerUser(
      userData.organization_id,
      userData.email,
      userData.password_hash,
      userData.first_name,
      userData.last_name,
      userData.role,
      userData.department,
      template_approver,
      'active',
      userData.site
    );

    // 5. Delete the invitation after successful registration
    await pool.execute(
      'DELETE FROM invited_users WHERE id = ?',
      [userId]
    );

    res.json({
      message: 'Invited user approved successfully',
      userId: newUserId
    });
  } catch (error) {
    console.error('Error approving invited user:', error);
    res.status(500).json({ error: 'Failed to approve team member' });
  }
});

// Reject Invited User
app.delete('/api/reject_invite/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Soft delete - Update status to 'inactive'
    await pool.execute(
      'DELETE FROM invited_users WHERE status = ? AND id = ?',
      ['pending', userId]
    );

    res.json({ message: 'Invited user removed successfully' });
  } catch (error) {
    console.error('Error removing invited user:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// Add new team member
app.post('/api/add_org_member/:orgId', authenticateToken, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, department, template_approver, site } = req.body;
    console.log(req.body);
    // Validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',

      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const { orgId } = req.params;

    const userId = await dbOps.registerUser(orgId, email, password, firstName, lastName, role, department, template_approver, 'active', site);

    res.status(201).json({
      id: userId,
      message: 'Team member added successfully'
    });
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Edit team member
app.put('/api/edit_org_member/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email, role, department, template_approver, status, site } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !status) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Update user profile
    await dbOps.updateUserProfile(userId, {
      firstName,
      lastName,
      email,
      department,
      template_approver,
      status,
      site
    });

    await dbOps.changeUserRole(userId, role);

    res.json({ message: 'Team member updated successfully' });
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

// Remove team member
app.delete('/api/del_org_member/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Don't allow self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    // Soft delete - Update status to 'inactive'
    await pool.execute(
      'UPDATE users SET status = ? WHERE id = ?',
      ['inactive', userId]
    );

    res.json({ message: 'Team member removed successfully' });
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// Change team member password (admin only)
app.put('/team/:userId/password', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Valid password required (min 8 characters)' });
    }

    // Check if user exists and belongs to same organization
    const [users] = await pool.execute(
      'SELECT u1.organization_id FROM users u1 JOIN users u2 ON u1.organization_id = u2.organization_id WHERE u1.id = ? AND u2.id = ?',
      [req.user.id, userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found or not in your organization' });
    }

    // Update password
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.execute(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, userId]
    );

    // Add audit record (don't include the actual password in audit)
    await dbOps.addAuditRecord(
      users[0].organization_id,
      req.user.id,
      'password_reset',
      null,
      `Password reset for user ${userId}`,
      req.ip
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Create a new document
app.post('/api/create-document', authenticateToken, async (req, res) => {
  const {
    title,
    template_id,
    content,
    tasks: tasksRaw,
    participants: participantsRaw,
    comments,
    suggestedEdits,
    headerHTML,
    footerHTML,
    status: statusRaw,
    approvers: approversBody,
    required_approvers: requiredApproversBody,
    version: versionRaw,
    revision_parent_id,
    tempAttachments,
    impact
  } = req.body;
  const docVersion = parseInt(versionRaw, 10) || 1;
  const tasks = tasksRaw || [];
  const participants = participantsRaw || [];
  console.log(content);

  const userId = req.user.userId;
  const allowedStatuses = ['draft', 'pending_review', 'pending_approval'];
  let docStatus = typeof statusRaw === 'string' ? statusRaw.trim() : 'draft';
  if (!allowedStatuses.includes(docStatus)) {
    docStatus = 'draft';
  }

  let workflowJson = null;
  if (approversBody && (docStatus === 'pending_review' || docStatus === 'pending_approval')) {
    try {
      workflowJson =
        typeof approversBody === 'string' ? approversBody : JSON.stringify(approversBody);
    } catch (e) {
      workflowJson = null;
    }
  }

  let finalRequiredApprovers = requiredApproversBody || null;

  try {
    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Get user's organization
      const [orgResults] = await connection.execute(
        'SELECT organization_id FROM users WHERE id = ?',
        [userId]
      );

      if (orgResults.length === 0) {
        throw new Error('User not found');
      }

      const orgId = orgResults[0].organization_id;

      // 2. Fetch template data if template_id is provided
      let finalWorkflowJson = workflowJson;
      let tplOrientation = 'portrait';
      let tplPaperSize = 'A4';
      let tplPagesState = null;
      if (template_id) {
        const [templateRows] = await connection.execute(
          'SELECT required_approvers, template_approvers, custom_document_approvers, comments FROM templates WHERE id = ?',
          [template_id]
        );
        if (templateRows.length > 0) {
          const tplRow = templateRows[0];
          if (tplRow.comments) {
            try {
              const parsedTplComments = typeof tplRow.comments === 'string' ? JSON.parse(tplRow.comments) : tplRow.comments;
              if (parsedTplComments?.orientation) tplOrientation = parsedTplComments.orientation;
              if (parsedTplComments?.paperSize) tplPaperSize = parsedTplComments.paperSize;
              if (parsedTplComments?.pagesState) tplPagesState = parsedTplComments.pagesState;
            } catch (e) {}
          }

          // Check if custom_document_approvers is set by admin
          if (tplRow.custom_document_approvers) {
            try {
              const parsedCustom = typeof tplRow.custom_document_approvers === 'string'
                ? JSON.parse(tplRow.custom_document_approvers)
                : tplRow.custom_document_approvers;

              if (Array.isArray(parsedCustom) && parsedCustom.length > 0) {
                let customApproversList = [];
                let selectedSet = null;
                
                // If it's the new format (array of sets)
                if (parsedCustom[0].name !== undefined) {
                  let selectedSetId = null;
                  if (finalWorkflowJson) {
                    try {
                      const wfObj = typeof finalWorkflowJson === 'string' ? JSON.parse(finalWorkflowJson) : finalWorkflowJson;
                      selectedSetId = wfObj?.selectedSetId;
                    } catch (e) {}
                  }
                  selectedSet = parsedCustom.find(s => s.id === selectedSetId) || parsedCustom[0];
                  customApproversList = selectedSet.departments || [];
                } else {
                  customApproversList = parsedCustom;
                }

                // Set required departments
                if (!finalRequiredApprovers) {
                  const customDepts = customApproversList.map((item, idx) => ({
                    key: idx,
                    department: item.department,
                    mandatory: true,
                    stage: item.stage || 1
                  }));
                  finalRequiredApprovers = JSON.stringify(customDepts);
                }

                // Set workflow reviewers and approvers
                if (!finalWorkflowJson) {
                  const customReviewers = [];
                  const customApprovers = [];
                  customApproversList.forEach(item => {
                    if (Array.isArray(item.users)) {
                      item.users.forEach(u => {
                        customReviewers.push({
                          userId: u.id,
                          name: u.name || `${u.first_name} ${u.last_name}`,
                          email: u.email,
                          department: u.department || item.department || '',
                          role: 'document_reviewer',
                          status: 'pending'
                        });
                        customApprovers.push({
                          userId: u.id,
                          name: u.name || `${u.first_name} ${u.last_name}`,
                          email: u.email,
                          department: u.department || item.department || '',
                          role: 'document_approver',
                          status: 'pending',
                          comment: ''
                        });
                      });
                    }
                  });

                  finalWorkflowJson = JSON.stringify({
                    reviewers: customReviewers,
                    approvers: customApprovers,
                    selectedSetId: selectedSet ? selectedSet.id : 'default',
                    selectedSetName: selectedSet ? selectedSet.name : 'Default Set',
                    selectedSetComment: selectedSet ? selectedSet.comment : ''
                  });
                }
              }
            } catch (e) {
              console.error('Error parsing custom_document_approvers in create-document endpoint:', e);
            }
          }

          // Copy departmental approver config (required_approvers) from the template
          if (!finalRequiredApprovers && tplRow.required_approvers) {
            finalRequiredApprovers = tplRow.required_approvers;
          }

          // Copy the template's reviewer/approver workflow (template_approvers) into the
          // document's approvers column so documents inherit the full approver config.
          // Only do this if the caller has not already supplied an explicit workflow.
          if (!finalWorkflowJson && tplRow.template_approvers) {
            // template_approvers has shape {reviewers:[...], approvers:[...]} — use it directly
            finalWorkflowJson = tplRow.template_approvers;
          } else if (!finalWorkflowJson && tplRow.required_approvers) {
            // Legacy fallback: use department list as workflow seed
            finalWorkflowJson = tplRow.required_approvers;
          }
        }
      }

      // 3. Create the document
      const docId = uuidv4();
      await connection.execute(
        `INSERT INTO documents 
        (document_id, organization_id, title, template_id, created_by, status, content, elements, approvers, required_approvers, version, revision_parent_id, impact) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          docId,
          orgId,
          title,
          template_id,
          userId,
          docStatus,
          JSON.stringify(content || {}),
          JSON.stringify({
            comments: comments || [],
            suggestedEdits: suggestedEdits || [],
            headerHTML: headerHTML || '',
            footerHTML: footerHTML || '',
            logo: req.body.logo || null,
            logoText: req.body.logoText || '',
            logoTextRight: req.body.logoTextRight || '',
            orientation: req.body.orientation || tplOrientation || 'portrait',
            paperSize: req.body.paperSize || tplPaperSize || 'A4',
            pagesState: req.body.pagesState || tplPagesState || null
          }),
          finalWorkflowJson,
          finalRequiredApprovers ? (typeof finalRequiredApprovers === 'string' ? finalRequiredApprovers : JSON.stringify(finalRequiredApprovers)) : null,
          docVersion,
          revision_parent_id || null,
          impact ? JSON.stringify(impact) : null
        ]
      );

      // 3. Handle permissions - CRITICAL FIX HERE
      // First remove any duplicate creator entries from participants
      const filteredParticipants = participants.filter(p => p.user_id !== userId);

      // Then create permissions in one batch
      const permissionRecords = [
        [docId, userId, 'author', userId, 'active'], // Creator permission
        ...filteredParticipants.map(p => [
          docId, p.user_id, p.role, userId, 'active'
        ])
      ];

      const grantedUserIds = new Set([userId, ...filteredParticipants.map(p => p.user_id)]);

      // 4. Grant permissions to specific reviewers/approvers
      if (approversBody && (docStatus === 'pending_review' || docStatus === 'pending_approval')) {
        try {
          const wf = typeof approversBody === 'string' ? JSON.parse(approversBody) : approversBody;
          for (const row of wf.reviewers || []) {
            const uid = row.userId ?? row.id;
            if (uid == null || grantedUserIds.has(uid)) continue;
            permissionRecords.push([docId, uid, 'reviewer', userId, 'active']);
            grantedUserIds.add(uid);
          }
          for (const row of wf.approvers || []) {
            const uid = row.userId ?? row.id;
            if (uid == null || grantedUserIds.has(uid)) continue;
            permissionRecords.push([docId, uid, 'approver', userId, 'active']);
            grantedUserIds.add(uid);
          }
        } catch (e) {
          console.warn('create-document workflow permissions', e);
        }
      }

      // 5. Grant permissions to all users in departments listed in required_approvers (from finalWorkflowJson)
      if (finalWorkflowJson) {
        try {
          const parsedWorkflow = typeof finalWorkflowJson === 'string' ? JSON.parse(finalWorkflowJson) : finalWorkflowJson;
          
          // If it's an array, it's the required_approvers format [{department, stage, mandatory}]
          if (Array.isArray(parsedWorkflow)) {
            const deptNames = parsedWorkflow.map(item => item.department).filter(Boolean);
            if (deptNames.length > 0) {
              const [deptUsers] = await connection.query(
                'SELECT id FROM users WHERE organization_id = ? AND department IN (?) AND status = "active"',
                [orgId, deptNames]
              );
              
              for (const u of deptUsers) {
                if (!grantedUserIds.has(u.id)) {
                  permissionRecords.push([docId, u.id, 'viewer', userId, 'active']);
                  grantedUserIds.add(u.id);
                }
              }
            }
          }
        } catch (e) {
          console.warn('Error granting departmental permissions:', e);
        }
      }

      await connection.query(
        `INSERT INTO documentpermissions 
        (document_id, user_id, permission_type, assigned_by, status) 
        VALUES ?`,
        [permissionRecords]
      );

      // 6. Create tasks if any
      if (tasks && tasks.length > 0) {
        for (const task of tasks) {
          const [taskResult] = await connection.execute(
            `INSERT INTO tasks 
            (organization_id, document_id, title, description, created_by, due_date, status) 
            VALUES (?, ?, ?, ?, ?, ?, 'not_started')`,
            [orgId, docId, task.title, task.description, task.created_by, task.due_date]
          );
          const taskId = taskResult.insertId;

          // Assign task to creator by default (can be reassigned later)
          await connection.execute(
            `INSERT INTO taskassignments 
            (task_id, assigned_to, assigned_by, status) 
            VALUES (?, ?, ?, 'pending')`,
            [taskId, userId, userId]
          );
        }
      }

      // 5. Clone attachments if this is a revision or created from template
      if (revision_parent_id) {
        try {
          const [parentAttachments] = await connection.execute(
            'SELECT * FROM attachments WHERE association_type = "document" AND association_id = ?',
            [revision_parent_id]
          );
          for (const attachment of parentAttachments) {
            const oldFilePath = path.join(uploadsDir, attachment.file_path);
            if (fs.existsSync(oldFilePath)) {
              const uniqueId = uuidv4();
              const newServerFileName = `${uniqueId}-${attachment.file_name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
              const newFilePath = path.join(uploadsDir, newServerFileName);
              fs.copyFileSync(oldFilePath, newFilePath);

              await connection.execute(
                'INSERT INTO attachments (association_type, association_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['document', docId, attachment.file_name, newServerFileName, attachment.file_type, attachment.file_size, userId]
              );
            }
          }
          console.log(`✅ Copied attachments from parent document ${revision_parent_id} to new revised document ${docId}`);
        } catch (copyErr) {
          console.error('Error copying parent document attachments:', copyErr);
        }
      } else if (template_id) {
        try {
          const [templateAttachments] = await connection.execute(
            'SELECT * FROM attachments WHERE association_type = "template" AND association_id = ?',
            [template_id]
          );
          for (const attachment of templateAttachments) {
            const oldFilePath = path.join(uploadsDir, attachment.file_path);
            if (fs.existsSync(oldFilePath)) {
              const uniqueId = uuidv4();
              const newServerFileName = `${uniqueId}-${attachment.file_name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
              const newFilePath = path.join(uploadsDir, newServerFileName);
              fs.copyFileSync(oldFilePath, newFilePath);

              await connection.execute(
                'INSERT INTO attachments (association_type, association_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['document', docId, attachment.file_name, newServerFileName, attachment.file_type, attachment.file_size, userId]
              );
            }
          }
          console.log(`✅ Copied attachments from template ${template_id} to new document ${docId}`);
        } catch (copyErr) {
          console.error('Error copying template attachments:', copyErr);
        }
      }

      // 6. Process new uploaded attachments if provided
      if (Array.isArray(tempAttachments) && tempAttachments.length > 0) {
        try {
          const ids = tempAttachments
            .map(t => (typeof t === 'object' && t !== null) ? t.id : t)
            .filter(id => id && !String(id).startsWith('temp-'));

          if (ids.length > 0) {
            await connection.execute(
              `UPDATE attachments SET association_type = 'document', association_id = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
              [docId, ...ids]
            );
            console.log(`✅ Associated ${ids.length} temp attachments to new document ${docId}`);
          }
        } catch (attachErr) {
          console.error('Error saving temp document attachments:', attachErr);
        }
      }

      // Commit transaction
      await connection.commit();
      connection.release();

      res.status(201).json({
        success: true,
        document_id: docId,
        message: 'Document created successfully'
      });

    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create document'
    });
  }
});

// Update document status
app.put('/api/update-document-status/:documentId', authenticateToken, async (req, res) => {
  const { documentId } = req.params;
  const { status } = req.body;
  const userId = req.user.userId;

  try {
    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Verify user has permission to update this document
      const [permissionResults] = await connection.execute(
        `SELECT permission_type FROM documentpermissions 
         WHERE document_id = ? AND user_id = ? AND status = 'active'`,
        [documentId, userId]
      );

      if (permissionResults.length === 0) {
        throw new Error('You do not have permission to update this document');
      }

      const permissionType = permissionResults[0].permission_type;

      // 2. Validate status transition based on permission type
      const validTransitions = {
        'author': ['in_review', 'for_approval', 'published'],
      };

      if (!validTransitions[permissionType]?.includes(status)) {
        throw new Error(`User with ${permissionType} role cannot set status to ${status}`);
      }

      // 3. Update document status
      await connection.execute(
        `UPDATE documents SET status = ?, updated_at = NOW()
         WHERE document_id = ?`,
        [status, documentId]
      );

      // Commit transaction
      await connection.commit();
      connection.release();

      res.status(200).json({
        success: true,
        message: `Document status updated to ${status} successfully`
      });
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error updating document status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update document status'
    });
  }
});

async function syncDocumentApproversWithTemplate(document) {
  if (!document || !document.template_id) return document;
  try {
    const [templateRows] = await pool.execute(
      'SELECT custom_document_approvers FROM templates WHERE id = ?',
      [document.template_id]
    );
    if (templateRows.length > 0 && templateRows[0].custom_document_approvers) {
      const customApproversRaw = typeof templateRows[0].custom_document_approvers === 'string'
        ? JSON.parse(templateRows[0].custom_document_approvers)
        : templateRows[0].custom_document_approvers;

      if (Array.isArray(customApproversRaw) && customApproversRaw.length > 0) {
        // Parse document's current workflow to see which set was selected
        let currentWorkflow = { reviewers: [], approvers: [] };
        if (document.approvers) {
          try {
            currentWorkflow = typeof document.approvers === 'string'
              ? JSON.parse(document.approvers)
              : document.approvers;
          } catch (e) {}
        }

        let customApproversList = [];
        // Check if it's the new format (array of sets)
        if (customApproversRaw[0].name !== undefined) {
          const selectedSetId = currentWorkflow.selectedSetId;
          const selectedSet = customApproversRaw.find(s => s.id === selectedSetId) || customApproversRaw[0];
          customApproversList = selectedSet.departments || [];
        } else {
          // Legacy format
          customApproversList = customApproversRaw;
        }

        // Build list of valid departments from template's custom config
        const validDepts = new Set(customApproversList.map(item => item.department));

        // Helper to sync role arrays (reviewers or approvers)
        const syncRoleList = (currentList) => {
          return currentList;
        };

        const newReviewers = syncRoleList(currentWorkflow.reviewers || []);
        const newApprovers = syncRoleList(currentWorkflow.approvers || []);

        const newWorkflow = {
          ...currentWorkflow,
          reviewers: newReviewers,
          approvers: newApprovers
        };

        // Update document required_approvers departments list too
        let newRequired = [];
        if (document.required_approvers) {
          try {
            newRequired = typeof document.required_approvers === 'string'
              ? JSON.parse(document.required_approvers)
              : document.required_approvers;
          } catch (e) {}
        }
        if (!Array.isArray(newRequired)) newRequired = [];
        
        // Build unique departments from current custom list
        const currentDepts = customApproversList.map(item => item.department);
        // Re-map/sync required_approvers departments
        const updatedRequired = currentDepts.map((dept, idx) => {
          const existingDept = newRequired.find(d => d.department === dept);
          const templateDept = customApproversList.find(c => c.department === dept);
          return {
            key: existingDept?.key ?? idx,
            department: dept,
            mandatory: true,
            stage: existingDept?.stage ?? templateDept?.stage ?? 1
          };
        });

        // Update in DB so it's persisted
        const workflowJsonStr = JSON.stringify(newWorkflow);
        const requiredJsonStr = JSON.stringify(updatedRequired);
        
        await pool.execute(
          'UPDATE documents SET approvers = ?, required_approvers = ? WHERE document_id = ?',
          [workflowJsonStr, requiredJsonStr, document.document_id]
        );

        // Also grant/revoke permissions in documentpermissions table
        await grantDocumentWorkflowPermissions(document.document_id, newWorkflow, document.created_by);

        // Revoke permissions for users who were removed and status is still pending
        const allCurrentUniqueUserIds = new Set([
          ...newReviewers.map(r => String(r.userId)),
          ...newApprovers.map(a => String(a.userId))
        ]);

        // Deactivate permission rows for users no longer in the workflow (excluding the author)
        const [permRows] = await pool.execute(
          'SELECT user_id FROM documentpermissions WHERE document_id = ? AND status = "active" AND permission_type != "author"',
          [document.document_id]
        );
        for (const row of permRows) {
          if (!allCurrentUniqueUserIds.has(String(row.user_id))) {
            await pool.execute(
              'UPDATE documentpermissions SET status = "inactive" WHERE document_id = ? AND user_id = ? AND permission_type != "author"',
              [document.document_id, row.user_id]
            );
          }
        }

        // Update returned document object
        document.approvers = workflowJsonStr;
        document.required_approvers = requiredJsonStr;
      }
    }
  } catch (err) {
    console.error('Error syncing template custom approvers with document:', err);
  }
  return document;
}

app.get('/api/documents/:id', async (req, res) => {
  try {
    const docId = req.params.id;
    let document = await dbOps.getDocumentById(docId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    document = await syncDocumentApproversWithTemplate(document);
    res.json(normalizeDocumentRowForClient(document));
  } catch (error) {
    console.error('Document fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// ==================== Document workflow (parallel to templates; uses documents.approvers JSON) ====================

async function grantDocumentWorkflowPermissions(documentId, workflowInput, assignedByUserId) {
  if (workflowInput === undefined || workflowInput === null) return;
  let wf = workflowInput;
  if (typeof wf === 'string') {
    try {
      wf = JSON.parse(wf);
    } catch (e) {
      return;
    }
  }
  if (!wf || typeof wf !== 'object') return;
  const [docRows] = await pool.execute('SELECT created_by FROM documents WHERE document_id = ?', [
    documentId
  ]);
  const creatorId = docRows[0]?.created_by;

  const grant = async (userIds, permissionType) => {
    for (const uid of userIds) {
      if (uid == null || uid === creatorId) continue;
      const [existing] = await pool.execute(
        `SELECT id FROM documentpermissions WHERE document_id = ? AND user_id = ? AND status = 'active'`,
        [documentId, uid]
      );
      if (existing.length > 0) continue;
      await pool.execute(
        `INSERT INTO documentpermissions (document_id, user_id, permission_type, assigned_by, status) VALUES (?, ?, ?, ?, 'active')`,
        [documentId, uid, permissionType, assignedByUserId]
      );
    }
  };

  const reviewerIds = (wf.reviewers || []).map((r) => r.userId ?? r.id).filter((id) => id != null);
  const approverIds = (wf.approvers || []).map((a) => a.userId ?? a.id).filter((id) => id != null);
  await grant(reviewerIds, 'reviewer');
  await grant(approverIds, 'approver');
}

async function assertUserDocumentAccess(documentId, userId) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM documents d
     LEFT JOIN documentpermissions dp ON d.document_id = dp.document_id AND dp.user_id = ? AND dp.status = 'active'
     WHERE d.document_id = ? AND (d.created_by = ? OR dp.user_id IS NOT NULL)
     LIMIT 1`,
    [userId, documentId, userId]
  );
  if (rows.length > 0) return true;

  // Backward-compatibility fallback:
  // older workflow documents may have approvers JSON but missing permission rows.
  try {
    const [[userRow]] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
    const [docRows] = await pool.execute('SELECT approvers FROM documents WHERE document_id = ?', [documentId]);
    if (!docRows.length) return false;
    const approversRaw = docRows[0]?.approvers;
    if (!approversRaw) return false;
    const wf = typeof approversRaw === 'string' ? JSON.parse(approversRaw) : approversRaw;
    const reviewers = Array.isArray(wf?.reviewers) ? wf.reviewers : [];
    const approvers = Array.isArray(wf?.approvers) ? wf.approvers : [];
    const people = [...reviewers, ...approvers];
    const email = String(userRow?.email || '').toLowerCase();
    return people.some((p) => {
      const byId = String(p?.userId ?? p?.id ?? '') === String(userId);
      const byEmail = email && String(p?.email || '').toLowerCase() === email;
      return byId || byEmail;
    });
  } catch (e) {
    console.warn('assertUserDocumentAccess fallback parse error:', e);
    return false;
  }
}

function normalizeDocumentRowForClient(row) {
  if (!row) return null;
  let elements = {};
  try {
    elements = row.elements ? (typeof row.elements === 'string' ? JSON.parse(row.elements) : row.elements) : {};
  } catch (e) {
    elements = {};
  }
  let contentRaw = row.content;
  let contentObj = {};
  try {
    contentObj = typeof contentRaw === 'string' ? JSON.parse(contentRaw || '{}') : contentRaw || {};
  } catch (e) {
    contentObj = { content: typeof contentRaw === 'string' ? contentRaw : '' };
  }

  const parseMaybeJsonString = (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    // Sometimes HTML is saved as a JSON string literal: "\"<p>...</p>\""
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        return value;
      }
    }
    return value;
  };

  const resolvedContentObj = parseMaybeJsonString(contentObj);
  const resolvedRaw = parseMaybeJsonString(contentRaw);
  
  // Enforce pure JSON block array or HTML string model
  const jsonBlocksContent =
    (resolvedContentObj &&
      typeof resolvedContentObj === 'object' &&
      (Array.isArray(resolvedContentObj.content) || typeof resolvedContentObj.content === 'string') &&
      resolvedContentObj.content) ||
    (Array.isArray(resolvedContentObj) || typeof resolvedContentObj === 'string' ? resolvedContentObj : (Array.isArray(resolvedRaw) || typeof resolvedRaw === 'string' ? resolvedRaw : []));

  const virtualComments = JSON.stringify({
    content: jsonBlocksContent,
    comments: elements.comments || [],
    suggestions: elements.suggestedEdits || elements.suggestions || [],
    references: elements.references || [],
    manualReferences: elements.manualReferences || [],
    headerHTML: elements.headerHTML || '',
    footerHTML: elements.footerHTML || '',
    logo: elements.logo ?? null,
    logoText: elements.logoText || '',
    logoTextRight: elements.logoTextRight || '',
    orientation: elements.orientation || contentObj?.orientation || 'portrait',
    paperSize: elements.paperSize || contentObj?.paperSize || 'A4',
    pagesState: elements.pagesState || contentObj?.pagesState || null
  });

  let template_approvers = { reviewers: [], approvers: [] };
  try {
    if (row.approvers) {
      const a = typeof row.approvers === 'string' ? JSON.parse(row.approvers) : row.approvers;
      // Only accept the {reviewers, approvers} workflow shape; ignore legacy array format
      if (a && !Array.isArray(a) && (a.reviewers !== undefined || a.approvers !== undefined)) {
        template_approvers = {
          reviewers: Array.isArray(a.reviewers) ? a.reviewers : [],
          approvers: Array.isArray(a.approvers) ? a.approvers : []
        };
      }
    }
  } catch (e) {
    /* ignore */
  }

  return {
    ...row,
    id: row.document_id,
    document_id: row.document_id,
    name: row.title,
    title: row.title,
    comments: virtualComments,
    orientation: elements.orientation || contentObj?.orientation || 'portrait',
    paperSize: elements.paperSize || contentObj?.paperSize || 'A4',
    pagesState: elements.pagesState || contentObj?.pagesState || null,
    template_approvers,
    template_structure: {
      locked_elements: {},
      allowAttachments: false,
      includeTableOfContents: false
    },
    description: null,
    notes: row.notes || null,
    category_id: null,
    version: row.current_revision ?? 1,
    required_approvers: row.required_approvers ? (typeof row.required_approvers === 'string' ? JSON.parse(row.required_approvers) : row.required_approvers) : []
  };
}

app.get('/api/get_document/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const userId = req.user.userId;
    const ok = await assertUserDocumentAccess(documentId, userId);
    if (!ok) return res.status(403).json({ error: 'Access denied' });
    let row = await dbOps.getDocumentById(documentId);
    if (!row) return res.status(404).json({ error: 'Document not found' });
    row = await syncDocumentApproversWithTemplate(row);
    res.json(normalizeDocumentRowForClient(row));
  } catch (error) {
    console.error('get_document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

app.put('/api/documents/:documentId/workflow-status', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { status } = req.body;
    const userId = req.user.userId;
    if (!documentId || !status) {
      return res.status(400).json({ success: false, message: 'documentId and status required' });
    }
    const ok = await assertUserDocumentAccess(documentId, userId);
    if (!ok) return res.status(403).json({ success: false, message: 'Access denied' });
    const [result] = await pool.execute(
      'UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
      [status, documentId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    res.json({ success: true, message: 'Document status updated' });
  } catch (error) {
    console.error('workflow-status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

// Update Document Status (replicated from /api/templates/:id/status)
app.put('/api/documents/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Document ID is required'
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const [result] = await pool.query(
      'UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    res.json({
      success: true,
      message: 'Document status updated successfully',
    });

  } catch (error) {
    console.error('Error updating document status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Check if a newer published version of a document is available (revision chain walking)
// Replicated from /api/template-update-notice/:documentId
app.get('/api/document-update-notice/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;

    // 1. Get the document info
    const [docs] = await pool.execute(
      'SELECT document_id, title, version, status, revision_parent_id FROM documents WHERE document_id = ?',
      [documentId]
    );

    if (!docs.length) {
      return res.json({ hasNewerVersion: false });
    }

    const originalDocument = docs[0];

    // 2. Walk the FULL revision chain to find the latest published version.
    //    v1 -> v2 -> v3 -> ... -> vN
    //    We keep following until no more children exist, tracking the
    //    most recent published node we encounter along the way.
    let currentId = documentId;
    let latestPublished = null;
    const MAX_DEPTH = 50; // safety cap

    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      const [children] = await pool.execute(
        `SELECT document_id, title, version, status FROM documents
         WHERE revision_parent_id = ?
         ORDER BY version DESC LIMIT 1`,
        [currentId]
      );

      if (!children.length) break; // end of chain

      const child = children[0];
      currentId = child.document_id;

      // Track the furthest published/revised version we encounter
      if (child.status === 'published' || child.status === 'revised') {
        latestPublished = child;
      }
    }

    if (!latestPublished || latestPublished.document_id === documentId) {
      return res.json({ hasNewerVersion: false });
    }

    return res.json({
      hasNewerVersion: true,
      newDocument: {
        id: latestPublished.document_id,
        title: latestPublished.title,
        version: latestPublished.version,
      },
      oldDocument: {
        id: documentId,
        title: originalDocument.title,
        version: originalDocument.version,
      }
    });
  } catch (error) {
    console.error('Error checking document update notice:', error);
    res.status(500).json({ error: 'Failed to check document update' });
  }
});

// Update document template_id reference
app.put('/api/documents/:documentId/update-template-reference', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { templateId } = req.body;
    if (!documentId || !templateId) {
      return res.status(400).json({ error: 'documentId and templateId are required' });
    }
    const userId = req.user.userId;
    const ok = await assertUserDocumentAccess(documentId, userId);
    if (!ok) return res.status(403).json({ error: 'Access denied' });

    await pool.execute(
      'UPDATE documents SET template_id = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
      [templateId, documentId]
    );

    res.json({ success: true, message: 'Document template reference updated successfully' });
  } catch (error) {
    console.error('Error updating template reference:', error);
    res.status(500).json({ error: 'Failed to update template reference' });
  }
});

app.put('/api/update_document/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const userId = req.user.userId;
    const ok = await assertUserDocumentAccess(documentId, userId);
    if (!ok) return res.status(403).json({ success: false, error: 'Access denied' });

    const {
      title,
      content,
      elements,
      approvers,
      required_approvers,
      status,
      cover_page_data,
      version,
      revision_parent_id,
      impact,
      notes
    } = req.body;

    const updateParts = [];
    const params = [];

    if (title !== undefined) {
      updateParts.push('title = ?');
      params.push(title);
    }
    if (content !== undefined) {
      updateParts.push('content = ?');
      params.push(safeJsonStringify(content));
    }
    if (elements !== undefined) {
      updateParts.push('elements = ?');
      params.push(safeJsonStringify(elements));
    }
    if (approvers !== undefined) {
      updateParts.push('approvers = ?');
      params.push(safeJsonStringify(approvers));
    }
    if (required_approvers !== undefined) {
      updateParts.push('required_approvers = ?');
      params.push(safeJsonStringify(required_approvers));
    }
    if (status !== undefined) {
      updateParts.push('status = ?');
      params.push(status);
    }
    if (cover_page_data !== undefined) {
      updateParts.push('cover_page_data = ?');
      params.push(safeJsonStringify(cover_page_data));
    }
    if (version !== undefined) {
      updateParts.push('version = ?');
      params.push(parseInt(version, 10) || 1);
    }
    if (revision_parent_id !== undefined) {
      updateParts.push('revision_parent_id = ?');
      params.push(revision_parent_id || null);
    }
    if (impact !== undefined) {
      updateParts.push('impact = ?');
      params.push(safeJsonStringify(impact));
    }
    if (notes !== undefined) {
      updateParts.push('notes = ?');
      params.push(notes);
    }

    if (updateParts.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updateParts.push('updated_at = CURRENT_TIMESTAMP');
    params.push(documentId);

    const [result] = await pool.execute(
      `UPDATE documents SET ${updateParts.join(', ')} WHERE document_id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    if (approvers !== undefined) {
      await grantDocumentWorkflowPermissions(documentId, approvers, userId);
    }
    res.json({ success: true, message: 'Document updated', documentId });
  } catch (error) {
    console.error('update_document error:', error);
    res.status(500).json({ success: false, error: 'Failed to update document' });
  }
});

app.put('/api/update_document_content/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const userId = req.user.userId;
    const { content, comments: commentsInput } = req.body;

    console.log(`[DocumentSave] Request received:`, {
      documentId,
      userId,
      hasContent: !!content,
      hasComments: !!commentsInput
    });

    const ok = await assertUserDocumentAccess(documentId, userId);
    if (!ok) return res.status(403).json({ success: false, error: 'Access denied' });

    const [rows] = await pool.execute(
      'SELECT content, elements, approvers, status FROM documents WHERE document_id = ?',
      [documentId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    let finalCommentsData = {};
    if (commentsInput) {
      try {
        finalCommentsData =
          typeof commentsInput === 'string' ? JSON.parse(commentsInput) : commentsInput;
      } catch (e) {
        console.error('parse commentsInput', e);
      }
    }

    // Parse existing DB elements for deep fallback
    let dbElements = {};
    try {
      if (rows[0].elements) {
        dbElements = typeof rows[0].elements === 'string'
          ? JSON.parse(rows[0].elements)
          : rows[0].elements;
      }
    } catch (e) {
      console.warn('Could not parse existing elements from DB:', e.message);
    }

    // Guard: Prevent saving empty content over existing non-empty content to prevent data loss
    let incomingBlocks = '';
    if (content) {
      try {
        incomingBlocks = typeof content === 'string' ? JSON.parse(content) : content;
      } catch (e) {
        incomingBlocks = content;
      }
    } else if (finalCommentsData.content) {
      incomingBlocks = finalCommentsData.content;
    }
    if (!Array.isArray(incomingBlocks) && typeof incomingBlocks !== 'string') incomingBlocks = '';

    let existingDbContent = '';
    if (rows[0].content) {
      try {
        const parsedObj = JSON.parse(rows[0].content);
        existingDbContent = parsedObj.content;
      } catch (e) {
        existingDbContent = rows[0].content;
      }
    }
    if (!existingDbContent && dbElements.content) {
      existingDbContent = dbElements.content;
    }

    const hasDbContent = existingDbContent && (existingDbContent.length > 0 || (Array.isArray(existingDbContent) && existingDbContent.length > 0));
    const hasIncomingContent = incomingBlocks && (incomingBlocks.length > 0 || (Array.isArray(incomingBlocks) && incomingBlocks.length > 0));

    if (hasDbContent && !hasIncomingContent) {
      console.warn(`[DocumentSave] Rejecting empty save payload for document ${documentId} to prevent data loss.`);
      return res.status(400).json({ success: false, error: 'Rejecting empty save payload to prevent data loss' });
    }

    // Merge logic: use incoming data if present and not "empty", otherwise fall back to DB
    const updatedCommentsData = {
      content: hasIncomingContent ? incomingBlocks : (existingDbContent || ''),
      comments: finalCommentsData.comments || dbElements.comments || [],
      suggestions: finalCommentsData.suggestions || dbElements.suggestedEdits || [],
      references: finalCommentsData.references || dbElements.references || [],
      manualReferences: finalCommentsData.manualReferences || dbElements.manualReferences || [],
      headerHTML: (finalCommentsData.headerHTML && finalCommentsData.headerHTML.trim()) ? finalCommentsData.headerHTML : (dbElements.headerHTML || ''),
      footerHTML: (finalCommentsData.footerHTML && finalCommentsData.footerHTML.trim()) ? finalCommentsData.footerHTML : (dbElements.footerHTML || ''),
      logo: finalCommentsData.logo ? finalCommentsData.logo : (dbElements.logo || null),
      logoText: (finalCommentsData.logoText && finalCommentsData.logoText.trim()) ? finalCommentsData.logoText : (dbElements.logoText || ''),
      logoTextRight: (finalCommentsData.logoTextRight && finalCommentsData.logoTextRight.trim()) ? finalCommentsData.logoTextRight : (dbElements.logoTextRight || ''),
      orientation: finalCommentsData.orientation || dbElements.orientation || 'portrait',
      paperSize: finalCommentsData.paperSize || dbElements.paperSize || 'A4',
      pagesState: finalCommentsData.pagesState || dbElements.pagesState || null,
      lastModified: new Date().toISOString(),
      lastModifiedBy: userId
    };

    const newElements = {
      ...dbElements,
      comments: updatedCommentsData.comments,
      suggestedEdits: updatedCommentsData.suggestions,
      references: updatedCommentsData.references,
      manualReferences: updatedCommentsData.manualReferences,
      headerHTML: updatedCommentsData.headerHTML,
      footerHTML: updatedCommentsData.footerHTML,
      logo: updatedCommentsData.logo,
      logoText: updatedCommentsData.logoText,
      logoTextRight: updatedCommentsData.logoTextRight,
      orientation: updatedCommentsData.orientation || dbElements.orientation || 'portrait',
      paperSize: updatedCommentsData.paperSize || dbElements.paperSize || 'A4',
      pagesState: updatedCommentsData.pagesState || dbElements.pagesState || null,
      content: updatedCommentsData.content
    };

    const contentJsonString = JSON.stringify({ content: incomingBlocks.length > 0 ? incomingBlocks : updatedCommentsData.content });

    let dbApprovers = rows[0].approvers;
    let dbStatus = rows[0].status;
    let shouldUpdateApprovers = false;

    const stripHtml = (html) => {
      if (!html) return '';
      return html
        .replace(/<\/?[p|div|br|tr|td|li][^>]*>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    let dbContent = '';
    if (rows[0].content) {
      try {
        const parsed = JSON.parse(rows[0].content);
        dbContent = typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content || '');
      } catch (e) {
        dbContent = typeof rows[0].content === 'string' ? rows[0].content : JSON.stringify(rows[0].content || '');
      }
    }
    const incomingContent = content || updatedCommentsData.content || '';
    const incomingContentStr = typeof incomingContent === 'string' ? incomingContent : JSON.stringify(incomingContent);
    const isContentModified = stripHtml(incomingContentStr) !== stripHtml(dbContent);

    if (dbApprovers && isContentModified) {
      try {
        let parsedApprovers = typeof dbApprovers === 'string' ? JSON.parse(dbApprovers) : dbApprovers;
        let modified = false;
        let userEmail = null;
        try {
          const [userRows] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
          if (userRows && userRows.length > 0) userEmail = userRows[0].email;
        } catch (err) {
          console.error('email fetch', err);
        }

        if (parsedApprovers.reviewers && Array.isArray(parsedApprovers.reviewers)) {
          parsedApprovers.reviewers = parsedApprovers.reviewers.map((reviewer) => {
            const isMatchingId =
              String(reviewer.userId) === String(userId) || String(reviewer.id) === String(userId);
            const isMatchingEmail =
              userEmail && reviewer.email && reviewer.email.toLowerCase() === userEmail.toLowerCase();
            const isMatchingUser = isMatchingId || isMatchingEmail;
            const isReviewed = reviewer.status && reviewer.status.toLowerCase() === 'reviewed';

            if (isMatchingUser && isReviewed) {
              console.log(`[DocumentSave] REVERTING status for reviewer ${reviewer.email || reviewer.name} to pending`);
              modified = true;
              return { ...reviewer, status: 'pending' };
            }
            return reviewer;
          });
        }

        if (modified) {
          dbApprovers = JSON.stringify(parsedApprovers);
          shouldUpdateApprovers = true;
          // Revert document status to pending_review if it was reviewed
          // (matches template behavior — only revert review status, never approval)
          if (dbStatus === 'reviewed') {
            console.log(`[DocumentSave] REVERTING overall status to pending_review`);
            dbStatus = 'pending_review';
          }
        }
      } catch (e) {
        console.warn('approvers parse', e);
      }
    }

    console.log(`[DocumentSave] Final state to save:`, {
      shouldUpdateApprovers,
      dbStatus,
      modified: !!shouldUpdateApprovers
    });

    let result;
    if (shouldUpdateApprovers) {
      [result] = await pool.execute(
        'UPDATE documents SET content = ?, elements = ?, approvers = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
        [contentJsonString, JSON.stringify(newElements), dbApprovers, dbStatus, documentId]
      );
    } else {
      [result] = await pool.execute(
        'UPDATE documents SET content = ?, elements = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
        [contentJsonString, JSON.stringify(newElements), documentId]
      );
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    res.json({
      success: true,
      message: 'Document content updated',
      documentId,
      status: dbStatus,
      template_approvers: typeof dbApprovers === 'string' ? JSON.parse(dbApprovers) : dbApprovers,
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('update_document_content error:', error);
    res.status(500).json({ success: false, error: 'Failed to update document content' });
  }
});

app.put('/api/document_review/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const { userId, userEmail } = req.body;
    if (!documentId || !userId || !userEmail) {
      return res.status(400).json({ success: false, error: 'Document ID and user information are required' });
    }
    const [docResult] = await pool.execute(
      'SELECT approvers, status FROM documents WHERE document_id = ?',
      [documentId]
    );
    if (docResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    let workflow = { reviewers: [], approvers: [] };
    try {
      workflow = docResult[0].approvers ? JSON.parse(docResult[0].approvers) : workflow;
    } catch (e) {
      console.error('parse approvers', e);
    }
    const reviewerIndex = workflow.reviewers.findIndex(
      (r) => r.userId === userId || r.email === userEmail
    );
    if (reviewerIndex === -1) {
      return res.status(403).json({ success: false, error: 'User is not authorized to review this document' });
    }
    const reviewerDept = workflow.reviewers[reviewerIndex].department;
    if (reviewerDept) {
      workflow.reviewers = workflow.reviewers.map((r) => {
        if (r.department === reviewerDept && r.status === 'pending') {
          return {
            ...r,
            status: 'Reviewed',
            reviewedAt: new Date().toISOString()
          };
        }
        return r;
      });
    } else {
      workflow.reviewers[reviewerIndex] = {
        ...workflow.reviewers[reviewerIndex],
        status: 'Reviewed',
        reviewedAt: new Date().toISOString()
      };
    }
    const allReviewed = workflow.reviewers.every((r) => r.status === 'Reviewed');
    const newStatus = allReviewed ? 'reviewed' : 'pending_review';
    await pool.execute(
      'UPDATE documents SET approvers = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
      [JSON.stringify(workflow), newStatus, documentId]
    );
    res.json({
      success: true,
      message: 'Document reviewed successfully',
      documentId,
      status: newStatus,
      template_approvers: workflow
    });
  } catch (error) {
    console.error('document_review error:', error);
    res.status(500).json({ success: false, error: 'Failed to review document' });
  }
});

app.put('/api/document_approve/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const { userId, userEmail } = req.body;
    if (!documentId || !userId || !userEmail) {
      return res.status(400).json({ success: false, error: 'Document ID and user information are required' });
    }
    const [docResult] = await pool.execute(
      'SELECT approvers, status, revision_parent_id, required_approvers FROM documents WHERE document_id = ?',
      [documentId]
    );
    if (docResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    let workflow = { reviewers: [], approvers: [] };
    try {
      workflow = docResult[0].approvers ? JSON.parse(docResult[0].approvers) : workflow;
    } catch (e) {
      console.error('parse approvers', e);
    }
    const approverIndex = workflow.approvers.findIndex(
      (a) => a.userId === userId || a.email === userEmail
    );
    if (approverIndex === -1) {
      return res.status(403).json({ success: false, error: 'User is not authorized to approve this document' });
    }

    // Stage validation
    const approverDept = workflow.approvers[approverIndex].department;
    if (approverDept) {
      let requiredApprovers = [];
      if (docResult[0].required_approvers) {
        try {
          requiredApprovers = typeof docResult[0].required_approvers === 'string'
            ? JSON.parse(docResult[0].required_approvers)
            : docResult[0].required_approvers;
        } catch (e) {}
      }

      if (Array.isArray(requiredApprovers)) {
        const deptConfig = requiredApprovers.find(r => r.department === approverDept);
        if (deptConfig) {
          const userStage = deptConfig.stage || 1;
          const isDeptCompleted = (deptName) => {
            const deptApprovers = workflow.approvers.filter(a => a.department === deptName);
            if (deptApprovers.length === 0) return true;
            return deptApprovers.some(a => a.status === 'Approved');
          };
          const isBlocked = requiredApprovers.some(r => {
            const stage = r.stage || 1;
            if (stage < userStage) {
              return !isDeptCompleted(r.department);
            }
            return false;
          });
          if (isBlocked) {
            return res.status(403).json({ success: false, error: 'Currently, a different stage department is working on the approval.' });
          }
        }
      }
    }

    if (approverDept) {
      workflow.approvers = workflow.approvers.map((a) => {
        if (a.department === approverDept && a.status === 'pending') {
          return {
            ...a,
            status: 'Approved',
            approvedAt: new Date().toISOString()
          };
        }
        return a;
      });
    } else {
      workflow.approvers[approverIndex] = {
        ...workflow.approvers[approverIndex],
        status: 'Approved',
        approvedAt: new Date().toISOString()
      };
    }
    const allApproved = workflow.approvers.every((a) => a.status === 'Approved');
    const newStatus = allApproved ? 'approved' : 'pending_approval';
    await pool.execute(
      'UPDATE documents SET approvers = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
      [JSON.stringify(workflow), newStatus, documentId]
    );
    res.json({
      success: true,
      message: 'Document approved successfully',
      documentId,
      status: newStatus,
      template_approvers: workflow
    });
  } catch (error) {
    console.error('document_approve error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve document' });
  }
});

app.put('/api/document_reject/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const { userId, userEmail, comment } = req.body;
    if (!documentId || !userId || !userEmail) {
      return res.status(400).json({ success: false, error: 'Document ID and user information are required' });
    }
    const [docResult] = await pool.execute(
      'SELECT approvers, status, required_approvers FROM documents WHERE document_id = ?',
      [documentId]
    );
    if (docResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    let workflow = { reviewers: [], approvers: [] };
    try {
      workflow = docResult[0].approvers ? JSON.parse(docResult[0].approvers) : workflow;
    } catch (e) {
      console.error('parse approvers', e);
    }
    const approverIndex = workflow.approvers.findIndex(
      (a) => a.userId === userId || a.email === userEmail
    );
    if (approverIndex === -1) {
      return res.status(403).json({ success: false, error: 'User is not authorized to reject this document' });
    }

    // Stage validation
    const approverDept = workflow.approvers[approverIndex].department;
    if (approverDept) {
      let requiredApprovers = [];
      if (docResult[0].required_approvers) {
        try {
          requiredApprovers = typeof docResult[0].required_approvers === 'string'
            ? JSON.parse(docResult[0].required_approvers)
            : docResult[0].required_approvers;
        } catch (e) {}
      }

      if (Array.isArray(requiredApprovers)) {
        const deptConfig = requiredApprovers.find(r => r.department === approverDept);
        if (deptConfig) {
          const userStage = deptConfig.stage || 1;
          const isDeptCompleted = (deptName) => {
            const deptApprovers = workflow.approvers.filter(a => a.department === deptName);
            if (deptApprovers.length === 0) return true;
            return deptApprovers.some(a => a.status === 'Approved');
          };
          const isBlocked = requiredApprovers.some(r => {
            const stage = r.stage || 1;
            if (stage < userStage) {
              return !isDeptCompleted(r.department);
            }
            return false;
          });
          if (isBlocked) {
            return res.status(403).json({ success: false, error: 'Currently, a different stage department is working on the approval.' });
          }
        }
      }
    }

    workflow.approvers[approverIndex] = {
      ...workflow.approvers[approverIndex],
      status: 'Rejected',
      rejectedAt: new Date().toISOString(),
      comment: comment || ''
    };

    const newStatus = docResult[0].status;

    await pool.execute(
      'UPDATE documents SET approvers = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
      [JSON.stringify(workflow), documentId]
    );
    res.json({
      success: true,
      message: 'Document rejected successfully',
      documentId,
      status: newStatus,
      template_approvers: workflow
    });
  } catch (error) {
    console.error('document_reject error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject document' });
  }
});


app.put('/api/documents/:documentId/reassign', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const { currentUserId, newUser } = req.body;
    
    if (!documentId || !currentUserId || !newUser || !newUser.id) {
      return res.status(400).json({ success: false, error: 'Required fields are missing' });
    }

    // Fetch document
    const [docResult] = await pool.execute(
      'SELECT approvers, status, created_by, required_approvers FROM documents WHERE document_id = ?',
      [documentId]
    );
    if (docResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const docRow = docResult[0];
    let workflow = { reviewers: [], approvers: [] };
    try {
      workflow = docRow.approvers ? JSON.parse(docRow.approvers) : workflow;
    } catch (e) {
      console.error('parse approvers error', e);
    }

    // Find the current user in reviewers or approvers
    let userIndex = -1;
    let listName = '';

    if (docRow.status === 'pending_review') {
      listName = 'reviewers';
      userIndex = (workflow.reviewers || []).findIndex(u => String(u.userId) === String(currentUserId) && u.status === 'pending');
    } else if (docRow.status === 'pending_approval') {
      listName = 'approvers';
      userIndex = (workflow.approvers || []).findIndex(u => String(u.userId) === String(currentUserId) && u.status === 'pending');
    }

    if (userIndex === -1) {
      return res.status(403).json({ success: false, error: 'You do not have pending authority on this document to reassign.' });
    }

    // Swap / replace the user in the list
    workflow[listName][userIndex] = {
      ...workflow[listName][userIndex],
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
      status: 'pending' // reset to pending for the new assignee
    };

    // Save back to DB
    await pool.execute(
      'UPDATE documents SET approvers = ?, updated_at = CURRENT_TIMESTAMP WHERE document_id = ?',
      [JSON.stringify(workflow), documentId]
    );

    // Sync permissions
    await grantDocumentWorkflowPermissions(documentId, workflow, docRow.created_by);

    // Deactivate permission for the previous user
    await pool.execute(
      'UPDATE documentpermissions SET status = "inactive" WHERE document_id = ? AND user_id = ? AND permission_type != "author"',
      [documentId, currentUserId]
    );

    res.json({
      success: true,
      message: 'Authority reassigned successfully',
      template_approvers: workflow,
      required_approvers: docRow.required_approvers ? JSON.parse(docRow.required_approvers) : []
    });
  } catch (error) {
    console.error('Reassign error:', error);
    res.status(500).json({ success: false, error: 'Failed to reassign authority' });
  }
});


// Socket.io connection
io.on("connection", (socket) => {
  // Update the existing socket handlers
  socket.on("joinDocument", async ({ docId, userId, userName }) => {
    socket.join(docId);

    try {
      // Fetch document content from database
      const [documents] = await pool.execute(
        'SELECT content, elements, structured_data FROM documents WHERE document_id = ?',
        [docId]
      );

      if (documents.length > 0) {
        const documentData = documents[0];
        const content = JSON.parse(documentData.content || '{}');
        const elements = JSON.parse(documentData.elements || '{}');
        const structuredData = JSON.parse(documentData.structured_data || '{"pages": [{"id": "page1", "blocks": []}]}');

        // Send both legacy content and structured data
        socket.emit("loadDocument", {
          content,
          blocks: structuredData.pages[0]?.blocks || [],
          document: structuredData
        });

        console.log(structuredData.pages[0]?.blocks);
        socket.emit("loadDocElements", {
          comments: elements.comments || [],
          suggestedEdits: elements.suggestedEdits || [],
          headerHTML: elements.headerHTML || '',
          footerHTML: elements.footerHTML || '',
          logo: elements.logo || null,
          logoText: elements.logoText || '',
          logoTextRight: elements.logoTextRight || ''
        });
      }
    } catch (error) {
      console.error('Error fetching document:', error);
    }
  });

  // Handle template editor join
  socket.on("joinTemplateEditor", ({ userId, userName }) => {
    socket.join("template-editor");
  });

  // Handle joining template review room
  socket.on("joinTemplateReview", ({ templateId, userId, userName }) => {
    const room = `template-review-${templateId}`;
    socket.join(room);
  });

  // Handle template comment events
  socket.on("addTemplateComment", ({ templateId, comment }) => {
    const room = `template-review-${templateId}`;
    socket.to(room).emit("receiveTemplateComment", { comment });
    console.log(`Template comment added: 
    - Template ID: ${templateId}
    - Comment ID: ${comment.id}
    - Author: ${comment.user}
    - Timestamp: ${new Date().toISOString()}`);
  });

  // Handle template suggestion events
  socket.on("addTemplateSuggestion", ({ templateId, suggestion }) => {
    const room = `template-review-${templateId}`;
    socket.to(room).emit("receiveTemplateSuggestion", { suggestion });
    console.log(`Template suggestion added: 
    - Template ID: ${templateId}
    - Suggestion ID: ${suggestion.id}
    - Author: ${suggestion.user}
    - Timestamp: ${new Date().toISOString()}`);
  });

  // Handle template comment deletion
  socket.on("removeTemplateComment", async ({ templateId, commentId }) => {
    try {
      // 1. Try to treat as a document first
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [templateId]
      );

      if (documents.length > 0) {
        let elements = documents[0].elements ? JSON.parse(documents[0].elements) : { comments: [], suggestedEdits: [] };
        elements.comments = (elements.comments || []).filter(c => c.id !== commentId);

        await pool.execute(
          'UPDATE documents SET elements = ? WHERE document_id = ?',
          [JSON.stringify(elements), templateId]
        );

        // Notify document room
        io.to(templateId).emit("commentRemoved", { commentId });
        console.log(`Document comment removed: ${commentId} from ${templateId}`);
        return;
      }

      // 2. Fallback to template logic
      const room = `template-review-${templateId}`;
      socket.to(room).emit("templateCommentRemoved", { commentId });
      console.log(`Template comment removed: 
      - Template ID: ${templateId}
      - Comment ID: ${commentId}
      - Timestamp: ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Error removing comment:', error);
    }
  });

  // Handle template suggestion deletion
  socket.on("removeTemplateSuggestion", async ({ templateId, suggestionId }) => {
    try {
      // 1. Try to treat as a document first
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [templateId]
      );

      if (documents.length > 0) {
        let elements = documents[0].elements ? JSON.parse(documents[0].elements) : { comments: [], suggestedEdits: [] };
        elements.suggestedEdits = (elements.suggestedEdits || []).filter(s => s.id !== suggestionId);

        await pool.execute(
          'UPDATE documents SET elements = ? WHERE document_id = ?',
          [JSON.stringify(elements), templateId]
        );

        // Notify document room
        io.to(templateId).emit("suggestedEditRemoved", { suggestededitId: suggestionId });
        console.log(`Document suggestion removed: ${suggestionId} from ${templateId}`);
        return;
      }

      // 2. Fallback to template logic
      const room = `template-review-${templateId}`;
      socket.to(room).emit("templateSuggestionRemoved", { suggestionId });
      console.log(`Template suggestion removed: 
      - Template ID: ${templateId}
      - Suggestion ID: ${suggestionId}
      - Timestamp: ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Error removing suggestion:', error);
    }
  });

  // Handle template comment replies
  socket.on("addTemplateCommentReply", ({ templateId, commentId, reply }) => {
    const room = `template-review-${templateId}`;
    socket.to(room).emit("receiveTemplateCommentReply", { commentId, reply });
    console.log(`Template comment reply added: 
    - Template ID: ${templateId}
    - Comment ID: ${commentId}
    - Reply ID: ${reply.id}
    - Author: ${reply.user}
    - Timestamp: ${new Date().toISOString()}`);
  });

  // Handle template suggestion replies
  socket.on("addTemplateSuggestionReply", ({ templateId, suggestionId, reply }) => {
    const room = `template-review-${templateId}`;
    socket.to(room).emit("receiveTemplateSuggestionReply", { suggestionId, reply });
    console.log(`Template suggestion reply added: 
    - Template ID: ${templateId}
    - Suggestion ID: ${suggestionId}
    - Reply ID: ${reply.id}
    - Author: ${reply.user}
    - Timestamp: ${new Date().toISOString()}`);
  });

  // Handle template comment reply removal
  socket.on("removeTemplateCommentReply", ({ templateId, commentId, replyId }) => {
    const room = `template-review-${templateId}`;
    socket.to(room).emit("templateCommentReplyRemoved", { commentId, replyId });
    console.log(`Template comment reply removed: 
    - Template ID: ${templateId}
    - Comment ID: ${commentId}
    - Reply ID: ${replyId}
    - Timestamp: ${new Date().toISOString()}`);
  });

  // Handle template suggestion reply removal
  socket.on("removeTemplateSuggestionReply", ({ templateId, suggestionId, replyId }) => {
    const room = `template-review-${templateId}`;
    socket.to(room).emit("templateSuggestionReplyRemoved", { suggestionId, replyId });
    console.log(`Template suggestion reply removed: 
    - Template ID: ${templateId}
    - Suggestion ID: ${suggestionId}
    - Reply ID: ${replyId}
    - Timestamp: ${new Date().toISOString()}`);
  });


  // Enhanced template content changes with better error handling and logging
  socket.on('templateContentChange', async (data) => {
    try {
      const { templateId, content, userId, userName, userEmail, timestamp } = data;
      const roomId = `template:${templateId}`;

      console.log(`📝 Template content change received:`, {
        templateId,
        userId,
        userName,
        contentLength: content ? content.length : 0,
        timestamp: new Date().toISOString()
      });

      // Save to database if needed (content is usually saved via API endpoint)
      // This is kept as a backup for direct socket saves
      if (content && process.env.DIRECT_SOCKET_SAVE === 'true') {
        try {
          // Get existing data first
          const [currentTemplate] = await pool.execute(
            'SELECT comments FROM templates WHERE id = ?',
            [templateId]
          );

          let existingComments = [];
          let existingSuggestions = [];

          if (currentTemplate.length > 0 && currentTemplate[0].comments) {
            try {
              const commentsData = JSON.parse(currentTemplate[0].comments);
              existingComments = commentsData.comments || [];
              existingSuggestions = commentsData.suggestions || [];
            } catch (e) {
              console.warn('Could not parse existing comments in socket handler:', e.message);
            }
          }

          const updatedCommentsData = {
            ...(currentTemplate[0].comments ? JSON.parse(currentTemplate[0].comments) : {}),
            content: content,
            comments: existingComments,
            suggestions: existingSuggestions,
            lastModified: new Date().toISOString(),
            lastModifiedBy: userId
          };

          await pool.execute(
            'UPDATE templates SET content = ?, comments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [content, JSON.stringify(updatedCommentsData), templateId]
          );
          console.log(`💾 Template content saved via socket: ${templateId}`);
        } catch (dbError) {
          console.error('❌ Database update error in socket handler:', dbError);
        }
      }

      // Broadcast to all clients except sender
      socket.to(roomId).emit('templateContentUpdate', {
        templateId,
        content,
        userId,
        userName,
        userEmail,
        timestamp: Date.now()
      });

      console.log(`📡 Broadcasted template update to room: ${roomId}`);
    } catch (error) {
      console.error('❌ Error handling template content change:', error);
      socket.emit('templateError', { error: 'Failed to process content change' });
    }
  });

  // ========== NEW SOCKET.IO HANDLERS FOR REAL-TIME SYNC ==========

  // Handle joining template room
  socket.on('joinTemplate', ({ templateId, mode }) => {
    const roomId = `template-${templateId}`;
    socket.join(roomId);
    console.log(`[Socket] User joined template room: ${roomId} (mode: ${mode})`);
  });

  // Handle leaving template room
  socket.on('leaveTemplate', ({ templateId }) => {
    const roomId = `template-${templateId}`;
    socket.leave(roomId);
    console.log(`[Socket] User left template room: ${roomId}`);
  });

  // Handle template content updates from unified editor
  socket.on('updateTemplateContent', async (data) => {
    const { templateId, content, headerHTML, footerHTML, userId, timestamp } = data;
    console.log(`[Socket] updateTemplateContent from user ${userId} for template ${templateId}`);

    try {
      // Broadcast to all users in the template room (including sender for confirmation)
      io.to(`template-${templateId}`).emit('templateContentUpdated', {
        templateId,
        content,
        headerHTML,
        footerHTML,
        userId,
        timestamp: timestamp || Date.now()
      });

      console.log(`[Socket] Broadcasted templateContentUpdated to template-${templateId} room`);
    } catch (error) {
      console.error('[Socket] Error broadcasting template content:', error);
    }
  });

  // Handle comment add/update/delete
  socket.on('addComment', ({ templateId, comment }) => {
    console.log(`[Socket] Comment added to template ${templateId}`);
    io.to(`template-${templateId}`).emit('commentAdded', { templateId, comment });
  });

  socket.on('updateComment', ({ templateId, commentId, updates }) => {
    console.log(`[Socket] Comment ${commentId} updated in template ${templateId}`);
    io.to(`template-${templateId}`).emit('commentUpdated', { templateId, commentId, updates });
  });

  socket.on('deleteComment', ({ templateId, commentId }) => {
    console.log(`[Socket] Comment ${commentId} deleted from template ${templateId}`);
    io.to(`template-${templateId}`).emit('commentDeleted', { templateId, commentId });
  });

  // Handle suggestion add/update/delete
  socket.on('addSuggestion', ({ templateId, suggestion }) => {
    console.log(`[Socket] Suggestion added to template ${templateId}`);
    io.to(`template-${templateId}`).emit('suggestionAdded', { templateId, suggestion });
  });

  socket.on('updateSuggestion', ({ templateId, suggestionId, updates }) => {
    console.log(`[Socket] Suggestion ${suggestionId} updated in template ${templateId}`);
    io.to(`template-${templateId}`).emit('suggestionUpdated', { templateId, suggestionId, updates });
  });

  socket.on('deleteSuggestion', ({ templateId, suggestionId }) => {
    console.log(`[Socket] Suggestion ${suggestionId} deleted from template ${templateId}`);
    io.to(`template-${templateId}`).emit('suggestionDeleted', { templateId, suggestionId });
  });

  // ========== END NEW SOCKET.IO HANDLERS ==========

  // Handle user presence updates
  socket.on('templateUserPresence', (data) => {
    try {
      const { templateId, userId, userName, userEmail, action } = data;
      const roomId = `template:${templateId}`;

      console.log(`👥 User presence update:`, {
        templateId,
        userId,
        userName,
        action,
        timestamp: new Date().toISOString()
      });

      // Broadcast presence to others in room
      socket.to(roomId).emit('userPresence', {
        templateId,
        userId,
        userName,
        userEmail,
        action,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ Error handling user presence:', error);
    }
  });

  socket.on("textChange", async ({ docId, content, blocks, document, headerHTML, footerHTML, logo, logoText, logoTextRight }) => {
    try {
      const pages = document?.pages || [{ id: 'page1', blocks: blocks || [] }];

      const structuredData = {
        pages,
        updatedAt: new Date().toISOString()
      };

      // Fetch existing elements to preserve comments/suggestions
      const [existingDocs] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let elements = {};
      if (existingDocs.length > 0 && existingDocs[0].elements) {
        try {
          elements = typeof existingDocs[0].elements === 'string' ? JSON.parse(existingDocs[0].elements) : existingDocs[0].elements;
        } catch (e) {
          console.error('Error parsing existing elements:', e);
        }
      }

      // Merge header/footer/logo if provided
      if (headerHTML !== undefined) elements.headerHTML = headerHTML;
      if (footerHTML !== undefined) elements.footerHTML = footerHTML;
      if (logo !== undefined) elements.logo = logo;
      if (logoText !== undefined) elements.logoText = logoText;
      if (logoTextRight !== undefined) elements.logoTextRight = logoTextRight;

      // Update content, structured_data, and elements
      await pool.execute(
        'UPDATE documents SET content = ?, structured_data = ?, elements = ? WHERE document_id = ?',
        [JSON.stringify(content), JSON.stringify(structuredData), JSON.stringify(elements), docId]
      );

      // Emit the changes to all clients in the document room
      io.to(docId).emit("updateDocument", {
        content,
        blocks: blocks || [],
        document: structuredData,
        headerHTML,
        footerHTML,
        logo: elements.logo,
        logoText: elements.logoText,
        logoTextRight: elements.logoTextRight
      });

      console.log(`Document content changed:
      - Document ID: ${docId}
      - Content Length: ${JSON.stringify(content).length} characters
      - Blocks Count: ${blocks ? blocks.length : 0}
      - Pages Count: ${pages.length}
      - Timestamp: ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Error updating document content:', error);
    }
  });

  socket.on("addDocElements", async (data) => {
    try {
      const { docId, comment, suggestededit } = data;

      // Handle template editor case (no database storage, just real-time sync)
      if (docId === "template-editor") {
        // Emit to all clients in the template editor room
        if (comment) {
          io.to(docId).emit("receiveDocElements", { comment });
          console.log(`New template comment added: 
            - Comment ID: ${comment.id}
            - Author: ${comment.author || comment.user}
            - Timestamp: ${new Date().toISOString()}`);
        }

        if (suggestededit) {
          io.to(docId).emit("receiveDocElements", { suggestededit });
          console.log(`New template suggested edit added: 
            - Suggested Edit ID: ${suggestededit.id}
            - Author: ${suggestededit.author || suggestededit.user}
            - Timestamp: ${new Date().toISOString()}`);
        }
        return;
      }

      // Handle regular document case
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0] && documents[0].elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      // Add new element
      if (comment) {
        currentElements.comments = currentElements.comments || [];
        currentElements.comments.push(comment);
      }

      if (suggestededit) {
        currentElements.suggestedEdits = currentElements.suggestedEdits || [];
        currentElements.suggestedEdits.push(suggestededit);
      }

      // Update elements in database
      await pool.execute(
        'UPDATE documents SET elements = ? WHERE document_id = ?',
        [JSON.stringify(currentElements), docId]
      );

      // Emit to all clients in the document
      if (comment) {
        io.to(docId).emit("receiveDocElements", { comment });
        console.log(`New comment added: 
          - Document ID: ${docId}
          - Comment ID: ${comment.id}
          - Author: ${comment.author || comment.user}
          - Timestamp: ${new Date().toISOString()}`);
      }

      if (suggestededit) {
        io.to(docId).emit("receiveDocElements", { suggestededit });
        console.log(`New suggested edit added: 
          - Document ID: ${docId}
          - Suggested Edit ID: ${suggestededit.id}
          - Author: ${suggestededit.author || suggestededit.user}
          - Timestamp: ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('Error adding document elements:', error);
    }
  });

  socket.on("removeComment", async ({ docId, commentId }) => {
    try {
      // Handle template editor case (no database storage, just real-time sync)
      if (docId === "template-editor") {
        io.to(docId).emit("commentRemoved", { commentId });
        console.log(`Template comment removed: 
          - Comment ID: ${commentId}
          - Timestamp: ${new Date().toISOString()}`);
        return;
      }

      // Handle regular document case
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0] && documents[0].elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      // Remove comment
      const removedComments = currentElements.comments.filter(
        comment => comment.id === commentId
      );

      currentElements.comments = currentElements.comments.filter(
        comment => comment.id !== commentId
      );

      // Update elements in database
      await pool.execute(
        'UPDATE documents SET elements = ? WHERE document_id = ?',
        [JSON.stringify(currentElements), docId]
      );

      io.to(docId).emit("commentRemoved", { commentId });

      console.log(`Comment removed: 
        - Document ID: ${docId}
        - Comment ID: ${commentId}
        - Removed Comment Details: ${JSON.stringify(removedComments[0])}
        - Timestamp: ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Error removing comment:', error);
    }
  });

  socket.on("removeSuggestedEdit", async ({ docId, suggestededitId }) => {
    try {
      // Handle template editor case (no database storage, just real-time sync)
      if (docId === "template-editor") {
        io.to(docId).emit("suggestedEditRemoved", { suggestededitId });
        console.log(`Template suggested edit removed: 
          - Suggested Edit ID: ${suggestededitId}
          - Timestamp: ${new Date().toISOString()}`);
        return;
      }

      // Handle regular document case
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0] && documents[0].elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      const removedEdits = currentElements.suggestedEdits.filter(
        edit => edit.id === suggestededitId
      );

      currentElements.suggestedEdits = currentElements.suggestedEdits.filter(
        edit => edit.id !== suggestededitId
      );

      // Update elements in database
      await pool.execute(
        'UPDATE documents SET elements = ? WHERE document_id = ?',
        [JSON.stringify(currentElements), docId]
      );

      io.to(docId).emit("suggestedEditRemoved", { suggestededitId });

      console.log(`Suggested edit removed: 
        - Document ID: ${docId}
        - Suggested Edit ID: ${suggestededitId}
        - Removed Edit Details: ${JSON.stringify(removedEdits[0])}
        - Timestamp: ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Error removing Suggested edit:', error);
    }
  });

  socket.on("batchDeleteElements", async ({ docId, deletions }) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Fetch current document state
      const [documents] = await connection.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0]?.elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      // 2. Process deletions
      const removalReport = {
        timestamp: new Date().toISOString(),
        docId,
        removedComments: [],
        removedEdits: []
      };

      deletions.forEach(({ type, id }) => {
        if (type === 'comment') {
          const comment = currentElements.comments.find(c => c.id === id);
          if (comment) {
            removalReport.removedComments.push({
              id,
              user: comment.user,
              text: comment.text,
              timestamp: comment.timestamp
            });
            currentElements.comments = currentElements.comments.filter(c => c.id !== id);
          }
        } else if (type === 'suggestededit') {
          const edit = currentElements.suggestedEdits.find(e => e.id === id);
          if (edit) {
            removalReport.removedEdits.push({
              id,
              user: edit.user,
              originalText: edit.selectedText,
              suggestedText: edit.text,
              timestamp: edit.timestamp
            });
            currentElements.suggestedEdits = currentElements.suggestedEdits.filter(e => e.id !== id);
          }
        }
      });

      // 3. Update database
      await connection.execute(
        'UPDATE documents SET elements = ? WHERE document_id = ?',
        [JSON.stringify(currentElements), docId]
      );

      await connection.commit();

      // 4. Notify clients and log
      removalReport.removedComments.forEach(({ id }) => {
        io.to(docId).emit("commentRemoved", { commentId: id });
      });

      removalReport.removedEdits.forEach(({ id }) => {
        io.to(docId).emit("suggestedEditRemoved", { suggestededitId: id });
      });

      console.log(`Batch deletion processed:
      - Document: ${docId}
      - Total Removals: ${deletions.length}
      - Comments Removed: ${removalReport.removedComments.length}
      - Edits Removed: ${removalReport.removedEdits.length}
      - Details: ${JSON.stringify(removalReport, null, 2)}`);

    } catch (error) {
      await connection.rollback();
      console.error('Batch deletion failed:', {
        docId,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    } finally {
      connection.release();
    }
  });

  socket.on("updateCommentStatus", async ({ docId, commentId, status }) => {
    try {
      // Fetch current elements
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0] && documents[0].elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      const commentIndex = currentElements.comments.findIndex(
        (comment) => comment.id === commentId
      );

      if (commentIndex !== -1) {
        const oldStatus = currentElements.comments[commentIndex].status;
        currentElements.comments[commentIndex].status = status;

        // Update elements in database
        await pool.execute(
          'UPDATE documents SET elements = ? WHERE document_id = ?',
          [JSON.stringify(currentElements), docId]
        );

        io.to(docId).emit("updateCommentStatus", { commentId, status });

        console.log(`Comment status updated: 
          - Document ID: ${docId}
          - Comment ID: ${commentId}
          - Old Status: ${oldStatus}
          - New Status: ${status}
          - Timestamp: ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('Error updating comment status:', error);
    }
  });

  socket.on("updateCommentReplies", async ({ docId, commentId, reply }) => {
    try {
      // Handle template editor case (no database storage, just real-time sync)
      if (docId === "template-editor") {
        io.to(docId).emit("updateCommentReplies", { commentId, reply });
        console.log(`Template comment reply added: 
          - Comment ID: ${commentId}
          - Reply Author: ${reply.author || reply.user}
          - Timestamp: ${new Date().toISOString()}`);
        return;
      }

      // Handle regular document case
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0] && documents[0].elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      const commentIndex = currentElements.comments.findIndex(
        (comment) => comment.id === commentId
      );

      if (commentIndex !== -1) {
        if (!currentElements.comments[commentIndex].replies) {
          currentElements.comments[commentIndex].replies = [];
        }
        currentElements.comments[commentIndex].replies.push(reply);

        // Update elements in database
        await pool.execute(
          'UPDATE documents SET elements = ? WHERE document_id = ?',
          [JSON.stringify(currentElements), docId]
        );

        io.to(docId).emit("updateCommentReplies", { commentId, reply });

        console.log(`Comment reply added: 
          - Document ID: ${docId}
          - Comment ID: ${commentId}
          - Reply Author: ${reply.author || reply.user}
          - Timestamp: ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('Error updating comment replies:', error);
    }
  });

  socket.on("updateSuggestedEditStatus", async ({ docId, suggestededitId, status }) => {
    try {
      // Handle template editor case (no database storage, just real-time sync)
      if (docId === "template-editor") {
        io.to(docId).emit("updateSuggestedEditStatus", { suggestededitId, status });
        console.log(`Template suggested edit status updated: 
          - Suggested Edit ID: ${suggestededitId}
          - New Status: ${status}
          - Timestamp: ${new Date().toISOString()}`);
        return;
      }

      // Handle regular document case
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0] && documents[0].elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      const editIndex = currentElements.suggestedEdits.findIndex(
        (edit) => edit.id === suggestededitId
      );

      if (editIndex !== -1) {
        const oldStatus = currentElements.suggestedEdits[editIndex].status;
        currentElements.suggestedEdits[editIndex].status = status;

        // Update elements in database
        await pool.execute(
          'UPDATE documents SET elements = ? WHERE document_id = ?',
          [JSON.stringify(currentElements), docId]
        );

        io.to(docId).emit("updateSuggestedEditStatus", { suggestededitId, status });

        console.log(`Suggested edit status updated: 
          - Document ID: ${docId}
          - Suggested Edit ID: ${suggestededitId}
          - Old Status: ${oldStatus}
          - New Status: ${status}
          - Timestamp: ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('Error updating suggested edit status:', error);
    }
  });

  socket.on("updateSuggestedEditReplies", async ({ docId, suggestededitId, reply }) => {
    try {
      // Handle template editor case (no database storage, just real-time sync)
      if (docId === "template-editor") {
        io.to(docId).emit("updateSuggestedEditReplies", { suggestededitId, reply });
        console.log(`Template suggested edit reply added: 
          - Suggested Edit ID: ${suggestededitId}
          - Reply Author: ${reply.author || reply.user}
          - Timestamp: ${new Date().toISOString()}`);
        return;
      }

      // Handle regular document case
      const [documents] = await pool.execute(
        'SELECT elements FROM documents WHERE document_id = ?',
        [docId]
      );

      let currentElements = documents[0] && documents[0].elements
        ? JSON.parse(documents[0].elements)
        : { comments: [], suggestedEdits: [] };

      const suggestededitIndex = currentElements.suggestedEdits.findIndex(
        (suggestededit) => suggestededit.id === suggestededitId
      );

      if (suggestededitIndex !== -1) {
        if (!currentElements.suggestedEdits[suggestededitIndex].replies) {
          currentElements.suggestedEdits[suggestededitIndex].replies = [];
        }
        currentElements.suggestedEdits[suggestededitIndex].replies.push(reply);

        // Update elements in database
        await pool.execute(
          'UPDATE documents SET elements = ? WHERE document_id = ?',
          [JSON.stringify(currentElements), docId]
        );

        io.to(docId).emit("updateSuggestedEditReplies", { suggestededitId, reply });

        console.log(`Suggested edit reply added: 
          - Document ID: ${docId}
          - Suggested Edit ID: ${suggestededitId}
          - Reply Author: ${reply.author || reply.user}
          - Timestamp: ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('Error updating suggested edit replies:', error);
    }
  });

  socket.on("cursorMove", ({ docId, userId, cursorPosition, userName }) => {
    socket.to(docId).emit("cursorUpdate", { userId, cursorPosition, userName });
  });

  socket.on("disconnect", () => {
  });
});

// API to set custom document approvers for a template
app.put('/api/templates/:templateId/custom_approvers', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { custom_document_approvers } = req.body;

    // Fetch the role to authorize admin
    const [userRows] = await pool.execute('SELECT role FROM users WHERE id = ?', [req.user.userId]);
    if (userRows.length === 0 || userRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can manage custom template approvers' });
    }

    await pool.execute(
      'UPDATE templates SET custom_document_approvers = ? WHERE id = ?',
      [
        custom_document_approvers ? JSON.stringify(custom_document_approvers) : null,
        templateId
      ]
    );

    res.json({ message: 'Custom template approvers updated successfully' });
  } catch (error) {
    console.error('Error updating custom template approvers:', error);
    res.status(500).json({ error: 'Failed to update custom template approvers' });
  }
});

// Run startup database migrations
async function runMigrations() {
  try {
    const connection = await pool.getConnection();
    try {
      // Check if custom_document_approvers exists in templates table
      const [columns] = await connection.query('SHOW COLUMNS FROM templates LIKE "custom_document_approvers"');
      if (columns.length === 0) {
        await connection.query('ALTER TABLE templates ADD COLUMN custom_document_approvers LONGTEXT DEFAULT NULL');
        console.log('✅ Successfully added custom_document_approvers column to templates table');
      } else {
        console.log('ℹ️ Database column custom_document_approvers already exists.');
      }

      // Self-heal: ensure all author permissions are active
      await connection.query('UPDATE documentpermissions SET status = "active" WHERE permission_type = "author"');
      console.log('✅ Self-healed active status for all author permissions');
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ Error running database migrations on startup:', err);
  }
}

// Start server

// ============================================================================
// INTEGRATED NEW FRONTEND UI API ENDPOINTS (PART 4 CONTROLLED INTEGRATION)
// ============================================================================

// PHASE 2: Document & Template Pinning
app.patch('/api/documents/:id/pin', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const itemId = req.params.id;

    const [existing] = await pool.execute(
      'SELECT id FROM user_pins WHERE user_id = ? AND item_type = ? AND item_id = ?',
      [userId, 'document', itemId]
    );

    let is_pinned = false;
    if (existing.length > 0) {
      await pool.execute(
        'DELETE FROM user_pins WHERE user_id = ? AND item_type = ? AND item_id = ?',
        [userId, 'document', itemId]
      );
      is_pinned = false;
    } else {
      await pool.execute(
        'INSERT IGNORE INTO user_pins (user_id, item_type, item_id) VALUES (?, ?, ?)',
        [userId, 'document', itemId]
      );
      is_pinned = true;
    }
    res.json({ success: true, is_pinned });
  } catch (error) {
    console.error('Error toggling document pin:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle pin' });
  }
});

app.patch('/api/templates/:id/pin', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const itemId = req.params.id;

    const [existing] = await pool.execute(
      'SELECT id FROM user_pins WHERE user_id = ? AND item_type = ? AND item_id = ?',
      [userId, 'template', itemId]
    );

    let is_pinned = false;
    if (existing.length > 0) {
      await pool.execute(
        'DELETE FROM user_pins WHERE user_id = ? AND item_type = ? AND item_id = ?',
        [userId, 'template', itemId]
      );
      is_pinned = false;
    } else {
      await pool.execute(
        'INSERT IGNORE INTO user_pins (user_id, item_type, item_id) VALUES (?, ?, ?)',
        [userId, 'template', itemId]
      );
      is_pinned = true;
    }
    res.json({ success: true, is_pinned });
  } catch (error) {
    console.error('Error toggling template pin:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle pin' });
  }
});

// PHASE 3: Document & Template Progress Sliders
app.patch('/api/documents/:id/progress', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const rawVal = req.body?.progress_value !== undefined ? req.body.progress_value : req.body?.progress;
    const val = Math.min(100, Math.max(0, parseInt(rawVal, 10) || 0));

    console.log(`📥 [PATCH /api/documents/${id}/progress] Setting progress_value to ${val}% (raw body:`, req.body, `)`);
    await pool.execute('UPDATE documents SET progress_value = ? WHERE document_id = ?', [val, id]);
    res.json({ success: true, progress_value: val });
  } catch (error) {
    console.error('❌ Error updating document progress:', error);
    res.status(500).json({ success: false, error: 'Failed to update progress' });
  }
});

app.patch('/api/templates/:id/progress', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const rawVal = req.body?.progress_value !== undefined ? req.body.progress_value : req.body?.progress;
    const val = Math.min(100, Math.max(0, parseInt(rawVal, 10) || 0));

    console.log(`📥 [PATCH /api/templates/${id}/progress] Setting progress_value to ${val}% (raw body:`, req.body, `)`);
    await pool.execute('UPDATE templates SET progress_value = ? WHERE id = ?', [val, id]);
    res.json({ success: true, progress_value: val });
  } catch (error) {
    console.error('❌ Error updating template progress:', error);
    res.status(500).json({ success: false, error: 'Failed to update progress' });
  }
});

// PHASE 4: Document & Template Notes REST Endpoints
app.get('/api/documents/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT n.*, CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.email AS user_email
       FROM notes n 
       LEFT JOIN users u ON n.user_id = u.id 
       WHERE n.document_id = ? 
       ORDER BY n.created_at ASC`,
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching document notes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notes' });
  }
});

app.post('/api/documents/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;
    const { content, isPrivate } = req.body || {};

    if (!content) {
      return res.status(400).json({ success: false, error: 'Note content is required' });
    }

    const [result] = await pool.execute(
      'INSERT INTO notes (user_id, document_id, content, is_private) VALUES (?, ?, ?, ?)',
      [userId, id, content, isPrivate ? 1 : 0]
    );

    res.json({ success: true, noteId: result.insertId });
  } catch (error) {
    console.error('Error adding document note:', error);
    res.status(500).json({ success: false, error: 'Failed to add note' });
  }
});

app.get('/api/templates/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT n.*, CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.email AS user_email
       FROM notes n 
       LEFT JOIN users u ON n.user_id = u.id 
       WHERE n.template_id = ? 
       ORDER BY n.created_at ASC`,
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching template notes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notes' });
  }
});

app.post('/api/templates/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;
    const { content, isPrivate } = req.body || {};

    if (!content) {
      return res.status(400).json({ success: false, error: 'Note content is required' });
    }

    const [result] = await pool.execute(
      'INSERT INTO notes (user_id, template_id, content, is_private) VALUES (?, ?, ?, ?)',
      [userId, id, content, isPrivate ? 1 : 0]
    );

    res.json({ success: true, noteId: result.insertId });
  } catch (error) {
    console.error('Error adding template note:', error);
    res.status(500).json({ success: false, error: 'Failed to add note' });
  }
});

// PHASE 5: Task Filters & Task Comments (from Intern taskModel.js)
// PHASE 6: Audit Trail Endpoints
app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const [logs] = await pool.execute(
      `SELECT a.id, a.action_type, a.details, a.created_at, u.first_name, u.last_name, u.email
       FROM audittrail a 
       JOIN users u ON a.user_id = u.id 
       ORDER BY a.created_at DESC LIMIT 200`
    );
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

app.get('/api/summary', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user?.organization_id || req.user?.orgId;

    const [summaryRows] = await pool.execute(
      `SELECT
        COUNT(*) AS total_actions,
        SUM(CASE WHEN a.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS actions_last_7_days,
        SUM(CASE WHEN a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS actions_last_30_days
       FROM audittrail a
       ${orgId ? 'WHERE a.organization_id = ?' : ''}`,
      orgId ? [orgId] : []
    );

    const [topUsers] = await pool.execute(
      `SELECT a.user_id,
              CONCAT(u.first_name, ' ', u.last_name) AS name,
              u.email,
              COUNT(*) AS actions
       FROM audittrail a
       LEFT JOIN users u ON a.user_id = u.id
       ${orgId ? 'WHERE a.organization_id = ?' : ''}
       GROUP BY a.user_id, u.first_name, u.last_name, u.email
       ORDER BY actions DESC
       LIMIT 5`,
      orgId ? [orgId] : []
    );

    const [topActions] = await pool.execute(
      `SELECT a.action_type,
              COUNT(*) AS count
       FROM audittrail a
       ${orgId ? 'WHERE a.organization_id = ?' : ''}
       GROUP BY a.action_type
       ORDER BY count DESC
       LIMIT 5`,
      orgId ? [orgId] : []
    );

    const [topItems] = await pool.execute(
      `SELECT COALESCE(a.document_id, '') AS item_id,
              COALESCE(d.title, t.name, '') AS item_title,
              CASE WHEN d.document_id IS NOT NULL THEN 'Document' WHEN t.id IS NOT NULL THEN 'Template' ELSE 'Unknown' END AS item_type,
              COUNT(*) AS actions
       FROM audittrail a
       LEFT JOIN documents d ON a.document_id = d.document_id
       LEFT JOIN templates t ON a.document_id = t.id
       ${orgId ? 'WHERE a.organization_id = ?' : ''}
       GROUP BY item_id, item_title, item_type
       ORDER BY actions DESC
       LIMIT 5`,
      orgId ? [orgId] : []
    );

    res.json({
      success: true,
      data: {
        summary: summaryRows[0] || { total_actions: 0, actions_last_7_days: 0, actions_last_30_days: 0 },
        topUsers,
        topActions,
        topItems,
      }
    });
  } catch (error) {
    console.error('Error fetching audit summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit summary' });
  }
});

app.get('/api/export-csv', authenticateToken, async (req, res) => {
  try {
    const orgId = req.user?.organization_id || req.user?.orgId;

    const [logs] = await pool.execute(
      `SELECT a.*, u.first_name, u.last_name, u.email,
              d.title AS document_title,
              t.name AS template_name
       FROM audittrail a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN documents d ON a.document_id = d.document_id
       LEFT JOIN templates t ON a.document_id = t.id
       ${orgId ? 'WHERE a.organization_id = ?' : ''}
       ORDER BY a.created_at DESC`,
      orgId ? [orgId] : []
    );

    let csv = 'Time,User Name,Email,Action,Document ID,Item Title,Details\n';
    logs.forEach((row) => {
      const userName = row.first_name ? `${row.first_name} ${row.last_name}` : 'System';
      const details = (row.details || '').replace(/"/g, '""');
      const itemTitle = row.document_title || row.template_name || '';
      csv += `"${row.created_at}","${userName}","${row.email || ''}","${row.action_type}","${row.document_id || ''}","${itemTitle}","${details}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_trail_report.csv"');
    res.status(200).send(csv);
  } catch (error) {
    console.error('Error exporting audit logs CSV:', error);
    res.status(500).send('CSV Generation Failed');
  }
});

// PHASE 7: Trending Analytics (Extracted from Intern's trendingService.js)
app.get('/api/trending', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const organizationId = req.user?.organization_id || req.user?.orgId || 1;
    const { search, type, status, favoritesOnly } = req.query || {};

    const normalizedType = String(type || 'All').trim();
    const searchTerm = String(search || '').trim();

    const documentWhere = ['1=1'];
    const documentParams = [];
    if (organizationId) {
      documentWhere.push('organization_id = ?');
      documentParams.push(organizationId);
    }
    if (searchTerm) {
      documentWhere.push('title LIKE ?');
      documentParams.push(`%${searchTerm}%`);
    }

    const templateWhere = ['1=1'];
    const templateParams = [];
    if (organizationId) {
      templateWhere.push('organization_id = ?');
      templateParams.push(organizationId);
    }
    if (searchTerm) {
      templateWhere.push('name LIKE ?');
      templateParams.push(`%${searchTerm}%`);
    }

    let documentRows = [];
    let templateRows = [];

    if (normalizedType !== 'Template') {
      const documentQuery = `SELECT document_id AS id, title, 'document' AS item_type, status, created_at, updated_at, created_by FROM documents WHERE ${documentWhere.join(' AND ')} ORDER BY created_at DESC LIMIT 50`;
      [documentRows] = await pool.execute(documentQuery, documentParams);
    }

    if (normalizedType !== 'Draft') {
      const templateQuery = `SELECT id, name AS title, 'template' AS item_type, status, created_at, updated_at, created_by FROM templates WHERE ${templateWhere.join(' AND ')} ORDER BY created_at DESC LIMIT 50`;
      [templateRows] = await pool.execute(templateQuery, templateParams);
    }

    const [pinRows] = await pool.execute(
      'SELECT item_type, item_id FROM user_pins WHERE user_id = ? AND item_type IN (?, ?)',
      [userId, 'document', 'template']
    );
    const favoriteSet = new Set(pinRows.map((row) => `${row.item_type}:${row.item_id}`));

    const combinedItems = [
      ...documentRows.map(row => ({
        id: row.id,
        title: row.title || 'Untitled Document',
        type: 'Draft',
        status: row.status || 'Draft',
        timestamp: row.created_at,
        is_favorite: favoriteSet.has(`document:${row.id}`),
        teamMembers: [{ userId: row.created_by, name: 'Author', initials: 'AU', color: 'bg-cyan-600' }]
      })),
      ...templateRows.map(row => ({
        id: row.id,
        title: row.title || 'Untitled Template',
        type: 'Template',
        status: row.status || 'Published',
        timestamp: row.created_at,
        is_favorite: favoriteSet.has(`template:${row.id}`),
        teamMembers: [{ userId: row.created_by, name: 'Author', initials: 'AU', color: 'bg-violet-600' }]
      }))
    ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    const finalItems = favoritesOnly === 'true' || favoritesOnly === true
      ? combinedItems.filter(item => item.is_favorite)
      : combinedItems;

    res.json({ success: true, data: finalItems });
  } catch (error) {
    console.error('Error fetching trending items:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trending items' });
  }
});

app.post('/api/trending/favorite', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { itemType, itemId } = req.body || {};

    if (!itemType || !itemId) {
      return res.status(400).json({ success: false, message: 'itemType and itemId are required' });
    }

    const normalizedType = String(itemType).trim().toLowerCase();
    const [existingRows] = await pool.execute(
      'SELECT 1 FROM user_pins WHERE user_id = ? AND item_type = ? AND item_id = ?',
      [userId, normalizedType, String(itemId)]
    );

    if (existingRows.length > 0) {
      await pool.execute('DELETE FROM user_pins WHERE user_id = ? AND item_type = ? AND item_id = ?', [userId, normalizedType, String(itemId)]);
      return res.json({ success: true, data: { is_favorite: false } });
    }

    await pool.execute('INSERT IGNORE INTO user_pins (user_id, item_type, item_id) VALUES (?, ?, ?)', [userId, normalizedType, String(itemId)]);
    return res.json({ success: true, data: { is_favorite: true } });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ success: false, message: 'Failed to update favorite state' });
  }
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
