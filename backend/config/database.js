const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kuppet_migori',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+03:00',
});

pool.getConnection()
  .then(conn => {
    console.log('✓ MySQL database connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('✗ MySQL connection error:', err.message);
  });

module.exports = pool;
