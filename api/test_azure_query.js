const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error("DATABASE_URL not found.");
    process.exit(1);
}
const opDashUrl = databaseUrl.replace(/\/[^/]+$/, '/OpDash');

const pool = new Pool({
    connectionString: opDashUrl,
    ssl: { rejectUnauthorized: false }
});

async function queryActivity(id) {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM activities_list WHERE id = $1', [id]);
        if (res.rows.length > 0) {
            console.log("Activity found:", res.rows[0]);
        } else {
            console.log("Activity NOT found with ID:", id);
        }
    } catch (err) {
        console.error("Query failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

// Ensure an ID is passed as argument
const id = process.argv[2];
if (!id) {
    console.error("Please provide an activity ID to query.");
    process.exit(1);
}

queryActivity(id);
