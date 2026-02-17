const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const logFile = path.join(__dirname, 'debug_log.txt');
const log = (msg) => fs.appendFileSync(logFile, `[${new Date().toISOString()}] [AzureDB] ${msg}\n`);

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error("DATABASE_URL not found in .env");
}

// Modify URL to connect to 'OpDash' database
const opDashUrl = databaseUrl ? databaseUrl.replace(/\/[^/]+$/, '/OpDash') : null;

const pool = opDashUrl ? new Pool({
    connectionString: opDashUrl,
    ssl: { rejectUnauthorized: false }
}) : null;

// Ensure table exists
const ensureTableExistsQuery = `
CREATE TABLE IF NOT EXISTS projects_list (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    division TEXT,
    lead_personnel TEXT,
    supervising_officer TEXT,
    assisting_personnel TEXT,
    status TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities_list (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT NOT NULL,
    objective TEXT,
    status TEXT,
    start_date DATE,
    due_date DATE,
    budget NUMERIC,
    cost NUMERIC,
    assignee_id TEXT,
    path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS task_list (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    activity_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT,
    assignee_id TEXT,
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_list (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    division_id TEXT,
    position TEXT,
    hourly_rate NUMERIC,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS indicator_list (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    indicator TEXT NOT NULL,
    target NUMERIC,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function ensureTableAndInsertProject(projectData) {
    if (!pool) {
        console.error("Pool not initialized. Check .env configuration.");
        return;
    }

    const client = await pool.connect();
    try {
        await client.query(ensureTableExistsQuery);

        const insertQuery = `
            INSERT INTO projects_list (
                id, name, description, division, lead_personnel, 
                supervising_officer, assisting_personnel, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                division = EXCLUDED.division,
                lead_personnel = EXCLUDED.lead_personnel,
                supervising_officer = EXCLUDED.supervising_officer,
                assisting_personnel = EXCLUDED.assisting_personnel,
                status = EXCLUDED.status;
        `;

        const values = [
            projectData.id,
            projectData.name,
            projectData.description || '',
            projectData.division || 'N/A',
            projectData.lead_personnel || 'N/A',
            projectData.supervising_officer || 'N/A',
            projectData.assisting_personnel || 'N/A',
            projectData.status || 'Planning',
            projectData.created_at || new Date().toISOString()
        ];

        await client.query(insertQuery, values);
        console.log(`Project ${projectData.name} (${projectData.id}) lodged in OpDash database.`);
    } catch (err) {
        console.error("Error logging project to Azure DB:", err);
    } finally {
        client.release();
    }
}



async function ensureTableAndInsertActivity(activityData) {
    if (!pool) {
        log("Azure DB Pool not initialized. Please check DATABASE_URL in .env");
        return;
    }

    log(`Attempting to log activity: "${activityData.title}" (ID: ${activityData.id})`);

    const client = await pool.connect();
    try {
        await client.query(ensureTableExistsQuery);

        // Sanitize numeric fields (remove commas if string, default to 0)
        const parseMoney = (val) => {
            if (typeof val === 'string') return Number(val.replace(/,/g, '')) || 0;
            return Number(val) || 0;
        };

        const budget = parseMoney(activityData.budget);
        const cost = parseMoney(activityData.cost);

        // Sanitize dates: Postgres DATE handles ISO strings, but empty string must be NULL
        const startDate = (activityData.start_date && activityData.start_date.trim() !== '') ? activityData.start_date : null;
        const dueDate = (activityData.due_date && activityData.due_date.trim() !== '') ? activityData.due_date : null;

        const insertQuery = `
            INSERT INTO activities_list (
                id, project_id, title, objective, status, 
                start_date, due_date, budget, cost, 
                assignee_id, path, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                objective = EXCLUDED.objective,
                status = EXCLUDED.status,
                start_date = EXCLUDED.start_date,
                due_date = EXCLUDED.due_date,
                budget = EXCLUDED.budget,
                cost = EXCLUDED.cost,
                assignee_id = EXCLUDED.assignee_id,
                path = EXCLUDED.path;
        `;

        const values = [
            activityData.id,
            activityData.project_id,
            activityData.title,
            activityData.objective || '',
            activityData.status || 'Todo',
            startDate,
            dueDate,
            budget,
            cost,
            activityData.assignee_id || null,
            activityData.path || String(activityData.id)
        ];

        await client.query(insertQuery, values);
        log(`Activity "${activityData.title}" successfully synced to OpDash DB.`);
    } catch (err) {
        log(`CRITICAL ERROR logging activity: ${err.message}`);
        log(`Payload was: ${JSON.stringify(activityData, null, 2)}`);
    } finally {
        client.release();
    }
}

async function ensureTableAndInsertTask(taskData) {
    if (!pool) {
        log("Azure DB Pool not initialized.");
        return;
    }

    const client = await pool.connect();
    try {
        await client.query(ensureTableExistsQuery);

        // Ensure description column exists (migration for existing tables)
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_list' AND column_name='description') THEN 
                    ALTER TABLE task_list ADD COLUMN description TEXT; 
                END IF; 
            END $$;
        `);

        const insertQuery = `
            INSERT INTO task_list (
                id, project_id, activity_id, title, description, status, 
                assignee_id, due_date, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                status = EXCLUDED.status,
                assignee_id = EXCLUDED.assignee_id,
                due_date = EXCLUDED.due_date;
        `;

        const dueDate = (taskData.due_date && taskData.due_date.trim() !== '') ? taskData.due_date : null;

        const values = [
            taskData.id,
            taskData.project_id,
            taskData.activity_id,
            taskData.title,
            taskData.description || '',
            taskData.status || 'Todo',
            taskData.assignee_id || null,
            dueDate
        ];

        await client.query(insertQuery, values);
        log(`Task "${taskData.title}" (${taskData.id}) synced to OpDash DB.`);
    } catch (err) {
        log(`Error logging task to Azure DB: ${err.message}`);
    } finally {
        client.release();
    }
}

