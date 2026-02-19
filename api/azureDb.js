const { Pool } = require('pg');
// Forced update to clear cache
const path = require('path');
const fs = require('fs');

const logFile = path.join(__dirname, 'debug_log.txt');
const log = (msg) => fs.appendFileSync(logFile, `[${new Date().toISOString()}] [AzureDB] ${msg}\n`);

// Try loading .env from current directory first, then parent
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.DATABASE_URL) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

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

// Ensure tables exist
const ensureTableExistsQuery = `
CREATE TABLE IF NOT EXISTS projects_list (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    division TEXT, -- retained for backward compat, but we might rely on divisions_list
    lead_personnel TEXT,
    supervising_officer TEXT,
    assisting_personnel TEXT,
    status TEXT,
    basecamp_target TEXT,
    total_budget NUMERIC,
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
    milestone_id TEXT, -- Link to parent milestone
    path TEXT,
    priority TEXT DEFAULT 'Medium',
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
    division TEXT, -- Name of division
    position TEXT,
    hourly_rate NUMERIC,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS milestones_list (
    id TEXT PRIMARY KEY, -- This will be the control code e.g. HRODI-Mxxxx
    project_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    target_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catchup_list (
    id TEXT PRIMARY KEY,
    activity_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    target_date DATE,
    status TEXT DEFAULT 'Pending',
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS divisions_list (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_list (
    id TEXT PRIMARY KEY,
    activity_id TEXT, -- Can be linked to activity (tasks table in JSON, activities_list in SQL)
    description TEXT,
    amount NUMERIC,
    date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// Helper: Run generic query
const query = async (text, params) => {
    if (!pool) throw new Error("Database pool not initialized");
    const client = await pool.connect();
    try {
        const res = await client.query(text, params);
        return res;
    } finally {
        client.release();
    }
};

// --- GENERIC HELPERS ---

async function initDB() {
    await query(ensureTableExistsQuery);
    // Add columns if missing (Migrations)
    await query(`
        DO $$ 
        BEGIN 
            -- activities_list: priority
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities_list' AND column_name='priority') THEN 
                ALTER TABLE activities_list ADD COLUMN priority TEXT DEFAULT 'Medium'; 
            END IF;

            -- activities_list: milestone_id
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities_list' AND column_name='milestone_id') THEN 
                ALTER TABLE activities_list ADD COLUMN milestone_id TEXT; 
            END IF;

            -- activities_list: activity_type
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities_list' AND column_name='activity_type') THEN 
                ALTER TABLE activities_list ADD COLUMN activity_type TEXT; 
            END IF;

            -- Migration: Rename budget -> gms_allocation
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities_list' AND column_name='budget') THEN
                ALTER TABLE activities_list RENAME COLUMN budget TO gms_allocation;
            END IF;

            -- Migration: Rename cost -> obligated_amount
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities_list' AND column_name='cost') THEN
                ALTER TABLE activities_list RENAME COLUMN cost TO obligated_amount;
            END IF;

            -- projects_list: gaa_allocation
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects_list' AND column_name='gaa_allocation') THEN 
                ALTER TABLE projects_list ADD COLUMN gaa_allocation NUMERIC DEFAULT 0; 
            END IF;

            -- projects_list: gms_allocation
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects_list' AND column_name='gms_allocation') THEN 
                ALTER TABLE projects_list ADD COLUMN gms_allocation NUMERIC DEFAULT 0; 
            END IF;

            -- projects_list: gaa_ps
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects_list' AND column_name='gaa_ps') THEN 
                ALTER TABLE projects_list ADD COLUMN gaa_ps NUMERIC DEFAULT 0; 
            END IF;

            -- projects_list: gaa_mooe
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects_list' AND column_name='gaa_mooe') THEN 
                ALTER TABLE projects_list ADD COLUMN gaa_mooe NUMERIC DEFAULT 0; 
            END IF;
        END $$;
    `);
}

// Generate Control Code
async function generateControlCode(type) {
    let prefix = '';
    let table = '';
    let digits = 3;

    if (type === 'project') { prefix = 'HRODI-P'; table = 'projects_list'; }
    else if (type === 'activity') { prefix = 'HRODI-A'; table = 'activities_list'; }
    else if (type === 'task') { prefix = 'HRODI-T'; table = 'task_list'; } // Subtasks
    else if (type === 'employee') { prefix = 'HRODI-E'; table = 'employee_list'; digits = 4; }
    else if (type === 'milestone') { prefix = 'HRODI-M'; table = 'milestones_list'; digits = 4; }

    // Find max ID
    // We look for IDs that start with the prefix
    const res = await query(`
        SELECT id FROM ${table} 
        WHERE id LIKE $1 
        ORDER BY LENGTH(id) DESC, id DESC 
        LIMIT 1
    `, [`${prefix}%`]);

    let maxNum = 0;
    if (res.rows.length > 0) {
        const lastId = res.rows[0].id;
        const numPart = lastId.replace(prefix, '');
        maxNum = parseInt(numPart, 10);
        if (isNaN(maxNum)) maxNum = 0;
    }

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(digits, '0')}`;
}

