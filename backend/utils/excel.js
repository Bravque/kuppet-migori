const ExcelJS = require('exceljs');

// Stream an array of flat row objects as an .xlsx download.
// Column headers are derived from the keys of the first row.
async function sendXlsx(res, { sheetName = 'Sheet1', filename, rows }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  if (rows && rows.length) {
    ws.columns = Object.keys(rows[0]).map((key) => ({ header: key, key, width: 18 }));
    ws.addRows(rows);
    ws.getRow(1).font = { bold: true };
  }

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await wb.xlsx.write(res);
  res.end();
}

module.exports = { sendXlsx };
