const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;
const testDbs = ['insightEd', 'insight_pooled', 'insighted-staging'];

async function checkDbs() {
    for (const db of testDbs) {
        const url = databaseUrl ? databaseUrl.replace(/\/[^/]+$/, '/' + db) : null;
        console.log(`Connecting to PgBouncer DB: ${db}...`);
        const pool = new Pool({
            connectionString: url,
            ssl: false
        });
        
        try {
            const client = await pool.connect();
            console.log(`Connected to '${db}'! Checking if tables exist...`);
            
            // Check if projects_list exists and count rows
            const tableCheck = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'projects_list'
                );
            `);
            
            if (tableCheck.rows[0].exists) {
                const countCheck = await client.query('SELECT COUNT(*) FROM projects_list');
                console.log(`Table 'projects_list' exists in '${db}' with ${countCheck.rows[0].count} rows!`);
                
                // Show a sample row if it exists
                if (parseInt(countCheck.rows[0].count, 10) > 0) {
                    const sample = await client.query('SELECT id, name FROM projects_list LIMIT 1');
                    console.log('Sample project:', sample.rows[0]);
                }
            } else {
                console.log(`Table 'projects_list' does NOT exist in '${db}'.`);
            }
            
            client.release();
            pool.end();
        } catch (err) {
            console.log(`Failed for '${db}':`, err.message);
            pool.end();
        }
    }
}

checkDbs();