// --- PROJECTS ---

async function getProjects() {
    const res = await query('SELECT * FROM projects_list ORDER BY created_at DESC');
    return res.rows;
}

async function getProjectById(id) {
    const res = await query('SELECT * FROM projects_list WHERE id = $1', [id]);
    return res.rows[0];
}

async function upsertProject(data) {
    await initDB();
    const q = `
        INSERT INTO projects_list(
            id, name, description, division, lead_personnel,
            supervising_officer, assisting_personnel, status, 
            basecamp_target, total_budget, gaa_allocation, gms_allocation, gaa_ps, gaa_mooe, created_at
        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, COALESCE($15, CURRENT_TIMESTAMP))
        ON CONFLICT(id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            division = EXCLUDED.division,
            lead_personnel = EXCLUDED.lead_personnel,
            supervising_officer = EXCLUDED.supervising_officer,
            assisting_personnel = EXCLUDED.assisting_personnel,
            status = EXCLUDED.status,
            basecamp_target = EXCLUDED.basecamp_target,
            total_budget = EXCLUDED.total_budget,
            gaa_allocation = EXCLUDED.gaa_allocation,
            gms_allocation = EXCLUDED.gms_allocation,
            gaa_ps = EXCLUDED.gaa_ps,
            gaa_mooe = EXCLUDED.gaa_mooe
        RETURNING *;
    `;
    const values = [
        data.id, data.name, data.description || '', data.division || 'N/A',
        data.lead_personnel || 'N/A', data.supervising_officer || 'N/A',
        data.assisting_personnel || 'N/A', data.status || 'Planning',
        data.basecamp_target || '', Number(data.total_budget) || 0,
        Number(data.gaa_allocation) || 0, Number(data.gms_allocation) || 0,
        Number(data.gaa_ps) || 0, Number(data.gaa_mooe) || 0,
        data.created_at
    ];
    const res = await query(q, values);
    return res.rows[0];
}


async function deleteProject(id) {
    await initDB();
    // 1. Delete Expenses linked to activities of this project
    await query(`
        DELETE FROM expense_list 
        WHERE activity_id IN (SELECT id FROM activities_list WHERE project_id = $1)
    `, [id]);

    // 2. Delete Catchups linked to activities of this project
    await query(`
        DELETE FROM catchup_list 
        WHERE activity_id IN (SELECT id FROM activities_list WHERE project_id = $1)
    `, [id]);

    // 3. Delete Subtasks (task_list) linked to project
    await query(`
        DELETE FROM task_list 
        WHERE project_id = $1 
           OR activity_id IN (SELECT id FROM activities_list WHERE project_id = $1)
    `, [id]);

    // 4. Delete Milestones linked to project
    await query('DELETE FROM milestones_list WHERE project_id = $1', [id]);

    // 5. Delete Activities linked to project
    await query('DELETE FROM activities_list WHERE project_id = $1', [id]);

    // 6. Delete Project itself
    await query('DELETE FROM projects_list WHERE id = $1', [id]);
}

// --- ACTIVITIES (Tasks in JSON) ---

async function getActivities(projectId = null) {
    let q = 'SELECT * FROM activities_list';
    const params = [];
    if (projectId) {
        q += ' WHERE project_id = $1';
        params.push(projectId);
    }
    q += ' ORDER BY path ASC';
    const res = await query(q, params);
    return res.rows;
}

async function getActivityById(id) {
    const res = await query('SELECT * FROM activities_list WHERE id = $1', [id]);
    return res.rows[0];
}

