
const azureDb = require('./azureDb');

async function testFullFlow() {
    try {
        console.log("1. Fetching projects...");
        const projects = await azureDb.getProjects();
        if (projects.length === 0) return console.error("No projects.");
        const projectId = projects[0].id;

        console.log("2. Fetching activities for project " + projectId);
        const activities = await azureDb.getActivities(projectId);
        if (activities.length === 0) return console.error("No activities.");
        const activityId = activities[0].id;

        const payload = {
            activity_id: activityId,
            title: "API Flow Test " + Date.now(),
            description: "Testing create and fetch",
            target_date: new Date().toISOString(),
            reason: "API Test"
        };

        console.log("3. Creating Catch-up via API...");
        const createRes = await fetch('http://localhost:3000/api/catchups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!createRes.ok) {
            console.error("Create failed:", await createRes.text());
            return;
        }
        const created = await createRes.json();
        console.log("Created ID:", created.id);

        console.log("4. Fetching Catch-ups for Project...");
        const listRes = await fetch(`http://localhost:3000/api/projects/${projectId}/catchups`);
        const list = await listRes.json();

        const found = list.find(c => c.id === created.id);
        if (found) {
            console.log("SUCCESS: Created catch-up found in project list!", found);
            // Cleanup skipped as azureDb.query is not exported
            // console.log("Cleanup done.");
        } else {
            console.error("FAILURE: Created catch-up NOT found in project list.");
            console.log("List received:", list);
        }

    } catch (err) {
        console.error("ERROR:", err);
    }
}

setTimeout(testFullFlow, 1000);
