const BASE_URL = 'http://localhost:3000/api';

async function post(url, data) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

async function test() {
    try {
        console.log("1. Creating Project 1...");
        const p1 = await post(`${BASE_URL}/projects`, { name: "Test Project 1" });
        console.log("Project 1 ID:", p1.id);

        console.log("2. Creating Project 2...");
        const p2 = await post(`${BASE_URL}/projects`, { name: "Test Project 2" });
        console.log("Project 2 ID:", p2.id);

        console.log("3. Creating Activity for Project 1...");
        const a1 = await post(`${BASE_URL}/tasks`, {
            project_id: p1.id,
            title: "Test Activity 1"
        });
        console.log("Activity 1 ID:", a1.id);

        console.log("4. Creating Activity for Project 2...");
        const a2 = await post(`${BASE_URL}/tasks`, {
            project_id: p2.id,
            title: "Test Activity 2"
        });
        console.log("Activity 2 ID:", a2.id);

        if (p1.id === 'HRODI-P001' && p2.id === 'HRODI-P002') {
            console.log("PASS: Project IDs are correct.");
        } else {
            console.error("FAIL: Project IDs are incorrect.");
        }

        if (a1.id.startsWith('HRODI-A') && a2.id.startsWith('HRODI-A')) {
            console.log("PASS: Activity IDs are correct.");
        } else {
            console.error("FAIL: Activity IDs are incorrect.");
        }

    } catch (error) {
        console.error("Test Failed:", error.message);
    }
}

test();
