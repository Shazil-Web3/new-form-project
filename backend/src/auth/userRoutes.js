const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

module.exports = function registerUserRoutes({
  app,
  pool,
  authenticateToken,
  dbOps,
  bcrypt,
  jwt,
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
  logAuditEvent
}) {
  const hashToken = (token) => {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
  };

  const generateTokens = (user) => {
    const jti = uuidv4();
    const accessToken = jwt.sign(
      {
        userId: user.id,
        sub: String(user.id),
        email: user.email,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        organization_id: user.organization_id,
        orgId: user.organization_id,
        role: user.role,
        department: user.department || null,
        token_version: user.token_version || 1,
        jti
      },
      process.env.ACCESS_SECRET,
      {
        expiresIn: ACCESS_TOKEN_EXPIRY || '15m',
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      }
    );

    const rawRefreshToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + (REFRESH_TOKEN_EXPIRY_DAYS || 7) * 24 * 60 * 60 * 1000);

    return {
      accessToken,
      rawRefreshToken,
      tokenHash,
      expiresAt
    };
  };

  // ========================= API ROUTES ========================

  // Create Organization
  app.post('/api/organization/register', authLimiter, async (req, res) => {
    try {
      const { name, settings } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Organization name is required' });
      }
      const orgId = await dbOps.createOrganization(String(name).trim(), settings);
      
      if (logAuditEvent) {
        await logAuditEvent(pool, {
          orgId,
          actionType: 'ORGANIZATION_REGISTERED',
          resourceType: 'organization',
          resourceId: String(orgId),
          details: { name: String(name).trim() },
          req
        });
      }

      res.status(201).json({ id: orgId, message: 'Organization registered successfully' });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // User routes - HARDENED against unauthenticated admin self-registration
  app.post('/api/users/register', authLimiter, async (req, res) => {
    try {
      const { orgId, email, password, firstName, lastName, role } = req.body;

      if (!orgId || !email || !password || !firstName || !lastName) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      // Check if caller is authenticated admin for this organization
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      let isAuthenticatedAdmin = false;

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.ACCESS_SECRET, { algorithms: ['HS256'] });
          if (String(decoded.organization_id) === String(orgId) && decoded.role === 'admin') {
            isAuthenticatedAdmin = true;
          }
        } catch (_) {
          // Ignore token errors and proceed to unauthenticated onboarding check
        }
      }

      // If not authenticated admin, check if this is initial onboarding for an empty organization
      if (!isAuthenticatedAdmin) {
        const [existingUsers] = await pool.execute(
          'SELECT id FROM users WHERE organization_id = ? LIMIT 1',
          [orgId]
        );

        if (existingUsers.length > 0) {
          // Org already has members; direct public registration is blocked
          return res.status(403).json({
            error: 'Registration into existing organizations requires an invitation from an administrator.'
          });
        }
      }

      // Check if email is already registered across the platform
      const [existingEmail] = await pool.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      if (existingEmail.length > 0) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }

      const assignedRole = isAuthenticatedAdmin ? (role || 'viewer') : 'admin';
      const department = null;
      const template_approver = 'no';
      const userId = await dbOps.registerUser(orgId, email, password, firstName, lastName, assignedRole, department, template_approver);
      
      if (logAuditEvent) {
        await logAuditEvent(pool, {
          orgId,
          userId,
          userEmail: email,
          userName: `${firstName} ${lastName}`.trim(),
          actionType: 'USER_REGISTERED',
          resourceType: 'user',
          resourceId: String(userId),
          details: { role: assignedRole, method: isAuthenticatedAdmin ? 'admin_registration' : 'initial_onboarding' },
          req
        });
      }

      res.status(201).json({ id: userId, message: 'User registered successfully' });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // Verify invitation token endpoint
  app.get('/api/invitations/verify/:token', authLimiter, async (req, res) => {
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
        orgId: invitation.organization_id || invitation.orgId
      });
    } catch (error) {
      console.error('Error verifying invitation:', error);
      res.status(500).json({ error: 'Failed to verify invitation' });
    }
  });

  // Register invited user endpoint
  app.post('/api/invitations/register', authLimiter, async (req, res) => {
    try {
      const { token, firstName, lastName, password } = req.body;

      if (!token || !firstName || !lastName || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      // Verify and decode the invitation token
      const invitation = await dbOps.checkInvitation(token);

      if (!invitation) {
        return res.status(404).json({ error: 'Invalid or expired invitation' });
      }

      // Register the invited user using server-verified invitation fields only
      const targetOrgId = invitation.organization_id || invitation.orgId;
      const userData = await dbOps.registerInvitedUser(
        targetOrgId,
        invitation.email,
        password,
        firstName,
        lastName,
        invitation.role || null,
        invitation.department || null,
        null,
        invitation.site || null
      );

      res.status(201).json({
        user: userData,
        message: 'Registration submitted successfully. Awaiting administrator approval.'
      });
      
      if (logAuditEvent) {
        await logAuditEvent(pool, {
          orgId: targetOrgId,
          userEmail: invitation.email,
          userName: `${firstName} ${lastName}`.trim(),
          actionType: 'USER_REGISTERED',
          resourceType: 'user',
          details: { method: 'invited_registration', status: 'pending_approval', role: invitation.role },
          req
        });
      }
    } catch (error) {
      console.error('Error registering invited user:', error);
      res.status(500).json({ error: 'Failed to register user' });
    }
  });

  // User Login
  app.post('/api/users/login', authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const [users] = await pool.execute(
        'SELECT id, email, password_hash, first_name, last_name, role, department, template_approver, organization_id, site, token_version, status FROM users WHERE email = ?',
        [email]
      );

      const user = users && users.length > 0 ? users[0] : null;

      if (!user) {
        // Constant-time dummy hash comparison to prevent timing enumeration
        await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
        if (logAuditEvent) {
          await logAuditEvent(pool, {
            orgId: 1,
            userEmail: email,
            actionType: 'LOGIN_FAILED',
            resourceType: 'auth',
            status: 'failure',
            details: { reason: 'user_not_found' },
            req
          });
        }
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (user.status !== 'active') {
        await bcrypt.compare(password, user.password_hash);
        if (logAuditEvent) {
          await logAuditEvent(pool, {
            orgId: user.organization_id,
            userId: user.id,
            userEmail: user.email,
            userName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            actionType: 'LOGIN_FAILED',
            resourceType: 'auth',
            status: 'denied',
            details: { reason: 'account_inactive', user_status: user.status },
            req
          });
        }
        return res.status(401).json({ error: 'Account is deactivated or inactive', code: 'ACCOUNT_INACTIVE' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        if (logAuditEvent) {
          await logAuditEvent(pool, {
            orgId: user.organization_id,
            userId: user.id,
            userEmail: user.email,
            userName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            actionType: 'LOGIN_FAILED',
            resourceType: 'auth',
            status: 'failure',
            details: { reason: 'incorrect_password' },
            req
          });
        }
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last_login timestamp
      await pool.execute(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      ).catch(() => {});

      const { accessToken, rawRefreshToken, tokenHash, expiresAt } = generateTokens(user);

      // Store hashed refresh token in database
      await pool.execute(
        'INSERT INTO refresh_tokens (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, ?)',
        [user.id, rawRefreshToken, tokenHash, expiresAt]
      );

      const userData = { ...user };
      delete userData.password_hash;

      if (logAuditEvent) {
        await logAuditEvent(pool, {
          orgId: user.organization_id,
          userId: user.id,
          userEmail: user.email,
          userName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          actionType: 'USER_LOGIN',
          resourceType: 'auth',
          status: 'success',
          details: { role: user.role, department: user.department },
          req
        });
      }

      res.json({
        accessToken,
        refreshToken: rawRefreshToken,
        user: userData
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Password verification endpoint
  app.post('/api/verify-password', authenticateToken, passwordVerifyLimiter, async (req, res) => {
    try {
      const userId = req.user.userId || req.user.id || req.body.userId;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ verified: false, error: 'Password is required' });
      }

      const [users] = await pool.execute(
        'SELECT id, email, password_hash FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({ verified: false, error: 'User not found' });
      }

      const user = users[0];
      if (!user.password_hash) {
        return res.status(400).json({ verified: false, error: 'Password not set for account' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        return res.status(400).json({ verified: false, error: 'Incorrect password' });
      }

      res.json({ verified: true });
    } catch (error) {
      console.error('Password verification error:', error);
      res.status(500).json({ verified: false, error: 'Password verification failed' });
    }
  });

  // Get current user data
  app.get('/api/users/me', authenticateToken, async (req, res) => {
    try {
      const [user] = await pool.execute(
        'SELECT id, email, first_name, last_name, role, template_approver, organization_id, site, department, status FROM users WHERE id = ?',
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
        department: user[0].department,
        site: user[0].site,
        status: user[0].status,
        template_approver: user[0].template_approver
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user data' });
    }
  });

  // Logout route
  app.post('/api/auth/logout', async (req, res) => {
    try {
      const { refreshToken, allDevices } = req.body;
      let targetUserId = null;
      let targetOrgId = 1;
      let targetEmail = null;
      let targetName = null;

      if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        const [tokenRows] = await pool.execute(
          'SELECT r.user_id, u.email, u.first_name, u.last_name, u.organization_id FROM refresh_tokens r LEFT JOIN users u ON r.user_id = u.id WHERE r.token_hash = ? OR r.token = ? LIMIT 1',
          [tokenHash, refreshToken]
        );
        if (tokenRows && tokenRows.length > 0) {
          targetUserId = tokenRows[0].user_id;
          targetEmail = tokenRows[0].email;
          targetOrgId = tokenRows[0].organization_id || 1;
          targetName = `${tokenRows[0].first_name || ''} ${tokenRows[0].last_name || ''}`.trim();
        }

        await pool.execute(
          'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? OR token = ?',
          [tokenHash, refreshToken]
        );
      }

      if (logAuditEvent) {
        await logAuditEvent(pool, {
          orgId: targetOrgId,
          userId: targetUserId,
          userEmail: targetEmail,
          userName: targetName,
          actionType: 'USER_LOGOUT',
          resourceType: 'auth',
          status: 'success',
          details: { allDevices: !!allDevices },
          req
        });
      }

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  // Token Refresh with Rotation & Reuse Detection
  app.post('/api/auth/refresh', refreshLimiter, async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token required' });
      }

      const submittedHash = hashToken(refreshToken);

      // Find token in database
      const [rows] = await pool.execute(
        'SELECT id, user_id, token, token_hash, expires_at, revoked_at, replaced_by_hash FROM refresh_tokens WHERE token_hash = ? OR token = ?',
        [submittedHash, refreshToken]
      );

      if (!rows || rows.length === 0) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      const tokenRecord = rows[0];

      // Reuse detection: If token was already revoked or replaced, this is a token replay attack!
      if (tokenRecord.revoked_at !== null || tokenRecord.replaced_by_hash !== null) {
        console.warn(`🚨 REFRESH TOKEN REUSE DETECTED for user ${tokenRecord.user_id}! Revoking all sessions.`);
        // Invalidate all refresh tokens for this user
        await pool.execute(
          'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?',
          [tokenRecord.user_id]
        );
        // Increment token_version to invalidate all access tokens
        await pool.execute(
          'UPDATE users SET token_version = token_version + 1 WHERE id = ?',
          [tokenRecord.user_id]
        );

        if (logAuditEvent) {
          await logAuditEvent(pool, {
            orgId: 1,
            userId: tokenRecord.user_id,
            actionType: 'TOKEN_REUSE_DETECTED',
            resourceType: 'auth',
            status: 'denied',
            details: {
              alert: 'Replayed or already-revoked refresh token used',
              securityAction: 'All user sessions revoked and token version incremented'
            },
            req
          });
        }

        return res.status(401).json({
          error: 'Compromised or already-used refresh token. All sessions have been revoked for your security.',
          code: 'TOKEN_REUSE_DETECTED'
        });
      }

      // Expiration check
      if (new Date(tokenRecord.expires_at) < new Date()) {
        await pool.execute(
          'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?',
          [tokenRecord.id]
        );
        return res.status(401).json({ error: 'Refresh token expired', code: 'TOKEN_EXPIRED' });
      }

      // Check user existence and active status
      const [users] = await pool.execute(
        'SELECT id, email, organization_id, role, status, token_version FROM users WHERE id = ?',
        [tokenRecord.user_id]
      );

      if (!users || users.length === 0) {
        await pool.execute('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?', [tokenRecord.id]);
        return res.status(401).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
      }

      const user = users[0];
      if (user.status !== 'active') {
        await pool.execute('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?', [tokenRecord.id]);
        return res.status(401).json({ error: 'Account is deactivated or inactive', code: 'ACCOUNT_INACTIVE' });
      }

      // Rotate Refresh Token
      const { accessToken: newAccessToken, rawRefreshToken: newRawRefreshToken, tokenHash: newHash, expiresAt: newExpiresAt } = generateTokens(user);

      // Atomically mark old token revoked & record replacement
      await pool.execute(
        'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP, replaced_by_hash = ? WHERE id = ?',
        [newHash, tokenRecord.id]
      );

      // Insert new refresh token record
      await pool.execute(
        'INSERT INTO refresh_tokens (user_id, token, token_hash, expires_at) VALUES (?, ?, ?, ?)',
        [user.id, newRawRefreshToken, newHash, newExpiresAt]
      );

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRawRefreshToken
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({ error: 'Token refresh failed' });
    }
  });

  // Routes for Dashboard Get requests
  app.get('/api/org_members/:userId', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      const users = await dbOps.listOrganizationUsers(userId);

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

  app.get('/api/invited_users/:userId', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      const users = await dbOps.listInvitedUsers(userId);

      res.json(users);
    } catch (error) {
      console.error('Error fetching invited members:', error);
      res.status(500).json({ error: 'Failed to fetch invited members' });
    }
  });

  app.get('/api/users', authenticateToken, async (req, res) => {
    try {
      const orgId = req.user.organization_id || req.user.orgId;
      const [users] = await pool.execute(
        'SELECT id, first_name, last_name, email, role, department, site, template_approver, status FROM users WHERE organization_id = ? AND status != ?',
        [orgId, 'inactive']
      );
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
  });
};
