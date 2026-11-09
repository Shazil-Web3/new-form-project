// Dev role bypass: Auth NOT built yet, no password.
// Reads X-Dev-Role header or ?devRole= query (?devRole= wins when both set
// is NOT required - header wins), attaches req.devRole = { role } or null.
import { DEV_ROLES, resolveDevRole } from "../comment/commentStore";

function devRoleBypass(req, _res, next) {
  const header = req.headers ? req.headers["x-dev-role"] : undefined;
  const headerValue = Array.isArray(header) ? header[0] : header;
  const queryValue = req.query ? req.query.devRole : undefined;
  const role = resolveDevRole(headerValue, queryValue);
  req.devRole = role ? { role, dev: true } : null;
  next();
}

function requireDevRole(_req, res, next) {
  void _req; void res;
  next();
}

export { DEV_ROLES, devRoleBypass, requireDevRole };
