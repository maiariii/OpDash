const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;
const hosts = ['OpDash', 'opdash', 'postgres', 'template1', 'Administrator1'];

async function testConnections() {
    for (const db of hosts) {
        const url = databaseUrl ? databaseUrl.replace(/\/[^/]+$/, '/' + db) : null;
        console.log(`Testing connection to database: ${db} using URL: ${url}`);
        const pool = new Pool({
            connectionString: url,
            ssl: false
        });
        
        try {
            const client = await pool.connect();
            console.log(`SUCCESS: Connected to database '${db}'!`);
            const res = await client.query("SELECT current_database(), session_user");
            console.log("DB info:", res.rows[0]);
            client.release();
            pool.end();
            return; // Stop on first success
        } catch (err) {
            console.log(`FAILED for '${db}':`, err.message);
            pool.end();
        }
    }
}

testConnections();
