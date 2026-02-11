const { readDb, writeDb } = require('./db');
const fs = require('fs');
const path = require('path');

const resetProjects = () => {
    const db = readDb();

    // Backup before reset
    const backupPath = path.join(__dirname, '../db.backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(db, null, 2));
    console.log(`Backup created at ${backupPath}`);

    // Reset project-related arrays
    db.projects = [];
    db.tasks = [];
    db.time_logs = [];
    db.progress_logs = [];
    db.project_updates = [];

    // Persist changes
    if (writeDb(db)) {
        console.log('Project data reset successfully.');
        console.log('Divisions and Users preserved.');
    } else {
        console.error('Failed to save reset database.');
    }
};

resetProjects();
