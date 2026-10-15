/**
 * Centralized Audit Logger Utility for Phase 3
 * 
 * Provides reliable, sanitized, transaction-compatible audit event recording.
 */

const BANNED_SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwordhash',
  'newpassword',
  'currentpassword',
  'oldpassword',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'rawrefreshtoken',
  'tokenhash',
  'secret',
  'access_secret',
  'jwt_secret',
  'encryption_key',
  'apikey',
  'authorization'
]);

/**
 * Deeply sanitizes an object or value, stripping sensitive security fields
 * and capping oversized content blocks.
 */
function sanitizeAuditDetails(data, depth = 0) {
  if (data === null || data === undefined) {
    return null;
  }

  if (depth > 5) {
    return '[MAX_DEPTH_REACHED]';
  }

  if (typeof data === 'string') {
    // If it's a string, verify if it's JSON or large content
    if (data.length > 4000) {
      return data.slice(0, 500) + `... [TRUNCATED ${data.length} bytes]`;
    }
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed === 'object' && parsed !== null) {
        return sanitizeAuditDetails(parsed, depth + 1);
      }
    } catch (_) {
      // Plain string
    }
    return data;
  }

  if (Array.isArray(data)) {
    if (data.length > 50) {
      return data.slice(0, 50).map(item => sanitizeAuditDetails(item, depth + 1)).concat(`[... +${data.length - 50} more items]`);
    }
    return data.map(item => sanitizeAuditDetails(item, depth + 1));
  }

  if (typeof data === 'object') {
    const cleaned = {};
    for (const [key, val] of Object.entries(data)) {
      const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (BANNED_SENSITIVE_KEYS.has(lowerKey)) {
        cleaned[key] = '[REDACTED]';
        continue;
      }

      // Check for large HTML / editor content payload
      if ((key === 'content' || key === 'elements' || key === 'html' || key === 'document') && typeof val === 'string' && val.length > 500) {
        cleaned[key] = `[CONTENT_METADATA: length=${val.length} chars]`;
        continue;
      }

      cleaned[key] = sanitizeAuditDetails(val, depth + 1);
    }
    return cleaned;
  }

  return data;
}

/**
 * Ensures any details input is serialized into valid, safe JSON string
 */
function serializeAuditDetails(details) {
  if (details === null || details === undefined) {
    return JSON.stringify({});
  }

  let sanitized;
  if (typeof details === 'string') {
    try {
      const parsed = JSON.parse(details);
      sanitized = sanitizeAuditDetails(parsed);
    } catch (_) {
      sanitized = { message: sanitizeAuditDetails(details) };
    }
  } else if (typeof details === 'object') {
    sanitized = sanitizeAuditDetails(details);
  } else {
    sanitized = { value: details };
  }

  try {
    return JSON.stringify(sanitized);
  } catch (err) {
    return JSON.stringify({ error: 'Serialization failure', fallback: String(sanitized) });
  }
}

/**
 * Log an audit event.
 * 
 * @param {Object} dbOrConnection - MySQL pool or transaction connection
 * @param {Object} event - The audit event payload
 * @param {boolean} [throwOnError=false] - Whether to throw on error (must be true for transactions)
 */
async function logAuditEvent(dbOrConnection, {
  orgId,
  userId = null,
  userEmail = null,
  userName = null,
  actionType,
  resourceType = 'document',
  resourceId = null,
  documentId = null,
  details = {},
  ipAddress = null,
  userAgent = null,
  status = 'success',
  req = null
}, throwOnError = false) {
  try {
    if (!dbOrConnection) {
      throw new Error('Database pool or connection required for audit logging');
    }

    if (!orgId) {
      // If orgId not directly passed, attempt extraction from req if available
      orgId = req?.user?.organization_id || req?.user?.orgId || 1;
    }

    if (!actionType) {
      throw new Error('actionType is required for audit logging');
    }

    // Extract request-level context if req object was provided
    let finalIp = ipAddress;
    let finalUserAgent = userAgent;

    if (req) {
      if (!finalIp) {
        finalIp = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || null;
      }
      if (!finalUserAgent) {
        finalUserAgent = req.headers?.['user-agent'] || null;
      }
      if (userId == null && req.user) {
        userId = req.user.userId || req.user.id || null;
      }
      if (!userEmail && req.user?.email) {
        userEmail = req.user.email;
      }
      if (!userName && (req.user?.first_name || req.user?.name)) {
        userName = req.user.name || `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim();
      }
    }

    // Auto-enrich user email and name from database if still missing and userId is available
    if (userId && (!userEmail || !userName)) {
      try {
        const [uRows] = await dbOrConnection.execute(
          'SELECT email, first_name, last_name FROM users WHERE id = ? LIMIT 1',
          [userId]
        );
        if (uRows && uRows.length > 0) {
          if (!userEmail) userEmail = uRows[0].email;
          if (!userName) userName = `${uRows[0].first_name || ''} ${uRows[0].last_name || ''}`.trim() || null;
        }
      } catch (_) {
        // Non-blocking fallback
      }
    }

    // Ensure resourceId and documentId are aligned
    let finalDocId = documentId;
    let finalResourceId = resourceId;

    if (!finalResourceId && finalDocId) {
      finalResourceId = String(finalDocId);
    } else if (finalResourceId && !finalDocId && resourceType === 'document') {
      finalDocId = String(finalResourceId);
    }

    const safeDetailsJson = serializeAuditDetails(details);

    const query = `
      INSERT INTO audittrail 
      (organization_id, user_id, user_email, user_name, action_type, resource_type, resource_id, document_id, details, ip_address, user_agent, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      orgId,
      userId ? Number(userId) : null,
      userEmail || null,
      userName || null,
      String(actionType).toUpperCase(),
      String(resourceType || 'document').toLowerCase(),
      finalResourceId ? String(finalResourceId) : null,
      finalDocId ? String(finalDocId) : null,
      safeDetailsJson,
      finalIp ? String(finalIp).slice(0, 45) : null,
      finalUserAgent ? String(finalUserAgent).slice(0, 500) : null,
      status || 'success'
    ];

    await dbOrConnection.execute(query, params);
  } catch (err) {
    console.error(`🚨 [AuditLogger] Failed to record audit event [${actionType}]:`, err.message);
    if (throwOnError) {
      throw err;
    }
  }
}

module.exports = {
  logAuditEvent,
  sanitizeAuditDetails,
  serializeAuditDetails
};
