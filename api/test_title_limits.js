const http = require('http');

const makeRequest = (path, method, body) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body: JSON.parse(data || '{}') });
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
};

const longTitle = 'a'.repeat(51);
const validTitle = 'a'.repeat(50);
const longDesc = 'a'.repeat(101);

async function runTests() {
    console.log('--- Testing 50-char Title Limits ---');

    // 1. Project Name Limit
    try {
        console.log('\n[1] Testing Project Name Limit...');
        const res = await makeRequest('/api/projects', 'POST', {
            name: longTitle,
            description: 'Valid description'
        });
        if (res.statusCode === 400 && res.body.error.includes('50 characters')) {
            console.log('✅ PASS: Project Name limit enforced (400 Bad Request)');
        } else {
            console.log(`❌ FAIL: Expected 400, got ${res.statusCode}`, res.body);
        }
    } catch (e) { console.error(e); }

    // 2. Activity Title Limit (POST /api/tasks)
    try {
        console.log('\n[2] Testing Activity Title Limit...');
        const res = await makeRequest('/api/tasks', 'POST', {
            project_id: 'HRODI-P001',
            title: longTitle,
            objective: 'Valid objective'
        });
        if (res.statusCode === 400 && res.body.error.includes('50 characters')) {
            console.log('✅ PASS: Activity Title limit enforced (400 Bad Request)');
        } else {
            console.log(`❌ FAIL: Expected 400, got ${res.statusCode}`, res.body);
        }
    } catch (e) { console.error(e); }

    // 3. Task (Subtask) Title Limit via POST /api/activities/:activityId/tasks
    try {
        console.log('\n[3] Testing Task Title Limit...');

        // Create valid activity first
        const validActivity = await makeRequest('/api/tasks', 'POST', {
            project_id: 'HRODI-P001',
            title: 'Valid Activity',
            objective: 'Valid'
        });

        if (validActivity.statusCode === 201) {
            const actId = validActivity.body.id;
            const res = await makeRequest(`/api/activities/${actId}/tasks`, 'POST', {
                title: longTitle,
                description: 'Valid description'
            });

            if (res.statusCode === 400 && res.body.error.includes('50 characters')) {
                console.log('✅ PASS: Task Title limit enforced (400 Bad Request)');
            } else {
                console.log(`❌ FAIL: Expected 400, got ${res.statusCode}`, res.body);
            }
        } else {
            console.log('⚠️ SKIP: Could not create activity to test tasks. Ensure server is running.');
        }

    } catch (e) { console.error(e); }

    // 4. PUT Activity Title Limit
    try {
        console.log('\n[4] Testing PUT Activity Title Limit...');
        // Reuse validActivity from step 3 if possible, or create new
        const validActivity = await makeRequest('/api/tasks', 'POST', {
            project_id: 'HRODI-P001',
            title: 'Valid Activity For PUT',
            objective: 'Valid'
        });

        if (validActivity.statusCode === 201) {
            const actId = validActivity.body.id;
            const res = await makeRequest(`/api/tasks/${actId}`, 'PUT', {
                title: longTitle
            });
            if (res.statusCode === 400 && res.body.error.includes('50 characters')) {
                console.log('✅ PASS: PUT Activity Title limit enforced (400 Bad Request)');
            } else {
                console.log(`❌ FAIL: Expected 400, got ${res.statusCode}`, res.body);
            }
        }
    } catch (e) { console.error(e); }

    // 5. PUT Activity with Invalid Subtask Title
    try {
        console.log('\n[5] Testing PUT Activity with Invalid Subtask Title...');
        const validActivity = await makeRequest('/api/tasks', 'POST', {
            project_id: 'HRODI-P001',
            title: 'Valid Activity For Subtask PUT',
            objective: 'Valid'
        });

        if (validActivity.statusCode === 201) {
            const actId = validActivity.body.id;
            const res = await makeRequest(`/api/tasks/${actId}`, 'PUT', {
                subtasks: [{ id: 'new', title: longTitle }]
            });
            if (res.statusCode === 400 && res.body.error.includes('50 characters')) {
                console.log('✅ PASS: PUT Activity Subtask Title limit enforced (400 Bad Request)');
            } else {
                console.log(`❌ FAIL: Expected 400, got ${res.statusCode}`, res.body);
            }
        }
    } catch (e) { console.error(e); }

}

runTests();
