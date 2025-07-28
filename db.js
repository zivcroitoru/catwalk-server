import pkg from 'pg';
const { Pool } = pkg;

const DB = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

export default DB;