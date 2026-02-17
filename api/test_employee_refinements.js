const http = require('http');

const makeRequest = (path, method, body) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' },
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

async function runTests() {
    console.log('--- Testing Employee Refinements ---');

    // 1. Get/Create Division
    let divisionId = 'default-div';
    try {
        const divRes = await makeRequest('/api/divisions', 'GET');
        if (divRes.statusCode === 200 && divRes.body.length > 0) {
            divisionId = divRes.body[0].id;
        } else {
            const newDiv = await makeRequest('/api/divisions', 'POST', { name: 'Test Division Refinement' });
            if (newDiv.statusCode === 201) divisionId = newDiv.body.id;
        }
    } catch (e) {
        console.log('Error getting divisions, using dummy ID');
    }

    // 2. Create Employee
    try {
        console.log('\n[1] Creating new employee...');
        const newEmployee = {
            first_name: 'Control',
            last_name: 'NumberCheck',
            division_id: divisionId,
            position: 'Analyst'
        };

        const res = await makeRequest('/api/employees', 'POST', newEmployee);

        if (res.statusCode === 201) {
            console.log('✅ PASS: Employee created (201 Created)');
            console.log(`   ID: ${res.body.id}`);

            // Verify Control Number Format
            if (res.body.id.match(/^HRODI-E\d{4}$/)) {
                console.log('✅ PASS: ID format is correct (HRODI-Exxxx)');
            } else {
                console.log(`❌ FAIL: ID format incorrect: ${res.body.id}`);
            }

            // Verify Division Name (in response and implied in DB)
            if (res.body.division && res.body.division !== 'Unknown') {
                console.log(`✅ PASS: Division name present: ${res.body.division}`);
            } else {
                console.log(`⚠️ WARN: Division name might be missing or 'Unknown': ${res.body.division}`);
            }

            // Verify hourly_rate absence (in response logic, though response might still send it if passed, but typically we construct it)
            // Actually index.js constructs the object without it.
            if (res.body.hourly_rate === undefined) {
                console.log('✅ PASS: hourly_rate is NOT in response');
            } else {
                console.log(`⚠️ INFO: hourly_rate present in response: ${res.body.hourly_rate}`);
            }

        } else {
            console.log(`❌ FAIL: Expected 201, got ${res.statusCode}`, res.body);
        }
    } catch (e) { console.error(e); }
}

runTests();
