const db = require('../config/database');
const PDFDocument = require('pdfkit');

async function getAll(req, res) {
  try {
    const { actor_type, action, from, to, limit = 50, offset = 0 } = req.query;
    let where = 'WHERE 1=1';
    const filterParams = [];
    if (actor_type) { where += ' AND actor_type = ?'; filterParams.push(actor_type); }
    if (action)     { where += ' AND action LIKE ?'; filterParams.push(`%${action}%`); }
    if (from)       { where += ' AND created_at >= ?'; filterParams.push(from); }
    if (to)         { where += ' AND created_at <= ?'; filterParams.push(to); }

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
    const [rows] = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');

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
