const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Try loading .env from current directory first, then parent
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.DATABASE_URL) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error("DATABASE_URL not found in .env");
    process.exit(1);
}

// Modify URL to connect to 'OpDash' database (replicating logic from azureDb.js)
const opDashUrl = databaseUrl ? databaseUrl.replace(/\/[^/]+$/, '/OpDash') : null;

console.log(`Connecting to database...`);
// console.log(`URL: ${opDashUrl}`); // Be careful not to log credentials in production

const pool = new Pool({
    connectionString: opDashUrl,
    ssl: { rejectUnauthorized: false }
});

const tablesToMigrate = [
    'activities_list',
    'task_list', // Subtasks
    'milestones_list',
    'catchup_list',
    'projects_list'
];

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration...');

        for (const table of tablesToMigrate) {
            console.log(`\nChecking table: ${table}`);

            // 1. Todo -> Pending
            const resTodo = await client.query(`
                UPDATE ${table}
                SET status = 'Pending'
                WHERE status = 'Todo'
            `);
            if (resTodo.rowCount > 0) {
                console.log(`  Updated ${resTodo.rowCount} rows from 'Todo' to 'Pending'.`);
            } else {
                console.log(`  No rows found with status 'Todo'.`);
            }

            // 2. Done -> Accomplished
            const resDone = await client.query(`
                UPDATE ${table}
                SET status = 'Accomplished'
                WHERE status = 'Done'
            `);
            if (resDone.rowCount > 0) {
                console.log(`  Updated ${resDone.rowCount} rows from 'Done' to 'Accomplished'.`);
            } else {
                console.log(`  No rows found with status 'Done'.`);
            }

            // 3. Doing -> In Progress (Optional, but good for consistency if it exists)
            const resDoing = await client.query(`
                UPDATE ${table}
                SET status = 'In Progress'
                WHERE status = 'Doing'
            `);
            if (resDoing.rowCount > 0) {
                console.log(`  Updated ${resDoing.rowCount} rows from 'Doing' to 'In Progress'.`);
            }
        }

        console.log('\nMigration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
