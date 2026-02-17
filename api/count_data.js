const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/\/[^/]+$/, '/OpDash') : null,
    ssl: { rejectUnauthorized: false }
});

async function countData() {
    const client = await pool.connect();
    try {
        console.log("--- Database Counts ---");

        const tables = ['projects_list', 'activities_list', 'task_list', 'employee_list'];

        for (const table of tables) {
            const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
            console.log(`${table}: ${res.rows[0].count}`);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.release();
        pool.end();
    }
}

countData();
