const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;
const dbs = ['hrodi', 'opstracker', 'ops_tracker', 'stride', 'insighted', 'postgres_db', 'db', 'app'];

async function testConnections() {
    for (const db of dbs) {
        const url = databaseUrl ? databaseUrl.replace(/\/[^/]+$/, '/' + db) : null;
        console.log(`Testing database: ${db}`);
        const pool = new Pool({
            connectionString: url,
            ssl: false
        });
        
        try {
            const client = await pool.connect();
            console.log(`SUCCESS: Connected to database '${db}'!`);
            client.release();
            pool.end();
            return;
        } catch (err) {
            console.log(`FAILED for '${db}':`, err.message);
            pool.end();
        }
    }
}

testConnections();