async function upsertActivity(data) {
    await initDB();
    const q = `
        INSERT INTO activities_list(
            id, project_id, title, objective, status,
            start_date, due_date, gms_allocation, obligated_amount,
            assignee_id, milestone_id, activity_type, path, priority, created_at
        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, COALESCE($15, CURRENT_TIMESTAMP))
        ON CONFLICT(id) DO UPDATE SET
            title = EXCLUDED.title,
            objective = EXCLUDED.objective,
            status = EXCLUDED.status,
            start_date = EXCLUDED.start_date,
            due_date = EXCLUDED.due_date,
            gms_allocation = EXCLUDED.gms_allocation,
            obligated_amount = EXCLUDED.obligated_amount,
            assignee_id = EXCLUDED.assignee_id,
            milestone_id = EXCLUDED.milestone_id,
            activity_type = EXCLUDED.activity_type,
            path = EXCLUDED.path,
            priority = EXCLUDED.priority
        RETURNING *;
    `;
    const values = [
        data.id, data.project_id, data.title, data.objective || '',
        data.status || 'Pending', data.start_date || null, data.due_date || null,
        Number(data.gms_allocation) || 0, Number(data.obligated_amount) || 0,
        data.assignee_id || null, data.milestone_id || null,
        data.activity_type || 'Deskwork', // Default or null
        data.path || data.id,
        data.priority || 'Medium', data.created_at
    ];
    const res = await query(q, values);
    return res.rows[0];
}

async function deleteActivity(id) {
    await initDB();
    // 1. Delete Expenses linked to activity
    await query('DELETE FROM expense_list WHERE activity_id = $1', [id]);

    // 2. Delete Catchups linked to activity
    await query('DELETE FROM catchup_list WHERE activity_id = $1', [id]);

    // 3. Delete Subtasks linked to activity
    await query('DELETE FROM task_list WHERE activity_id = $1', [id]);

    // 4. Delete Activity itself
    await query('DELETE FROM activities_list WHERE id = $1', [id]);
}

// --- SUBTASKS ---

async function getSubtasks(activityId = null) {
    let q = 'SELECT * FROM task_list';
    const params = [];
    if (activityId) {
        q += ' WHERE activity_id = $1';
        params.push(activityId);
    }
    const res = await query(q, params);
    return res.rows;
}

async function upsertSubtask(data) {
    await initDB();
    const q = `
        INSERT INTO task_list(
            id, project_id, activity_id, title, description, status,
            assignee_id, due_date, created_at
        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_TIMESTAMP))
        ON CONFLICT(id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            status = EXCLUDED.status,
            assignee_id = EXCLUDED.assignee_id,
            due_date = EXCLUDED.due_date
        RETURNING *;
    `;
    const values = [
        data.id, data.project_id, data.activity_id, data.title,
        data.description || '', data.status || 'Pending',
        data.assignee_id || null, data.due_date || null,
        data.created_at
    ];
    const res = await query(q, values);
    return res.rows[0];
}

async function deleteSubtask(id) {
    await query('DELETE FROM task_list WHERE id = $1', [id]);
}

// --- EMPLOYEES ---

async function getEmployees() {
    const res = await query('SELECT * FROM employee_list');
    return res.rows;
}

async function getEmployeeById(id) {
    const res = await query('SELECT * FROM employee_list WHERE id = $1', [id]);
    return res.rows[0];
}

async function upsertEmployee(data) {
    await initDB();
    const q = `
        INSERT INTO employee_list(
            id, first_name, middle_name, last_name, division,
            division_id, position, created_at
        ) VALUES($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_TIMESTAMP))
        ON CONFLICT(id) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            middle_name = EXCLUDED.middle_name,
            last_name = EXCLUDED.last_name,
            division = EXCLUDED.division,
            division_id = EXCLUDED.division_id,
            position = EXCLUDED.position
        RETURNING *;
    `;
    const values = [
        data.id, data.first_name, data.middle_name || '', data.last_name,
        data.division || 'Unknown', data.division_id || null,
        data.position || 'Staff', data.created_at
    ];
    const res = await query(q, values);
    return res.rows[0];
}

async function deleteEmployee(id) {
    await query('DELETE FROM employee_list WHERE id = $1', [id]);
}

// --- DIVISIONS ---

async function getDivisions() {
    const res = await query('SELECT * FROM divisions_list');
    return res.rows;
}

async function upsertDivision(data) {
    await initDB();
    const q = `
        INSERT INTO divisions_list(id, name, created_at)
        VALUES($1, $2, COALESCE($3, CURRENT_TIMESTAMP))
        ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name
        RETURNING *;
    `;
    // If id is not provided, generate one? API usually provides UUID
    const values = [data.id, data.name, data.created_at];
    const res = await query(q, values);
    return res.rows[0];
}

