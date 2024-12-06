require('dotenv').config();
const { Pool } = require('pg');

// Configure the database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false, // Set to true for stricter SSL verification
    },
});

module.exports = pool;
