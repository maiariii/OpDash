
const azureDb = require('./azureDb');

async function testEndpoint() {
    try {
        console.log("Fetching projects to find a valid ID...");
        // internal DB call to get ID
        const projects = await azureDb.getProjects();
        if (projects.length === 0) {
            console.error("No projects found.");
            return;
        }
        const projectId = projects[0].id; // Use the first project
        console.log(`Testing with Project ID: ${projectId}`);

        const url = `http://localhost:3000/api/projects/${projectId}/catchups`;
        console.log(`GET ${url}`);

        const res = await fetch(url);
        console.log("Response Status:", res.status);

        if (res.ok) {
            const data = await res.json();
            console.log("Response Data Length:", data.length);
            if (data.length > 0) {
                console.log("First item:", data[0]);
            } else {
                console.log("No catchups found for this project yet.");
            }
            console.log("SUCCESS: Endpoint works!");
        } else {
            const text = await res.text();
            console.error("FAILURE: Endpoint returned unexpected response.", text);
        }

    } catch (err) {
        console.error("ERROR:", err.message);
    }
}

// Wait a bit for server to be ready if it was restarting
setTimeout(testEndpoint, 2000);
