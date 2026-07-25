const mysql = require('mysql2/promise');
require('dotenv').config();

const poolConfig = {
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kuppet_migori',
  waitForConnections: true,
  // Pool size, tunable via DB_POOL_LIMIT (default 15). IMPORTANT: Passenger can run
  // several Node worker processes, EACH with its own pool, so keep
  // pool_size × worker_count safely under the DB's max_user_connections (75 on the
  // Hostinger Business plan). 15 leaves ample headroom; don't raise it aggressively
  // without knowing how many app processes Passenger spawns.
  connectionLimit: parseInt(process.env.DB_POOL_LIMIT, 10) || 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+03:00',
};

if (process.env.DB_SOCKET) {
  poolConfig.socketPath = process.env.DB_SOCKET;
} else {
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.port = parseInt(process.env.DB_PORT) || 3306;
}

const pool = mysql.createPool(poolConfig);

pool.getConnection()
  .then(conn => {
    console.log('✓ MySQL database connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('✗ MySQL connection error:', err.message);
  });

module.exports = pool;
