const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;
const opDashUrl = databaseUrl ? databaseUrl.replace(/\/[^/]+$/, '/OpDash') : null;

const pool = new Pool({
    connectionString: opDashUrl,
    ssl: { rejectUnauthorized: false }
});

const employeeIdToCheck = process.argv[2];

async function checkEmployee() {
    const client = await pool.connect();
    try {
        if (!employeeIdToCheck) {
            console.log("Listing last 5 employees in 'employee_list'...");
            const res = await client.query('SELECT * FROM employee_list ORDER BY created_at DESC LIMIT 5');
            console.table(res.rows);
        } else {
            console.log(`Checking for employee ID: ${employeeIdToCheck}`);
            const res = await client.query('SELECT * FROM employee_list WHERE id = $1', [employeeIdToCheck]);
            if (res.rows.length > 0) {
                console.log("✅ Employee found in Azure DB!");
                console.table(res.rows);
            } else {
                console.log("❌ Employee NOT found in Azure DB.");
            }
        }
    } catch (err) {
        console.error("Error checking employee:", err);
    } finally {
        client.release();
        pool.end();
    }
}

checkEmployee();
