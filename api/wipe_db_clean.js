const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error("DATABASE_URL not found in .env");
    process.exit(1);
}

// Modify URL to connect to 'OpDash' database
const opDashUrl = databaseUrl.replace(/\/[^/]+$/, '/OpDash');

const pool = new Pool({
    connectionString: opDashUrl,
    ssl: { rejectUnauthorized: false }
});

async function wipeDatabase() {
    const client = await pool.connect();
    try {
        console.log("Connected to OpDash database...");
        console.log("Wiping tables: projects_list, activities_list, task_list, milestones_list, catchup_list, indicator_list...");

        // Excludes employee_list to preserve staff data
        await client.query(`
            TRUNCATE TABLE projects_list, activities_list, task_list, milestones_list, catchup_list, indicator_list RESTART IDENTITY CASCADE;
        `);

        console.log("✅ Successfully wiped project data tables.");
    } catch (err) {
        console.error("❌ Error wiping database:", err.message);
    } finally {
        client.release();
        pool.end();
    }
}

wipeDatabase();