async function getMilestones(projectId = null) {
    let text = `
        SELECT
            m.*,
            COUNT(a.id)::int as total_activities,
            COUNT(CASE WHEN a.status IN ('Completed', 'Accomplished') THEN 1 END)::int as accomplished_activities
        FROM milestones_list m
        LEFT JOIN activities_list a ON m.id = a.milestone_id
    `;
    const params = [];

    if (projectId) {
        text += ' WHERE m.project_id = $1';
        params.push(projectId);
    }

    text += ' GROUP BY m.id ORDER BY m.target_date ASC';

    const res = await query(text, params);
    return res.rows.map(row => ({
        ...row,
        progress: row.total_activities > 0
            ? Math.round((row.accomplished_activities / row.total_activities) * 100)
            : 0
    }));
}

async function upsertMilestone(data) {
    await initDB();
    const q = `
        INSERT INTO milestones_list(
            id, project_id, title, description, target_date, notes, created_at
        ) VALUES($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_TIMESTAMP))
        ON CONFLICT(id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            target_date = EXCLUDED.target_date,
            notes = EXCLUDED.notes
        RETURNING *;
    `;
    const values = [
        data.id, data.project_id, data.title, data.description || '', data.target_date,
        data.notes || '', data.created_at
    ];
    const res = await query(q, values);
    return res.rows[0];
}

async function deleteMilestone(id) {
    await query('DELETE FROM milestones_list WHERE id = $1', [id]);
}


// --- EXPENSES ---

async function getExpenses(activityId) {
    const res = await query('SELECT * FROM expense_list WHERE activity_id = $1', [activityId]);
    return res.rows;
}

async function getExpensesByProject(projectId) {
    // Join with activities
    const q = `
        SELECT e.* FROM expense_list e
        JOIN activities_list a ON e.activity_id = a.id
        WHERE a.project_id = $1
    `;
    const res = await query(q, [projectId]);
    return res.rows;
}

async function addExpense(data) {
    await initDB();
    const q = `
        INSERT INTO expense_list(id, activity_id, description, amount, date, created_at)
        VALUES($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        RETURNING *;
    `;
    const values = [data.id, data.task_id || data.activity_id, data.description, data.amount, data.date];
    const res = await query(q, values);
    return res.rows[0];
}

async function deleteExpense(id) {
    await query('DELETE FROM expense_list WHERE id = $1', [id]);
}

// --- CATCHUPS ---
async function upsertCatchup(data) {
    await initDB();
    const q = `
        INSERT INTO catchup_list(
            id, activity_id, title, description, target_date, status, reason, created_at
        ) VALUES($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_TIMESTAMP))
        ON CONFLICT(id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            target_date = EXCLUDED.target_date,
            status = EXCLUDED.status,
            reason = EXCLUDED.reason
        RETURNING *;
    `;
    const values = [
        data.id, data.activity_id, data.title, data.description || '',
        data.target_date || null, data.status || 'Pending',
        data.reason || '', data.created_at
    ];
    const res = await query(q, values);
    return res.rows[0];
}


async function getCatchups(activityId = null) {
    let q = 'SELECT * FROM catchup_list';
    const params = [];
    if (activityId) {
        q += ' WHERE activity_id = $1';
        params.push(activityId);
    }
    const res = await query(q, params);
    return res.rows;
}

async function getCatchupsByProject(projectId) {
    // Join with activities to filter by project
    const q = `
        SELECT c.* FROM catchup_list c
        JOIN activities_list a ON c.activity_id = a.id
        WHERE a.project_id = $1
    `;
    const res = await query(q, [projectId]);
    return res.rows;
}



async function deleteCatchup(id) {
    await query('DELETE FROM catchup_list WHERE id = $1', [id]);
}

module.exports = {
    initDB,
    generateControlCode,
    getProjects, getProjectById, upsertProject, deleteProject,
    getActivities, getActivityById, upsertActivity, deleteActivity,
    getSubtasks, upsertSubtask, deleteSubtask,
    getEmployees, getEmployeeById, upsertEmployee, deleteEmployee,
    getDivisions, upsertDivision,
    getMilestones, upsertMilestone, deleteMilestone,
    getExpenses, getExpensesByProject, addExpense, deleteExpense,
    upsertCatchup, getCatchups, getCatchupsByProject, deleteCatchup,
    // Alias for backward compat / ease of refactor
    ensureTableAndInsertProject: upsertProject,
    ensureTableAndInsertActivity: upsertActivity,
    ensureTableAndInsertTask: upsertSubtask,
    ensureTableAndInsertEmployee: upsertEmployee,
    ensureTableAndInsertMilestone: upsertMilestone,
    ensureTableAndInsertCatchUp: upsertCatchup
};
