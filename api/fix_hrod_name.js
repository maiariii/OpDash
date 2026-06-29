const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;
let opDashUrl = databaseUrl;
if (opDashUrl) {
    opDashUrl = opDashUrl
        .replace('20.24.58.49', 'stride-posgre-prod-01.postgres.database.azure.com')
        .replace(':6432', ':5432');
}

const pool = new Pool({
    connectionString: opDashUrl,
    ssl: { rejectUnauthorized: false }
});

async function fixNames() {
    console.log("Fixing division name for projects...");
    const res = await pool.query(
        "UPDATE projects_list SET division = 'Human Resource and Organizational Development Division' WHERE division = 'Human Resource and Development Division'"
    );
    console.log(`Updated ${res.rowCount} projects.`);

    console.log("Fixing division name for employees...");
    const resEmp = await pool.query(
        "UPDATE employee_list SET division = 'Human Resource and Organizational Development Division' WHERE division = 'Human Resource and Development Division'"
    );
    console.log(`Updated ${resEmp.rowCount} employees.`);
    
    await pool.end();
}

fixNames().catch(e => {
    console.error(e);
    pool.end();
});
