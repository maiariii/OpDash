const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/\/[^/]+$/, '/OpDash') : null,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    const client = await pool.connect();
    try {
        console.log("Checking 'employee_list' columns...");
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'employee_list';
        `);
        const columns = res.rows.map(r => r.column_name);
        console.log("Columns:", columns);

        if (columns.includes('division') && !columns.includes('hourly_rate')) {
            console.log("✅ PASS: Schema matches requirements (division present, hourly_rate removed).");
        } else {
            console.log("❌ FAIL: Schema mismatch.");
            if (!columns.includes('division')) console.log("   - Missing 'division'");
            if (columns.includes('hourly_rate')) console.log("   - 'hourly_rate' still present");
        }

        console.log("\nListing last 3 employees:");
        const rows = await client.query('SELECT * FROM employee_list ORDER BY created_at DESC LIMIT 3');
        console.table(rows.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.release();
        pool.end();
    }
}

checkSchema();