async function ensureTableAndInsertEmployee(employeeData) {
    if (!pool) {
        log("Azure DB Pool not initialized.");
        return;
    }

    const client = await pool.connect();
    try {
        await client.query(ensureTableExistsQuery);

        // Migration: Ensure 'division' column exists and 'hourly_rate' is removed (optional, but good practice to sync schema)
        await client.query(`
            DO $$ 
            BEGIN 
                -- Add division column if missing
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employee_list' AND column_name='division') THEN 
                    ALTER TABLE employee_list ADD COLUMN division TEXT; 
                END IF;
                -- Drop hourly_rate column if exists
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employee_list' AND column_name='hourly_rate') THEN 
                    ALTER TABLE employee_list DROP COLUMN hourly_rate; 
                END IF;
            END $$;
        `);

        const insertQuery = `
            INSERT INTO employee_list (
                id, first_name, middle_name, last_name, division, 
                position, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                middle_name = EXCLUDED.middle_name,
                last_name = EXCLUDED.last_name,
                division = EXCLUDED.division,
                position = EXCLUDED.position;
        `;

        const values = [
            employeeData.id,
            employeeData.first_name,
            employeeData.middle_name || '',
            employeeData.last_name,
            employeeData.division || 'Unknown', // Use the resolved name
            employeeData.position || 'Staff'
        ];

        await client.query(insertQuery, values);
        log(`Employee "${employeeData.first_name} ${employeeData.last_name}" synced to OpDash DB.`);
    } catch (err) {
        log(`Error logging employee to Azure DB: ${err.message}`);
    } finally {
        client.release();
    }
}

async function ensureTableAndInsertIndicator(indicatorData) {
    if (!pool) {
        log("Azure DB Pool not initialized.");
        return;
    }

    const client = await pool.connect();
    try {
        await client.query(ensureTableExistsQuery); // Ensure indicator_list exists

        // Migration: Ensure activity_id column exists
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='indicator_list' AND column_name='activity_id') THEN 
                    ALTER TABLE indicator_list ADD COLUMN activity_id TEXT; 
                END IF; 
            END $$;
        `);

        const insertQuery = `
            INSERT INTO indicator_list (
                id, project_id, activity_id, indicator, target, created_at
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
                indicator = EXCLUDED.indicator,
                activity_id = EXCLUDED.activity_id,
                target = EXCLUDED.target;
        `;

        const values = [
            indicatorData.id,
            indicatorData.project_id,
            indicatorData.activity_id || null,
            indicatorData.indicator,
            Number(indicatorData.target) || 0
        ];

        await client.query(insertQuery, values);
        log(`Indicator "${indicatorData.indicator}" synced to OpDash DB.`);
    } catch (err) {
        log(`Error logging indicator to Azure DB: ${err.message}`);
    } finally {
        client.release();
    }
}

async function ensureTableAndInsertCatchUp(catchUpData) {
    if (!pool) {
        log("Azure DB Pool not initialized.");
        return;
    }

    const client = await pool.connect();
    try {
        // Ensure table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS catchup_list (
                id TEXT PRIMARY KEY,
                activity_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                target_date DATE,
                status TEXT DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const insertQuery = `
            INSERT INTO catchup_list (
                id, activity_id, title, description, target_date, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                target_date = EXCLUDED.target_date,
                status = EXCLUDED.status;
        `;

        const values = [
            catchUpData.id,
            catchUpData.activity_id,
            catchUpData.title,
            catchUpData.description || '',
            catchUpData.target_date || null,
            catchUpData.status || 'Pending'
        ];

        await client.query(insertQuery, values);
        log(`Catch-up Activity "${catchUpData.title}" synced to OpDash DB.`);
    } catch (err) {
        log(`Error logging catch-up activity to Azure DB: ${err.message}`);
    } finally {
        client.release();
    }
}

module.exports = { ensureTableAndInsertProject, ensureTableAndInsertActivity, ensureTableAndInsertTask, ensureTableAndInsertEmployee, ensureTableAndInsertIndicator, ensureTableAndInsertCatchUp };
