const http = require('http');

function makeRequest(method, path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(body));
                    } else {
                        reject(new Error(`Request failed with status ${res.statusCode}: ${body}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => reject(e));

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runVerification() {
    const projectId = 'HRODI-P010';

    try {
        console.log("1. Creating Milestone...");
        const createdMilestone = await makeRequest('POST', '/milestones', {
            project_id: projectId,
            title: "History Test Milestone",
            description: "Testing history log",
            target_date: "2026-03-01",
            status: "Pending",
            notes: "Initial note"
        });

        console.log("Milestone Created:", createdMilestone);

        if (!createdMilestone.id.startsWith('HRODI-M')) {
            console.error("FAILURE: ID format incorrect:", createdMilestone.id);
        } else {
            console.log("SUCCESS: ID format correct.");
        }

        console.log("Waiting 2 seconds...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log("2. Updating Milestone...");
        const updatedMilestone = await makeRequest('PUT', `/milestones/${createdMilestone.id}`, {
            status: "Accomplished",
            notes: "Updated note for history check"
        });

        console.log("Milestone Updated:", updatedMilestone);
        console.log("Verification Complete. Check Azure DB logs for history entries.");

    } catch (error) {
        console.error("Verification Failed:", error.message);
    }
}

runVerification();
