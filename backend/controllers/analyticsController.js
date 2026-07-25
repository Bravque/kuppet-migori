const db = require('../config/database');
const PDFDocument = require('pdfkit');

async function getSummary(req, res) {
  try {
    const [[members]] = await db.query(`
      SELECT
        -- Actual members only — a pending_approval row is a registration
        -- request, and a rejected row never became a member, so neither counts
        -- toward Total Members. Pending is surfaced separately (Member Requests).
        SUM(status IN ('approved','suspended')) as total_members,
        SUM(status = 'approved') as active_members,
        SUM(status = 'pending_approval') as pending_members,
        SUM(status = 'rejected') as rejected_members
      FROM members
    `);
    // JOIN members (and scholarships) so counts match the admin lists exactly —
    // an orphaned claim/application (member or scholarship since deleted) is
    // hidden from the INNER-JOIN lists, so it must not be counted here either.
    const [[bbf]] = await db.query(`
      SELECT
        COUNT(*) as bbf_submitted,
        SUM(bc.status = 'approved') as bbf_approved,
        SUM(bc.status = 'rejected') as bbf_rejected,
        SUM(bc.status = 'paid') as bbf_paid
      FROM bbf_claims bc JOIN members m ON bc.member_id = m.id
      WHERE bc.status != 'draft'
    `);
    const [[sch]] = await db.query(`
      SELECT COUNT(*) as sch_applications, SUM(sa.status = 'approved') as sch_approved
      FROM scholarship_applications sa
      JOIN members m ON sa.member_id = m.id
      JOIN scholarships s ON sa.scholarship_id = s.id
    `);
    const [[sms]] = await db.query(`
      SELECT COUNT(*) as sms_sent FROM sms_logs
      WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())
    `);
    const [[contacts]] = await db.query(`
      SELECT COUNT(*) as new_contacts FROM contacts WHERE status = 'new'
    `);
    const [[resources]] = await db.query('SELECT SUM(download_count) as total_downloads FROM resources');

    res.json({ success: true, data: {
      ...members, ...bbf, ...sch, ...sms, ...contacts,
      total_downloads: resources.total_downloads || 0,
    }});
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
}

async function getMonthlyTrends(req, res) {
  try {
    // Last 12 months of member registrations
    const [memberRows] = await db.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
      FROM members
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month ORDER BY month ASC
    `);
    const [bbfRows] = await db.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
      FROM bbf_claims
      WHERE status != 'draft' AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month ORDER BY month ASC
    `);
    const [smsRows] = await db.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
      FROM sms_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month ORDER BY month ASC
    `);

    // Build 12-month labels
    const labels = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const toArray = (rows) => labels.map(l => (rows.find(r => r.month === l) || { count: 0 }).count);

    res.json({ success: true, data: {
      labels: labels.map(l => { const [y, m] = l.split('-'); return new Date(y, m-1).toLocaleString('en', {month:'short', year:'numeric'}); }),
      members: toArray(memberRows),
      bbf_claims: toArray(bbfRows),
      sms: toArray(smsRows),
    }});
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch trends' });
  }
}

async function exportPdf(req, res) {
  try {
    const [[summary]] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM members WHERE status IN ('approved','suspended')) as total_members,
        (SELECT COUNT(*) FROM members WHERE status='approved') as approved_members,
        (SELECT COUNT(*) FROM members WHERE status='pending_approval') as pending_members,
        (SELECT COUNT(*) FROM bbf_claims bc JOIN members m ON bc.member_id=m.id WHERE bc.status!='draft') as total_bbf,
        (SELECT COUNT(*) FROM bbf_claims bc JOIN members m ON bc.member_id=m.id WHERE bc.status='approved') as approved_bbf,
        (SELECT COUNT(*) FROM scholarship_applications sa JOIN members m ON sa.member_id=m.id JOIN scholarships s ON sa.scholarship_id=s.id) as total_sch,
        (SELECT COUNT(*) FROM scholarship_applications sa JOIN members m ON sa.member_id=m.id JOIN scholarships s ON sa.scholarship_id=s.id WHERE sa.status='approved') as approved_sch
    `);

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kuppet-analytics-${new Date().toISOString().split('T')[0]}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text('KUPPET Migori', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('Analytics Report', { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString('en-KE')}`, { align: 'center' });
    doc.moveDown(2);

    const section = (title) => { doc.fontSize(13).font('Helvetica-Bold').text(title); doc.moveDown(0.5); };
    const row = (label, value) => { doc.fontSize(11).font('Helvetica').text(`${label}: ${value}`); };

    section('Membership');
    row('Total Members', summary.total_members);
    row('Approved Members', summary.approved_members);
    row('Member Requests', summary.pending_members);
    doc.moveDown();

    section('BBF Claims');
    row('Total Claims Submitted', summary.total_bbf);
    row('Claims Approved', summary.approved_bbf);
    doc.moveDown();

    section('Scholarship Applications');
    row('Total Applications', summary.total_sch);
    row('Applications Approved', summary.approved_sch);

    doc.end();
  } catch (err) {
    res.status(500).json({ success: false, message: 'PDF export failed' });
  }
}

module.exports = { getSummary, getMonthlyTrends, exportPdf };
