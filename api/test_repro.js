
const azureDb = require('./azureDb');
const { v4: uuidv4 } = require('uuid');

async function test() {
    try {
        console.log("Initializing DB...");
        // azureDb.initDB() is called internally by upsertCatchup

        console.log("Getting an activity...");
        const activities = await azureDb.getActivities();
        if (activities.length === 0) {
            console.error("No activities found to attach catch-up to.");
            return;
        }
        const activity = activities[0];
        console.log(`Using activity: ${activity.id} - ${activity.title}`);

        const newCatchUp = {
            id: uuidv4(),
            activity_id: activity.id,
            title: "Test CatchUp " + Date.now(),
            description: "Test description",
            target_date: new Date().toISOString(),
            status: "Pending",
            reason: "Testing script"
        };

        console.log("Attempting to upsert catchup...", newCatchUp);
        const saved = await azureDb.upsertCatchup(newCatchUp);
        console.log("Saved catchup:", saved);

        // Verify it exists
        const catchups = await azureDb.getCatchups(activity.id);
        const found = catchups.find(c => c.id === newCatchUp.id);

        if (found) {
            console.log("SUCCESS: Catchup found in DB!");
            // Cleanup
            // await azureDb.query('DELETE FROM catchup_list WHERE id = $1', [newCatchUp.id]);
            // console.log("Cleanup done.");
        } else {
            console.error("FAILURE: Catchup not found in DB after save.");
        }

    } catch (err) {
        console.error("ERROR:", err);
    }
}

test();
