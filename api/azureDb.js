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

    CREATE TABLE IF NOT EXISTS milestones_list (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    target_date DATE,
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function ensureTableAndInsertMilestone(milestoneData) {
    if (!pool) {
        log("Azure DB Pool not initialized.");
        return;
    }

    const client = await pool.connect();
    try {
        await client.query(ensureTableExistsQuery); // Ensure milestones_list exists

        // Migration: Add status/notes/milestone_id if missing, drop accomplishment if exists
        await client.query(`
            DO $$ 
            BEGIN 
                -- Add status column
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='milestones_list' AND column_name='status') THEN 
                    ALTER TABLE milestones_list ADD COLUMN status TEXT DEFAULT 'Pending'; 
                END IF;
                -- Add notes column
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='milestones_list' AND column_name='notes') THEN 
                    ALTER TABLE milestones_list ADD COLUMN notes TEXT; 
                END IF;
                -- Add milestone_id column (Control Number)
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='milestones_list' AND column_name='milestone_id') THEN 
                    ALTER TABLE milestones_list ADD COLUMN milestone_id TEXT; 
                END IF;
                -- Drop accomplishment column
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='milestones_list' AND column_name='accomplishment') THEN 
                    ALTER TABLE milestones_list DROP COLUMN accomplishment; 
                END IF;
            END $$;
        `);

        // APPEND-ONLY LOGIC:
        // 1. Generate a new UUID for the primary key 'id' of this specific history row.
        // 2. Store the Control Number (HRODI-Mxxxx) in 'milestone_id'.
        // 3. Always INSERT, never UPDATE.
        const { v4: uuidv4 } = require('uuid');
        const historyRowId = uuidv4();

        const insertQuery = `
            INSERT INTO milestones_list (
                id, milestone_id, project_id, title, description, target_date, status, notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        `;

        const targetDate = (milestoneData.target_date && milestoneData.target_date.trim() !== '') ? milestoneData.target_date : null;

        const values = [
            historyRowId,                // New UUID for this history entry
            milestoneData.id,            // HRODI-Mxxxx Control Number
            milestoneData.project_id,
            milestoneData.title,
            milestoneData.description || '',
            targetDate,
            milestoneData.status || 'Pending',
            milestoneData.notes || ''
        ];

        await client.query(insertQuery, values);
        log(`Milestone "${milestoneData.title}" (ID: ${milestoneData.id}) history log saved to OpDash DB.`);
    } catch (err) {
        log(`Error logging milestone to Azure DB: ${err.message}`);
    } finally {
        client.release();
    }
}
async function ensureTableAndInsertProject(projectData) {
    if (!pool) {
        console.error("Pool not initialized. Check .env configuration.");
        return;
    }

    const client = await pool.connect();
    try {
        await client.query(ensureTableExistsQuery);

        // Migration: Ensure 'basecamp_target' column exists
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'projects_list' AND column_name = 'basecamp_target') THEN
                    ALTER TABLE projects_list ADD COLUMN basecamp_target TEXT;
                END IF;
                -- Also ensure total_budget exists as we added it to API but maybe not DB yet
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'projects_list' AND column_name = 'total_budget') THEN
                    ALTER TABLE projects_list ADD COLUMN total_budget NUMERIC;
                END IF;
            END $$;
        `);

        const insertQuery = `
            INSERT INTO projects_list(
                id, name, description, division, lead_personnel,
                supervising_officer, assisting_personnel, status, 
                basecamp_target, total_budget, created_at
            ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT(id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                division = EXCLUDED.division,
                lead_personnel = EXCLUDED.lead_personnel,
                supervising_officer = EXCLUDED.supervising_officer,
                assisting_personnel = EXCLUDED.assisting_personnel,
                status = EXCLUDED.status,
                basecamp_target = EXCLUDED.basecamp_target,
                total_budget = EXCLUDED.total_budget;
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
            projectData.basecamp_target || '',
            Number(projectData.total_budget) || 0,
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

    log(`Attempting to log activity: "${activityData.title}"(ID: ${activityData.id})`);

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
            INSERT INTO activities_list(
    id, project_id, title, objective, status,
    start_date, due_date, budget, cost,
    assignee_id, path, created_at
) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
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
        log(`CRITICAL ERROR logging activity: ${err.message} `);
        log(`Payload was: ${JSON.stringify(activityData, null, 2)} `);
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
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'task_list' AND column_name = 'description') THEN 
                    ALTER TABLE task_list ADD COLUMN description TEXT; 
                END IF; 
            END $$;
`);

        const insertQuery = `
            INSERT INTO task_list(
    id, project_id, activity_id, title, description, status,
    assignee_id, due_date, created_at
) VALUES($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
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
        log(`Task "${taskData.title}"(${taskData.id}) synced to OpDash DB.`);
    } catch (err) {
        log(`Error logging task to Azure DB: ${err.message} `);
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
--Add division column if missing
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'employee_list' AND column_name = 'division') THEN 
                    ALTER TABLE employee_list ADD COLUMN division TEXT; 
                END IF;
--Drop hourly_rate column if exists
                IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'employee_list' AND column_name = 'hourly_rate') THEN 
                    ALTER TABLE employee_list DROP COLUMN hourly_rate; 
                END IF;
            END $$;
`);

        const insertQuery = `
            INSERT INTO employee_list(
    id, first_name, middle_name, last_name, division,
    position, created_at
) VALUES($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
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
        log(`Error logging employee to Azure DB: ${err.message} `);
    } finally {
        client.release();
    }
}

