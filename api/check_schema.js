const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;
const opDashUrl = databaseUrl ? databaseUrl.replace(/\/[^/]+$/, '/OpDash') : null;

const pool = new Pool({
    connectionString: opDashUrl,
    ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'task_list';
        `);
        console.log("Columns in 'task_list':");
        res.rows.forEach(row => console.log(` - ${row.column_name}`));
    } catch (err) {
        console.error("Error checking columns:", err);
    } finally {
        client.release();
        pool.end();
    }
}

checkColumns();
