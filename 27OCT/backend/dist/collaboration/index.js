"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = registerCollaboration;
exports.classifySocketEvent = classifySocketEvent;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const templateCollaboration_1 = __importDefault(require("./templateCollaboration"));
const documentCollaboration_1 = __importDefault(require("./documentCollaboration"));
const accessControl_1 = require("../access/accessControl");
function classifySocketEvent(eventName) {
    const event = String(eventName || '').toLowerCase();
    const feature = event.includes('template') ? 'templates' : 'documents';
    let action = 'view';
    if (/comment|suggestion|review/.test(event)) {
        action = 'review';
    }
    else if (/content|textchange|element|delete/.test(event)) {
        action = 'edit';
    }
    return { feature, action };
}
function setSocketUser(socket, user) {
    socket.user = user;
}
function registerCollaboration({ io, pool }) {
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
            const decoded = jsonwebtoken_1.default.verify(token, process.env.ACCESS_SECRET, {
                algorithms: ['HS256']
            });
            const targetUserId = decoded.userId || decoded.sub;
            if (!targetUserId) {
                return next(new Error('Authentication error: Invalid token claims'));
            }
            const { rows: users } = await pool.query('SELECT id, email, organization_id, role, status, token_version FROM users WHERE id = $1', [targetUserId]);
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
            const access = await (0, accessControl_1.getEffectiveAccess)(pool, user);
            if (access.expired) {
                return next(new Error('Authentication error: Access assignment expired'));
            }
            setSocketUser(socket, {
                userId: user.id,
                id: user.id,
                email: user.email,
                organization_id: user.organization_id,
                orgId: user.organization_id,
                role: (0, accessControl_1.getEffectiveRole)(user.role, access.accessLevel?.key, access.isSuperAdmin),
                legacyRole: user.role,
                token_version: user.token_version,
                accessLevel: access.accessLevel,
                permissions: access.permissions,
                isSuperAdmin: access.isSuperAdmin,
                accessExpiresAt: access.expiresAt
            });
            next();
        }
        catch (err) {
            if (err.name === 'TokenExpiredError') {
                return next(new Error('Authentication error: Access token expired'));
            }
            return next(new Error('Authentication error: Invalid or expired token'));
        }
    });
    io.on("connection", (socket) => {
        socket.use(async ([eventName, ...args], next) => {
            let access;
            try {
                access = await (0, accessControl_1.getEffectiveAccess)(pool, {
                    id: socket.user?.userId,
                    email: socket.user?.email,
                    role: socket.user?.legacyRole
                });
            }
            catch (error) {
                console.error('Failed to validate collaboration access:', error);
                return next(new Error('Socket access validation failed'));
            }
            if (access.inactive || access.expired ||
                Number(access.tokenVersion) !== Number(socket.user?.token_version)) {
                socket.emit('accessDenied', {
                    error: 'Access is no longer active. Reconnect after your access has been updated.'
                });
                socket.disconnect(true);
                return next(new Error('Socket access expired or revoked'));
            }
            const requiredPermission = classifySocketEvent(eventName);
            if (access.isSuperAdmin ||
                (0, accessControl_1.canAccess)(access.permissions, requiredPermission.feature, requiredPermission.action)) {
                return next();
            }
            const acknowledge = args.slice().reverse().find(arg => typeof arg === 'function');
            if (acknowledge) {
                acknowledge({
                    error: 'Access denied: permission required',
                    requiredPermission: `${requiredPermission.feature}.${requiredPermission.action}`
                });
            }
            else {
                socket.emit('accessDenied', {
                    error: 'Access denied: permission required',
                    requiredPermission: `${requiredPermission.feature}.${requiredPermission.action}`
                });
            }
            return next(new Error('Socket event permission required'));
        });
        (0, templateCollaboration_1.default)(socket, { io, pool });
        (0, documentCollaboration_1.default)(socket, { io, pool });
    });
}
;
