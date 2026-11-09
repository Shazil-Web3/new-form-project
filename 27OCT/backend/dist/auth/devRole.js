"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEV_ROLES = void 0;
exports.devRoleBypass = devRoleBypass;
exports.requireDevRole = requireDevRole;
// Dev role bypass: Auth NOT built yet, no password.
// Reads X-Dev-Role header or ?devRole= query (?devRole= wins when both set
// is NOT required - header wins), attaches req.devRole = { role } or null.
const commentStore_1 = require("../comment/commentStore");
Object.defineProperty(exports, "DEV_ROLES", { enumerable: true, get: function () { return commentStore_1.DEV_ROLES; } });
function devRoleBypass(req, _res, next) {
    const header = req.headers ? req.headers["x-dev-role"] : undefined;
    const headerValue = Array.isArray(header) ? header[0] : header;
    const queryValue = req.query ? req.query.devRole : undefined;
    const role = (0, commentStore_1.resolveDevRole)(headerValue, queryValue);
    req.devRole = role ? { role, dev: true } : null;
    next();
}
function requireDevRole(_req, res, next) {
    void _req;
    void res;
    next();
}
