const { Pool } = require("pg");

const DB = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false, // required for Neon SSL
    },
});

module.exports = DB;