const fs = require('fs');
const path = require('path');
const {
    upsertDivision,
    upsertEmployee,
    upsertProject,
    upsertActivity,
    upsertSubtask,
    upsertMilestone,
    upsertCatchup,
    truncateAllTables,
    initDB
} = require('./azureDb');

const BACKUP_PATH = path.join(__dirname, '../db.json.bak');

const migrateBackup = async () => {
    console.log("=== Starting Data Migration from db.json.bak ===");
    
    if (!fs.existsSync(BACKUP_PATH)) {
        console.error("Error: db.json.bak file not found at:", BACKUP_PATH);
        return;
    }
    
    const backupContent = fs.readFileSync(BACKUP_PATH, 'utf8');
    const data = JSON.parse(backupContent);
    
    // 1. Initialize tables & truncate old project tables
    await initDB();
    await truncateAllTables();
    console.log("Cleared existing database tables.");
    
    // 2. Migrate Divisions
    const divisions = data.divisions || [];
    console.log(`Migrating ${divisions.length} divisions...`);
    for (const div of divisions) {
        await upsertDivision({
            id: div.id,
            name: div.name,
            created_at: div.created_at || new Date().toISOString()
        });
    }
    console.log("Divisions migrated successfully.");
    
    // 3. Migrate Employees
    const users = data.users || [];
    console.log(`Migrating ${users.length} staff members...`);
    for (const u of users) {
        await upsertEmployee({
            id: u.id,
            first_name: u.first_name,
            middle_name: u.middle_name || '',
            last_name: u.last_name,
            division_id: u.division_id,
            division: u.division || 'Unknown',
            position: u.position || 'Staff',
            hourly_rate: Number(u.hourly_rate) || 0,
            created_at: u.created_at || new Date().toISOString()
        });
    }
    console.log("Employees migrated successfully.");
    
    // 4. Migrate Projects
    const projects = data.projects || [];
    console.log(`Migrating ${projects.length} projects...`);
    for (const p of projects) {
        let basecamp_target = p.basecamp_target || '';
        if (!basecamp_target) {
            const name = p.name.toLowerCase();
            if (name.includes('stride')) {
                basecamp_target = 'HROD Process Excellence';
            } else if (name.includes('insighted')) {
                basecamp_target = 'HROD Process Excellence';
            } else if (name.includes('sha')) {
                basecamp_target = 'Mental Health Professionals for Schools';
            } else if (name.includes('twgws')) {
                basecamp_target = 'Workforce Plan and Management';
            } else if (name.includes('sgc')) {
                basecamp_target = 'Career Progression for DepEd Personnel';
            } else if (name.includes('valid')) {
                basecamp_target = 'Others';
            } else if (name.includes('seeded project 1')) {
                basecamp_target = 'Career Progression for DepEd Personnel';
            } else if (name.includes('seeded project 2')) {
                basecamp_target = 'Mental Health Professionals for Schools';
            } else if (name.includes('seeded project 3')) {
                basecamp_target = 'Workforce Plan and Management';
            } else if (name.includes('seeded project 4')) {
                basecamp_target = 'HROD Process Excellence';
            } else if (name.includes('seeded project 5')) {
                basecamp_target = 'Career Opportunities in DepEd for SHS Graduates';
            } else {
                basecamp_target = 'Others';
            }
        }

        await upsertProject({
            id: p.id,
            name: p.name,
            description: p.description || '',
            division: p.division || 'N/A',
            lead_personnel: p.lead_personnel || 'N/A',
            supervising_officer: p.supervising_officer || 'N/A',
            assisting_personnel: p.assisting_personnel || 'N/A',
            total_budget: Number(p.total_budget) || 0,
            gaa_allocation: Number(p.gaa_allocation) || 0,
            gms_allocation: Number(p.gms_allocation) || 0,
            gaa_ps: Number(p.gaa_ps) || 0,
            gaa_mooe: Number(p.gaa_mooe) || 0,
            program_id: p.program_id || null,
            basecamp_target: basecamp_target,
            status: p.status || 'Planning',
            created_at: p.created_at || new Date().toISOString()
        });
    }
    console.log("Projects migrated successfully.");
    
    // 5. Migrate Activities & Subtasks
    const tasks = data.tasks || [];
    console.log(`Migrating ${tasks.length} activities...`);
    for (const t of tasks) {
        const activity = await upsertActivity({
            id: t.id,
            project_id: t.project_id,
            title: t.title,
            objective: t.objective || '',
            status: t.status || 'Pending',
            milestone_id: t.milestone_id || null,
            activity_type: t.activity_type || 'Deskwork',
            nature_of_activity: t.nature_of_activity || '',
            estimated_hours: Number(t.estimated_hours) || 0,
            start_date: t.start_date || null,
            due_date: t.due_date || null,
            gms_allocation: Number(t.gms_allocation || t.budget) || 0,
            obligated_amount: Number(t.obligated_amount || t.cost) || 0,
            assignee_id: t.assignee_id || null,
            path: t.path || t.id,
            priority: t.priority || 'Medium',
            file_attachments: t.file_attachments || null,
            created_at: t.created_at || new Date().toISOString()
        });
        
        // Migrate subtasks of this activity
        const subtasks = t.subtasks || [];
        if (subtasks.length > 0) {
            console.log(`  -> Migrating ${subtasks.length} subtasks for activity: ${t.title}`);
            for (const sub of subtasks) {
                await upsertSubtask({
                    id: sub.id,
                    project_id: t.project_id,
                    activity_id: t.id,
                    title: sub.title,
                    description: sub.description || '',
                    status: sub.status || 'Pending',
                    assignee_id: sub.assignee_id || null,
                    due_date: sub.due_date || null,
                    created_at: sub.created_at || new Date().toISOString()
                });
            }
        }
    }
    console.log("Activities and subtasks migrated successfully.");
    
    // 6. Migrate Milestones
    const milestones = data.milestones || [];
    let milestonesToMigrate = [...milestones];
    if (milestonesToMigrate.length === 0) {
        console.log("No milestones found in backup file. Seeding default milestones for migrated projects...");
        milestonesToMigrate = [
            {
                id: 'HRODI-M0001',
                project_id: '76f95fb4-b535-4880-99e1-fde93ec2a06e',
                title: 'STRIDE Project Kickoff',
                description: 'Initial stakeholder alignment and project scoping.',
                target_date: '2026-02-15',
                notes: 'Successfully conducted kickoff meeting with positive stakeholder feedback.'
            },
            {
                id: 'HRODI-M0002',
                project_id: '76f95fb4-b535-4880-99e1-fde93ec2a06e',
                title: 'Baseline Resource Inventory Survey',
                description: 'Distribute and collect resource utilization data from pilot schools.',
                target_date: '2026-03-25',
                notes: 'Data collection is underway across regions.'
            },
            {
                id: 'HRODI-M0003',
                project_id: '1a987b80-308a-4938-8aa5-2978494912c0',
                title: 'InsightEd Pilot Launch (Region II)',
                description: 'Deploy resource dashboard pilot in Region II schools.',
                target_date: '2026-03-05',
                notes: 'Preparation and environment setup completed.'
            },
            {
                id: 'HRODI-M0004',
                project_id: '1a987b80-308a-4938-8aa5-2978494912c0',
                title: 'InsightEd Executive Demo',
                description: 'Presentation of dashboard insights to central leadership.',
                target_date: '2026-05-10',
                notes: 'Planning deck preparation.'
            },
            {
                id: 'HRODI-M0005',
                project_id: 'HRODI-P001',
                title: 'SHA Consultation Workshop',
                description: 'Host consultation workshop with health personnel and psychologists.',
                target_date: '2026-03-01',
                notes: 'Workshop venue and agenda finalized.'
            },
            {
                id: 'HRODI-M0006',
                project_id: 'HRODI-P002',
                title: 'TWG Workforce Plan Draft',
                description: 'Complete the initial draft of the work plan.',
                target_date: '2026-04-05',
                notes: 'Drafting core modules.'
            },
            {
                id: 'HRODI-M0007',
                project_id: 'HRODI-P004',
                title: 'SGC Committee Formation',
                description: 'Establish initial School Governance Councils.',
                target_date: '2026-03-20',
                notes: 'Selection process details published.'
            },
            {
                id: 'HRODI-M0008',
                project_id: 'HRODI-P005',
                title: 'Seeded Project 1 Milestone A',
                description: 'First milestone for Seeded Project 1.',
                target_date: '2026-03-15',
                notes: ''
            },
            {
                id: 'HRODI-M0009',
                project_id: 'HRODI-P006',
                title: 'Seeded Project 2 Milestone A',
                description: 'First milestone for Seeded Project 2.',
                target_date: '2026-03-18',
                notes: ''
            },
            {
                id: 'HRODI-M0010',
                project_id: 'HRODI-P007',
                title: 'Seeded Project 3 Milestone A',
                description: 'First milestone for Seeded Project 3.',
                target_date: '2026-03-22',
                notes: ''
            },
            {
                id: 'HRODI-M0011',
                project_id: 'HRODI-P008',
                title: 'Seeded Project 4 Milestone A',
                description: 'First milestone for Seeded Project 4.',
                target_date: '2026-03-25',
                notes: ''
            },
            {
                id: 'HRODI-M0012',
                project_id: 'HRODI-P009',
                title: 'Seeded Project 5 Milestone A',
                description: 'First milestone for Seeded Project 5.',
                target_date: '2026-03-28',
                notes: ''
            }
        ];
    }
    
    console.log(`Migrating ${milestonesToMigrate.length} milestones...`);
    for (const m of milestonesToMigrate) {
        await upsertMilestone({
            id: m.id,
            project_id: m.project_id,
            title: m.title,
            description: m.description || '',
            target_date: m.target_date || null,
            notes: m.notes || '',
            created_at: m.created_at || new Date().toISOString()
        });
    }
    console.log("Milestones migrated successfully.");
    
    // 7. Migrate Catchups
    const catchups = data.catchups || [];
    let catchupsToMigrate = [...catchups];
    if (catchupsToMigrate.length === 0) {
        console.log("No catchups found in backup file. Seeding default catchups for activities...");
        catchupsToMigrate = [
            {
                id: 'HRODI-C0001',
                activity_id: 'd29267e9_41a8_4c59_b4a1_721a3864a1e3', // STRIDE Data Analysis
                title: 'Data Collection Catch-up Plan',
                description: 'Accelerate responses from delayed schools by direct phone support.',
                target_date: '2026-03-15',
                status: 'Pending',
                reason: 'School response rate was lower than expected during baseline survey.'
            },
            {
                id: 'HRODI-C0002',
                activity_id: '95e2e33a_800f_4dad_8b3b_d374edfc57de', // InsightEd Pilot Test Region II
                title: 'Pilot Test Server Scaling',
                description: 'Upgrade dev server RAM to support concurrent connections from pilot schools.',
                target_date: '2026-03-12',
                status: 'Pending',
                reason: 'Observed server lag during initial regional user onboarding.'
            }
        ];
    }
    
    console.log(`Migrating ${catchupsToMigrate.length} catchups...`);
    for (const c of catchupsToMigrate) {
        await upsertCatchup({
            id: c.id,
            activity_id: c.activity_id,
            title: c.title,
            description: c.description || '',
            target_date: c.target_date || null,
            status: c.status || 'Pending',
            reason: c.reason || '',
            created_at: c.created_at || new Date().toISOString()
        });
    }
    console.log("Catchups migrated successfully.");
    
    console.log("=== Migration Completed Successfully! ===");
};

migrateBackup().catch(err => console.error("Migration failed with error:", err));
