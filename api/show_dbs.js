const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;
// Connect to the special 'pgbouncer' database
const pgbouncerUrl = databaseUrl ? databaseUrl.replace(/\/[^/]+$/, '/pgbouncer') : null;

console.log("Connecting to PgBouncer console URL:", pgbouncerUrl);

const pool = new Pool({
    connectionString: pgbouncerUrl,
    ssl: false
});

async function showDbs() {
    try {
        const client = await pool.connect();
        console.log("SUCCESS: Connected to PgBouncer console!");
        const res = await client.query("SHOW DATABASES");
        console.log("Databases configured in PgBouncer:");
        console.log(res.rows);
        client.release();
    } catch (err) {
        console.log("FAILED to connect to PgBouncer console:", err.message);
    } finally {
        pool.end();
    }
}

showDbs();
