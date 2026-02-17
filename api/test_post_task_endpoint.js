const http = require('http');

const data = JSON.stringify({
    title: 'Test Activity via API',
    objective: 'Testing full API flow',
    status: 'Todo',
    start_date: '2026-03-01',
    due_date: '2026-03-05',
    budget: 2500,
    cost: 0,
    project_id: 'test-project-123'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/tasks',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let responseBody = '';

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body: ${responseBody}`);
        if (res.statusCode === 201) {
            console.log("SUCCESS: Task created via API.");
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
