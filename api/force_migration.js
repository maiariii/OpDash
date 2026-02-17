const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;
const opDashUrl = databaseUrl ? databaseUrl.replace(/\/[^/]+$/, '/OpDash') : null;

const pool = new Pool({
    connectionString: opDashUrl,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log("Adding 'description' column to 'task_list' if missing...");
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_list' AND column_name='description') THEN 
                    ALTER TABLE task_list ADD COLUMN description TEXT; 
                END IF; 
            END $$;
        `);
        console.log("Migration completed successfully.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