async function ensureTableAndInsertMilestone_OLD(milestoneData) {
    if (!pool) {
        log("Azure DB Pool not initialized.");
        return;
    }

    const client = await pool.connect();
    try {
        await client.query(ensureTableExistsQuery); // Ensure milestones_list exists

        const insertQuery = `
            INSERT INTO milestones_list(
    id, project_id, title, description, target_date, accomplishment, created_at
) VALUES($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
title = EXCLUDED.title,
    description = EXCLUDED.description,
    target_date = EXCLUDED.target_date,
    accomplishment = EXCLUDED.accomplishment;
`;

        const targetDate = (milestoneData.target_date && milestoneData.target_date.trim() !== '') ? milestoneData.target_date : null;

        const values = [
            milestoneData.id,
            milestoneData.project_id,
            milestoneData.title,
            milestoneData.description || '',
            targetDate,
            Number(milestoneData.accomplishment) || 0
        ];

        await client.query(insertQuery, values);
        log(`Milestone "${milestoneData.title}" synced to OpDash DB.`);
    } catch (err) {
        log(`Error logging milestone to Azure DB: ${err.message} `);
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
        await client.query(ensureTableExistsQuery);

        // Migration: Ensure 'reason' column exists
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'catchup_list' AND column_name = 'reason') THEN
                    ALTER TABLE catchup_list ADD COLUMN reason TEXT;
                END IF;
            END $$;
        `);

        const insertQuery = `
            INSERT INTO catchup_list(
                id, activity_id, title, description, target_date, status, reason, created_at
            ) VALUES($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                target_date = EXCLUDED.target_date,
                status = EXCLUDED.status,
                reason = EXCLUDED.reason;
        `;

        const values = [
            catchUpData.id,
            catchUpData.activity_id,
            catchUpData.title,
            catchUpData.description || '',
            catchUpData.target_date || null,
            catchUpData.status || 'Pending',
            catchUpData.reason || ''
        ];

        await client.query(insertQuery, values);
        log(`Catch - up Activity "${catchUpData.title}" synced to OpDash DB.`);
    } catch (err) {
        log(`Error logging catch-up activity to Azure DB: ${err.message} `);
    } finally {
        client.release();
    }
}

async function truncateAllTables() {
    if (!pool) {
        log("Azure DB Pool not initialized.");
        return;
    }

    const client = await pool.connect();
    try {
        await client.query(`
            TRUNCATE TABLE projects_list, activities_list, task_list, milestones_list, catchup_list RESTART IDENTITY CASCADE;
        `);
        log("All tables truncated successfully.");
    } catch (err) {
        log(`Error truncating tables: ${err.message}`);
    } finally {
        client.release();
    }
}

module.exports = {
    ensureTableAndInsertProject,
    ensureTableAndInsertActivity,
    ensureTableAndInsertTask,
    ensureTableAndInsertEmployee,
    ensureTableAndInsertMilestone,
    ensureTableAndInsertCatchUp,
    truncateAllTables
};
