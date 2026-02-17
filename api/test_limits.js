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

const longString = 'a'.repeat(101);
const validString = 'a'.repeat(100);

async function runTests() {
    console.log('--- Testing 100-char Limits ---');

    // 1. Project Description Limit
    try {
        console.log('\n[1] Testing Project Description Limit...');
        const res = await makeRequest('/api/projects', 'POST', {
            name: 'Test Project',
            description: longString
        });
        if (res.statusCode === 400 && res.body.error.includes('100 characters')) {
            console.log('✅ PASS: Project description limit enforced (400 Bad Request)');
        } else {
            console.log(`❌ FAIL: Expected 400, got ${res.statusCode}`, res.body);
        }
    } catch (e) { console.error(e); }

    // 2. Activity Objective Limit
    try {
        console.log('\n[2] Testing Activity Objective Limit...');
        const res = await makeRequest('/api/tasks', 'POST', { // /api/tasks is for activities
            project_id: 'TEST-P001',
            title: 'Test Activity',
            objective: longString
        });
        if (res.statusCode === 400 && res.body.error.includes('100 characters')) {
            console.log('✅ PASS: Activity objective limit enforced (400 Bad Request)');
        } else {
            console.log(`❌ FAIL: Expected 400, got ${res.statusCode}`, res.body);
        }
    } catch (e) { console.error(e); }

    // 3. Task (Subtask) Description Limit via POST /api/activities/:activityId/tasks
    try {
        console.log('\n[3] Testing Task Description Limit...');
        // Need a valid activity ID first, but for now we test the validation logic which runs before DB lookup usually?
        // Actually api code checks index first. So we might get 404 if activity doesn't exist.
        // Let's rely on the fact that if we get 404 it means it passed validation (or failed before).
        // BUT, looking at code: validation is AFTER finding activity.
        // So I need a valid activity. I'll create a valid one first.

        const validActivity = await makeRequest('/api/tasks', 'POST', {
            project_id: 'HRODI-P001', // Assuming exists or mocked
            title: 'Valid Activity',
            objective: 'Valid'
        });

        if (validActivity.statusCode === 201) {
            const actId = validActivity.body.id;
            const res = await makeRequest(`/api/activities/${actId}/tasks`, 'POST', {
                title: 'Test Task',
                description: longString
            });

            if (res.statusCode === 400 && res.body.error.includes('100 characters')) {
                console.log('✅ PASS: Task description limit enforced (400 Bad Request)');
            } else {
                console.log(`❌ FAIL: Expected 400, got ${res.statusCode}`, res.body);
            }
        } else {
            console.log('⚠️ SKIP: Could not create activity to test tasks. Ensure server is running and DB has projects.');
        }

    } catch (e) { console.error(e); }

    // 4. PUT Project Description Limit
    try {
        console.log('\n[4] Testing PUT Project Description Limit...');
        // Need a valid project.
        const validProject = await makeRequest('/api/projects', 'POST', {
            name: 'Valid Project',
            description: 'Valid'
        });

        if (validProject.statusCode === 201) {
            const pId = validProject.body.id;
            const res = await makeRequest(`/api/projects/${pId}`, 'PUT', {
                description: longString
            });
            if (res.statusCode === 400 && res.body.error.includes('100 characters')) {
                console.log('✅ PASS: PUT Project description limit enforced (400 Bad Request)');
            } else {
                console.log(`❌ FAIL: Expected 400, got ${res.statusCode}`, res.body);
            }
        }
    } catch (e) { console.error(e); }

}

runTests();
