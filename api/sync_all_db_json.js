const {
    upsertProject,
    upsertActivity,
    upsertSubtask,
    upsertEmployee,
    upsertMilestone,
    upsertCatchup,
    upsertDivision
} = require('./azureDb');
const { readDb } = require('./db');

async function syncAll() {
    console.log("Syncing all data from db.json to Azure DB...");
    const db = readDb();

    // Divisions
    const divisions = db.divisions || [];
    console.log(`Syncing ${divisions.length} divisions...`);
    for (const d of divisions) {
        await upsertDivision(d);
    }

    // Employees / Users
    const users = db.users || [];
    console.log(`Syncing ${users.length} employees...`);
    for (const u of users) {
        await upsertEmployee({
            id: u.id,
            first_name: u.first_name,
            middle_name: u.middle_name || '',
            last_name: u.last_name,
            division_id: u.division_id,
            division: u.division || 'Unknown',
            position: u.position || 'Staff',
            hourly_rate: Number(u.hourly_rate) || 0,
            created_at: u.created_at || new Date().toISOString()
        });
    }

    // Projects
    const projects = db.projects || [];
    console.log(`Syncing ${projects.length} projects...`);
    for (const p of projects) {
        await upsertProject(p);
    }

    // Tasks (Activities in Azure DB)
    const tasks = db.tasks || [];
    console.log(`Syncing ${tasks.length} activities...`);
    for (const t of tasks) {
        await upsertActivity(t);
    }

    // Subtasks (task_list in Azure DB)
    const subtasks = db.subtasks || [];
    console.log(`Syncing ${subtasks.length} subtasks...`);
    for (const st of subtasks) {
        await upsertSubtask(st);
    }

    // Milestones
    const milestones = db.milestones || [];
    console.log(`Syncing ${milestones.length} milestones...`);
    for (const m of milestones) {
        await upsertMilestone(m);
    }

    // Catchups
    const catchups = db.catchups || [];
    console.log(`Syncing ${catchups.length} catchups...`);
    for (const c of catchups) {
        await upsertCatchup(c);
    }

    console.log("Full sync from db.json complete.");
    process.exit(0);
}

syncAll().catch(err => {
    console.error("Sync failed:", err);
    process.exit(1);
});
