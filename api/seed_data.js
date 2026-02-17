const http = require('http');

const makeRequest = (path, method, body) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000 // Extended timeout for bulk operations
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data || '{}') }));
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

const EMPLOYEES_COUNT = 5;
const PROJECTS_COUNT = 5;
const ACTIVITIES_PER_PROJECT = 5; // Total 25
const TASKS_PER_ACTIVITY = 5; // Total 125

async function seed() {
    console.log('--- Seeding Database ---');

    console.log('Getting default division...');
    let divisionId = 'd1';
    try {
        const divRes = await makeRequest('/api/divisions', 'GET');
        if (divRes.statusCode === 200 && divRes.body.length > 0) {
            divisionId = divRes.body[0].id;
        } else {
            console.log('Creating default division...');
            const newDiv = await makeRequest('/api/divisions', 'POST', { name: 'Operations Division' });
            if (newDiv.statusCode === 201) divisionId = newDiv.body.id;
        }
    } catch (e) {
        console.error('Error getting division:', e.message);
    }

    // 1. Create Employees
    const employeeIds = [];
    console.log(`\nCreating ${EMPLOYEES_COUNT} Employees...`);
    for (let i = 1; i <= EMPLOYEES_COUNT; i++) {
        try {
            const res = await makeRequest('/api/employees', 'POST', {
                first_name: `Employee`,
                last_name: `User${i}`,
                division_id: divisionId,
                position: 'Project Staff'
            });
            if (res.statusCode === 201) {
                console.log(`Created: ${res.body.first_name} ${res.body.last_name} (${res.body.id})`);
                employeeIds.push(res.body.id);
            } else {
                console.error(`Failed to create employee ${i}:`, res.body);
            }
        } catch (e) { console.error(e); }
        await new Promise(r => setTimeout(r, 100)); // Slight delay
    }

    // 2. Create Projects
    console.log(`\nCreating ${PROJECTS_COUNT} Projects...`);
    for (let i = 1; i <= PROJECTS_COUNT; i++) {
        try {
            const projRes = await makeRequest('/api/projects', 'POST', {
                name: `Seeded Project ${i}`,
                description: `Description for seeded project ${i}`,
                division: 'Operations',
                lead_personnel: 'Lead User',
                status: 'Ongoing'
            });

            if (projRes.statusCode === 201) {
                const projectId = projRes.body.id;
                console.log(`Created Project: ${projectId}`);

                // 3. Create Activities for this Project
                for (let j = 1; j <= ACTIVITIES_PER_PROJECT; j++) {
                    const actRes = await makeRequest('/api/tasks', 'POST', {
                        project_id: projectId,
                        title: `Activity ${i}-${j}`,
                        objective: `Objective for activity ${i}-${j}`,
                        status: 'Todo',
                        start_date: new Date().toISOString().split('T')[0],
                        due_date: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
                        budget: 10000,
                        assignee_id: employeeIds[j % employeeIds.length] // Rotate assignees
                    });

                    if (actRes.statusCode === 201) {
                        const activityId = actRes.body.id;
                        // console.log(`  - Created Activity: ${activityId}`);

                        // 4. Create Tasks for this Activity
                        // NOTE: Using the endpoint /api/activities/:activityId/tasks we implemented earlier
                        for (let k = 1; k <= TASKS_PER_ACTIVITY; k++) {
                            const taskRes = await makeRequest(`/api/activities/${activityId}/tasks`, 'POST', {
                                title: `Task ${i}-${j}-${k}`,
                                description: `Subtask description ${k}`,
                                assignee_id: employeeIds[k % employeeIds.length],
                                due_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
                                status: 'Todo'
                            });

                            if (taskRes.statusCode !== 201) {
                                console.error(`    Failed to create task ${k}:`, taskRes.body);
                            }
                        }
                    } else {
                        console.error(`  Failed to create activity ${j}:`, actRes.body);
                    }
                }
            } else {
                console.error(`Failed to create project ${i}:`, projRes.body);
            }
        } catch (e) { console.error(e); }
    }
    console.log('\n--- Seeding Completed ---');
}

seed();
