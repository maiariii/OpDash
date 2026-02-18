const { readDb, writeDb } = require('./db');
const { v4: uuidv4 } = require('uuid');
const {
    ensureTableAndInsertProject,
    ensureTableAndInsertActivity,
    ensureTableAndInsertTask,
    ensureTableAndInsertMilestone,
    ensureTableAndInsertCatchUp,
    truncateAllTables
} = require('./azureDb');

const seedData = async () => {
    console.log("Starting Database Seed...");

    // 1. Clear Azure DB
    await truncateAllTables();

    // 2. Read Local DB to get existing Dropdown Data
    const db = readDb();
    const divisions = db.divisions || [];
    const employees = db.users || [];

    if (divisions.length === 0 || employees.length === 0) {
        console.error("No divisions or employees found. Cannot seed based on existing dropdowns.");
        return;
    }

    // 3. Clear Local Project Data
    db.projects = [];
    db.tasks = []; // activities
    db.milestones = [];
    db.catchups = [];

    // 4. Generate Seed Data
    const projects = [
        {
            name: "National Learning Camp 2026",
            description: "Implementation of learning recovery camps across all regions.",
            basecamp_target: "Career Progression for DepEd Personnel, Workforce Plan and Management"
        },
        {
            name: "DepEd Digi-Transformation",
            description: "Upgrading digital infrastructure and learning management systems.",
            basecamp_target: "HROD Process Excellence"
        },
        {
            name: "Teacher Upskilling Program",
            description: "Professional development series for K-12 educators.",
            basecamp_target: "Career Opportunities in DepEd for SHS Graduates"
        }
    ];

    for (const p of projects) {
        const division = divisions[Math.floor(Math.random() * divisions.length)];
        const lead = employees.find(e => e.division_id === division.id) || employees[0];
        const supervisor = employees.find(e => e.id !== lead.id) || employees[1];

        const projectId = `HROD-P${Math.floor(1000 + Math.random() * 9000)}`;

        const newProject = {
            id: projectId,
            name: p.name,
            description: p.description,
            division: division.name,
            lead_personnel: `${lead.first_name} ${lead.last_name}`,
            supervising_officer: `${supervisor.first_name} ${supervisor.last_name}`,
            assisting_personnel: "Staff A, Staff B",
            status: "Ongoing",
            total_budget: 1000000 + Math.random() * 5000000,
            basecamp_target: p.basecamp_target,
            created_at: new Date().toISOString()
        };

        db.projects.push(newProject);
        await ensureTableAndInsertProject(newProject);

        // Add Activities
        const activityCount = 3 + Math.floor(Math.random() * 3);
        const statuses = ["Todo", "In Progress", "Done", "Delayed"];

        for (let i = 0; i < activityCount; i++) {
            const actId = `HROD-A${Math.floor(10000 + Math.random() * 90000)}`;
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const newActivity = {
                id: actId,
                project_id: projectId,
                title: `Activity ${i + 1} for ${p.name}`,
                objective: "To complete specific deliverables.",
                status: status,
                start_date: new Date().toISOString().split('T')[0],
                due_date: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
                budget: 50000,
                cost: 20000,
                assignee_id: lead.id,
                path: actId,
                created_at: new Date().toISOString()
            };

            db.tasks.push(newActivity);
            await ensureTableAndInsertActivity(newActivity);

            // Add Milestones
            if (i === 0) {
                const mileId = `HROD-M${Math.floor(10000 + Math.random() * 90000)}`;
                const newMilestone = {
                    id: mileId,
                    project_id: projectId,
                    title: `Kickoff for ${p.name}`,
                    description: "Initial stakeholder meeting",
                    target_date: new Date().toISOString().split('T')[0],
                    status: "Completed",
                    notes: "Went well",
                    created_at: new Date().toISOString()
                };
                db.milestones.push(newMilestone);
                await ensureTableAndInsertMilestone(newMilestone);
            }

            // Add Catch-up if delayed
            if (status === "Delayed") {
                const catchId = uuidv4();
                const newCatchUp = {
                    id: catchId,
                    activity_id: actId,
                    title: `Catch-up for Activity ${i + 1}`,
                    description: "Expedited processing required",
                    target_date: new Date(Date.now() + 86400000 * 15).toISOString().split('T')[0],
                    status: "Pending",
                    reason: "Unforeseen delays in procurement",
                    created_at: new Date().toISOString()
                };
                db.catchups.push(newCatchUp);
                await ensureTableAndInsertCatchUp(newCatchUp);
            }
        }
    }

    writeDb(db);
    console.log("Database Seed Full Completed!");
};

seedData().catch(err => console.error("Seeding Failed:", err));
