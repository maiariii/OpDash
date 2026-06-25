const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;
// Replace port 6432 with 5432
const directUrl = databaseUrl ? databaseUrl.replace(':6432', ':5432') : null;

console.log("Testing direct connection to port 5432...");
console.log("URL:", directUrl);

const pool = new Pool({
    connectionString: directUrl,
    ssl: false
});

async function testDirect() {
    try {
        const client = await pool.connect();
        console.log("SUCCESS: Connected directly to port 5432!");
        const res = await client.query("SELECT current_database(), session_user");
        console.log("DB info:", res.rows[0]);
        client.release();
    } catch (err) {
        console.log("FAILED to connect directly to port 5432:", err.message);
    } finally {
        pool.end();
    }
}

testDirect();
