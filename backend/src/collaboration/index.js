const jwt = require('jsonwebtoken');
const registerTemplateCollaboration = require('./templateCollaboration');
const registerDocumentCollaboration = require('./documentCollaboration');

module.exports = function registerCollaboration({ io, pool }) {
  // Socket.IO authentication middleware
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;
      if (!token && socket.handshake.headers?.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      }

      if (!token) {
        return next(new Error('Authentication error: Access token required'));
      }

      const decoded = jwt.verify(token, process.env.ACCESS_SECRET, {
        algorithms: ['HS256']
      });

      const targetUserId = decoded.userId || decoded.sub;
      if (!targetUserId) {
        return next(new Error('Authentication error: Invalid token claims'));
      }

      const [users] = await pool.execute(
        'SELECT id, email, organization_id, role, status, token_version FROM users WHERE id = ?',
        [targetUserId]
      );

      if (!users || users.length === 0) {
        return next(new Error('Authentication error: User not found'));
      }

      const user = users[0];
      if (user.status !== 'active') {
        return next(new Error('Authentication error: Account is deactivated or inactive'));
      }

      if (decoded.token_version !== undefined && Number(decoded.token_version) !== Number(user.token_version)) {
        return next(new Error('Authentication error: Session invalidated'));
      }

      socket.user = {
        userId: user.id,
        id: user.id,
        email: user.email,
        organization_id: user.organization_id,
        orgId: user.organization_id,
        role: user.role,
        token_version: user.token_version
      };

      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new Error('Authentication error: Access token expired'));
      }
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on("connection", (socket) => {
    registerTemplateCollaboration(socket, { io, pool });
    registerDocumentCollaboration(socket, { io, pool });
  });
};

