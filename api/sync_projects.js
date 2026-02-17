const { ensureTableAndInsertProject } = require('./azureDb');
const { readDb } = require('./db');

async function syncProjects() {
    const db = readDb();
    const projects = db.projects || [];

    console.log(`Found ${projects.length} projects to sync...`);

    for (const project of projects) {
        console.log(`Syncing project: ${project.name} (${project.id})`);
        await ensureTableAndInsertProject(project);
    }

    console.log("Sync complete.");
    process.exit(0); // Ensure process terminates
}

syncProjects();
