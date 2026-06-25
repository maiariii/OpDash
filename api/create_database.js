const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;
// Connect to the default 'postgres' database instead of 'OpDash' to create it
const defaultDbUrl = databaseUrl ? databaseUrl.replace(/\/[^/]+$/, '/postgres') : null;

console.log("Connecting to default DB URL:", defaultDbUrl);

const pool = new Pool({
    connectionString: defaultDbUrl,
    ssl: false // Disable SSL since the server doesn't support it
});

async function createDb() {
    const client = await pool.connect();
    try {
        console.log("Checking if OpDash database exists...");
        const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'OpDash'");
        
        if (res.rows.length === 0) {
            console.log("Database 'OpDash' does not exist. Creating it...");
            // CREATE DATABASE cannot run inside a transaction block, so we run it directly
            await client.query('CREATE DATABASE "OpDash"');
            console.log("Database 'OpDash' created successfully!");
        } else {
            console.log("Database 'OpDash' already exists.");
        }
    } catch (err) {
        console.error("Error creating database:", err);
    } finally {
        client.release();
        pool.end();
    }
}

createDb();
