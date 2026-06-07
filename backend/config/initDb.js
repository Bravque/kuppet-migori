const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
  await connection.query(sql);
  console.log('✓ Database initialized successfully');
  await connection.end();
}

initDatabase().catch(err => {
  console.error('✗ Database initialization failed:', err.message);
  process.exit(1);
});
