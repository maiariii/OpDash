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

async function runTests() {
    console.log('--- Testing Employee Sync ---');

    // 1. Create a dummy division first (or assume one exists, but better to be safe)
    // For simplicity, we'll try to get divisions, if empty create one.
    let divisionId = 'default-div';
    try {
        const divRes = await makeRequest('/api/divisions', 'GET');
        if (divRes.statusCode === 200 && divRes.body.length > 0) {
            divisionId = divRes.body[0].id;
        } else {
            const newDiv = await makeRequest('/api/divisions', 'POST', { name: 'Test Div' });
            if (newDiv.statusCode === 201) divisionId = newDiv.body.id;
        }
    } catch (e) {
        console.log('Error getting divisions, proceeding with dummy ID');
    }

    // 2. Create Employee
    try {
        console.log('\n[1] Creating new employee...');
        const timestamp = Date.now();
        const newEmployee = {
            first_name: `TestUser_${timestamp}`,
            last_name: 'SyncCheck',
            division_id: divisionId,
            position: 'Tester'
        };

        const res = await makeRequest('/api/employees', 'POST', newEmployee);

        if (res.statusCode === 201) {
            console.log('✅ PASS: Employee created successfully (201 Created)');
            console.log(`   ID: ${res.body.id}`);
            console.log(`   Check server logs for "Employee... synced to OpDash DB" message.`);
            console.log(`   Check Azure DB 'employee_list' table for id: ${res.body.id}`);
        } else {
            console.log(`❌ FAIL: Expected 201, got ${res.statusCode}`, res.body);
        }
    } catch (e) { console.error(e); }
}

runTests();
