const http = require('http');

// Valid Activity ID from db.json
const activityId = 'd29267e9_41a8_4c59_b4a1_721a3864a1e3';

const data = JSON.stringify({
    title: 'Test Subtask via API',
    description: 'Testing subtask creation',
    status: 'Todo',
    due_date: '2026-03-05',
    assignee_id: '29138d67-fc98-4391-8280-455dba7df131' // Sebastian from db.json
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/activities/${activityId}/tasks`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log(`Testing POST ${options.path}...`);

const req = http.request(options, (res) => {
    let responseBody = '';

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body: ${responseBody}`);
        if (res.statusCode === 201) {
            console.log("SUCCESS: Subtask created via API.");
        } else {
            console.error("FAILURE: API returned error.");
        }
    });
});

req.on('error', (error) => {
    console.error(`ERROR: ${error.message}`);
});

req.write(data);
req.end();
