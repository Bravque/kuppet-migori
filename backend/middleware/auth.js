const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Verify admin JWT (JWT_SECRET)
const authenticate = (req, res, next) => {
  const token = extractBearer(req);
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    req.user = payload;
    next();
  });
};

// Verify member JWT (JWT_MEMBER_SECRET)
const authenticateMember = (req, res, next) => {
  const token = extractBearer(req);
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' });

  jwt.verify(token, process.env.JWT_MEMBER_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    req.member = payload;
    next();
  });
};

// Allow super_admin and branch_officer
const authorizeAdmin = (req, res, next) => {
  const role = req.user && req.user.role;
  if (role !== 'super_admin' && role !== 'branch_officer') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// Allow super_admin only
const authorizeSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Super admin access required' });
  }
  next();
};

// Audit log middleware factory — call after authenticate/authorizeAdmin
// Records the action to audit_logs after the response is sent
const auditLog = (action) => async (req, res, next) => {
  res.on('finish', async () => {
    if (res.statusCode >= 400) return;
    try {
      const actor = req.user || req.member;
      if (!actor) return;
      const actorType = req.user ? 'admin' : 'member';
      const ip = req.ip || req.connection.remoteAddress;
      const ua = req.headers['user-agent'] || '';
      const resourceId = req.params.id ? parseInt(req.params.id) : null;
      const resource = req.baseUrl.replace('/api/', '').split('/')[0];

      await db.query(
        `INSERT INTO audit_logs
           (actor_id, actor_type, actor_name, action, resource, resource_id, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [actor.id, actorType, actor.name || actor.full_name || '', action, resource, resourceId, ip, ua]
      );
    } catch (_) { /* audit failures must never break responses */ }
  });
  next();
};

function extractBearer(req) {
  const h = req.headers['authorization'];
  return h && h.startsWith('Bearer ') ? h.slice(7) : null;
}

module.exports = { authenticate, authenticateMember, authorizeAdmin, authorizeSuperAdmin, auditLog };
