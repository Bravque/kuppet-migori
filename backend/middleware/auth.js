const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Write a row to audit_logs. Never throws — audit failures must never break a request.
async function recordAudit({ actor, actorType, action, resource, resourceId, req, newValue }) {
  try {
    if (!actor) return;
    await db.query(
      `INSERT INTO audit_logs
         (actor_id, actor_type, actor_name, action, resource, resource_id, ip_address, user_agent, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actor.id, actorType, actor.name || actor.full_name || '', action,
        resource, resourceId,
        req.ip || req.connection.remoteAddress, req.headers['user-agent'] || '',
        newValue ? JSON.stringify(newValue) : null,
      ]
    );
  } catch (_) { /* swallow */ }
}

// Verify admin JWT (JWT_SECRET)
const authenticate = (req, res, next) => {
  const token = extractBearer(req);
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    req.user = payload;
    next();
  });
};

// Verify member JWT (JWT_MEMBER_SECRET)
const authenticateMember = (req, res, next) => {
  const token = extractBearer(req);
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' });

  jwt.verify(token, process.env.JWT_MEMBER_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    req.member = payload;
    next();
  });
};

// Roles allowed through authorizeAdmin. super_admin additionally passes every
// authorizeSuperAdmin gate; branch_officer and branch_secretary are peers with
// identical (review/recommend + content) access.
const ADMIN_ROLES = ['super_admin', 'branch_officer', 'branch_secretary'];

// Allow any admin role
const authorizeAdmin = (req, res, next) => {
  const role = req.user && req.user.role;
  if (!ADMIN_ROLES.includes(role)) {
    recordAudit({
      actor: req.user, actorType: 'admin', action: 'authz.denied',
      resource: req.baseUrl.replace('/api/', '').split('/')[0], resourceId: null, req,
      newValue: { status: 403, required: 'admin', role: role || null, method: req.method, path: req.originalUrl },
    });
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// Allow only the listed admin roles. super_admin is always allowed (it has full
// access to everything), so pass the extra roles that should also get through —
// e.g. authorizeRoles('branch_officer') → super_admin + branch_officer only.
const authorizeRoles = (...roles) => {
  const allowed = new Set(['super_admin', ...roles]);
  return (req, res, next) => {
    const role = req.user && req.user.role;
    if (!allowed.has(role)) {
      recordAudit({
        actor: req.user, actorType: 'admin', action: 'authz.denied',
        resource: req.baseUrl.replace('/api/', '').split('/')[0], resourceId: null, req,
        newValue: { status: 403, required: [...allowed], role: role || null, method: req.method, path: req.originalUrl },
      });
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
};

// Allow super_admin only
const authorizeSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role !== 'super_admin') {
    recordAudit({
      actor: req.user, actorType: 'admin', action: 'authz.denied',
      resource: req.baseUrl.replace('/api/', '').split('/')[0], resourceId: null, req,
      newValue: { status: 403, required: 'super_admin', role: req.user.role, method: req.method, path: req.originalUrl },
    });
    return res.status(403).json({ success: false, message: 'Super admin access required' });
  }
  next();
};

// Audit log middleware factory — call after authenticate/authorizeAdmin
// Records the action to audit_logs after the response is sent
const auditLog = (action) => (req, res, next) => {
  res.on('finish', () => {
    const actor = req.user || req.member;
    if (!actor) return;
    // Record both successful actions and failed attempts (400/404/409 etc.) — a failed
    // mutation is a security-relevant signal (probing, conflicts). Failures get a
    // `.failed` action suffix + the status code in new_value so they're easy to filter.
    const failed = res.statusCode >= 400;
    recordAudit({
      actor,
      actorType: req.user ? 'admin' : 'member',
      action: failed ? `${action}.failed` : action,
      resource: req.baseUrl.replace('/api/', '').split('/')[0],
      resourceId: req.params.id ? parseInt(req.params.id) : null,
      req,
      newValue: failed ? { status: res.statusCode } : null,
    });
  });
  next();
};

function extractBearer(req) {
  const h = req.headers['authorization'];
  return h && h.startsWith('Bearer ') ? h.slice(7) : null;
}

module.exports = { authenticate, authenticateMember, authorizeAdmin, authorizeRoles, authorizeSuperAdmin, auditLog };
