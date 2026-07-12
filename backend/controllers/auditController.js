const db = require('../config/database');
const PDFDocument = require('pdfkit');

// Build the audit filter once (actor_type, action, from, to) so the list, its
// count and the PDF export all stay in sync. Returns { where, params }.
function buildAuditFilter({ actor_type, action, from, to } = {}) {
  let where = 'WHERE 1=1';
  const params = [];
  if (actor_type) { where += ' AND actor_type = ?'; params.push(actor_type); }
  if (action)     { where += ' AND action LIKE ?'; params.push(`%${action}%`); }
  if (from)       { where += ' AND created_at >= ?'; params.push(from); }
  if (to)         { where += ' AND created_at <= ?'; params.push(to); }
  return { where, params };
}

async function getAll(req, res) {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const { where, params: filterParams } = buildAuditFilter(req.query);

    const [rows] = await db.query(
      `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...filterParams, parseInt(limit), parseInt(offset)]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM audit_logs ${where}`, filterParams);
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
}

async function exportPdf(req, res) {
  try {
    // Honour the same filters the list is showing (actor_type, action, from, to).
    const { where, params } = buildAuditFilter(req.query);
    const [rows] = await db.query(
      `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT 500`,
      params
    );

    const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.pdf"`);
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text('KUPPET Migori — Audit Log Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString('en-KE')} — ${rows.length} records`, { align: 'center' });
    doc.moveDown();

    rows.forEach(r => {
      doc.fontSize(9).font('Helvetica')
        .text(`[${new Date(r.created_at).toLocaleString('en-KE')}] ${r.actor_type}/${r.actor_name} — ${r.action} on ${r.resource||''} #${r.resource_id||''} from ${r.ip_address||'?'}`, { width: 730 });
    });
    doc.end();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed' });
  }
}

module.exports = { getAll, exportPdf };
