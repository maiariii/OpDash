const express = require('express');
const cors = require('cors');
const path = require('path'); // Added for static serving
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
// const { readDb, writeDb } = require('./db'); // Removed
const azureDb = require('./azureDb'); // Import all
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    path: '/opdash/socket.io',
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT"]
    }
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve Static Files from React App
// Automatically redirect /opdash to /opdash/ if trailing slash is missing
app.get('/opdash', (req, res, next) => {
    if (req.path === '/opdash') {
        return res.redirect(301, '/opdash/');
    }
    next();
});

app.use('/opdash', express.static(path.join(__dirname, '../')));
app.use('/opdash/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Initialize DB schema on startup
azureDb.initDB().catch(err => console.error("DB Init failed:", err));

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('join_project', (projectId) => {
        socket.join(projectId);
        console.log(`User joined project: ${projectId}`);
    });
});

// Helper to simulate a delay (for realism)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ---------------------------
// ENDPOINTS
const apiRouter = express.Router();

const getUserFromReq = (req) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return 'System';
        }
        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET || 'opdash-secret-key-2026';
        const decoded = jwt.verify(token, secret);
        return decoded.email || 'Unknown User';
    } catch (err) {
        return 'System';
    }
};

// GET Activity Logs
apiRouter.get('/activity-logs', async (req, res) => {
    try {
        const { projectId } = req.query;
        const logs = await azureDb.getActivityLogs(projectId || null);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// File Upload Endpoint
apiRouter.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        res.json({
            name: req.file.originalname,
            url: `/opdash/uploads/${req.file.filename}`,
            filename: req.file.filename
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ---------------------------

// GET All Projects
apiRouter.get('/projects', async (req, res) => {
    try {
        const projects = await azureDb.getProjects();
        // Fallback budget logic: if total_budget is 0, sum up task budgets
        const allActivities = await azureDb.getActivities();

        const projectsWithBudget = projects.map(p => {
            const projectTasks = allActivities.filter(t => t.project_id === p.id);
            let calculatedBudget = 0;
            if (projectTasks.length > 0) {
                calculatedBudget = projectTasks.reduce((sum, t) => sum + (Number(t.allocation || t.budget) || 0), 0);
            }

            // Prioritize overall project budget (sof_allocation) and fall back to sum of tasks
            const projectSofAllocation = Number(p.sof_allocation || p.total_budget || 0);
            const finalBudget = projectSofAllocation > 0 ? projectSofAllocation : calculatedBudget;

            return {
                ...p,
                total_budget: finalBudget
            };
        });
        res.json(projectsWithBudget);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST Create Project
apiRouter.post('/projects', async (req, res) => {
    try {
        const { name, description, division, lead_personnel, supervising_officer, assisting_personnel, source_of_fund, sof_allocation, basecamp_target, expenditure_framework } = req.body;

        if (!name) return res.status(400).json({ error: 'Project Name is required' });
        if (name.length > 50) return res.status(400).json({ error: 'Project Name cannot exceed 50 characters' });
        if (description && description.length > 100) return res.status(400).json({ error: 'Project description cannot exceed 100 characters' });

        const id = await azureDb.generateControlCode('project');

        const newProject = {
            id,
            name,
            description: description || '',
            division: division || 'N/A',
            lead_personnel: lead_personnel || 'N/A',
            supervising_officer: supervising_officer || 'N/A',
            assisting_personnel: assisting_personnel || 'N/A',
            total_budget: Number(sof_allocation) || 0, // Fallback/Derived for frontend compatibility
            source_of_fund: source_of_fund || null,
            sof_allocation: Number(sof_allocation) || 0,
            basecamp_target: basecamp_target || '',
            expenditure_framework: expenditure_framework || null,
            status: 'Planning',
            created_at: new Date().toISOString()
        };

        const saved = await azureDb.upsertProject(newProject);
        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'created', 'Project', `Project: ${name}`, id);
        res.status(201).json(saved);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Update Project
apiRouter.put('/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const current = await azureDb.getProjectById(id);
        if (!current) return res.status(404).json({ error: 'Project not found' });

        const { name, description, division, lead_personnel, supervising_officer, assisting_personnel, status, source_of_fund, sof_allocation, basecamp_target, expenditure_framework } = req.body;

        if (name && name.length > 50) return res.status(400).json({ error: 'Project Name cannot exceed 50 characters' });
        if (description && description.length > 100) return res.status(400).json({ error: 'Project description cannot exceed 100 characters' });

        const updatedProject = {
            ...current,
            name: name || current.name,
            description: description !== undefined ? description : current.description,
            division: division || current.division,
            lead_personnel: lead_personnel || current.lead_personnel,
            supervising_officer: supervising_officer || current.supervising_officer,
            assisting_personnel: assisting_personnel || current.assisting_personnel,
            total_budget: sof_allocation !== undefined ? Number(sof_allocation) : (current.sof_allocation || 0), // Fallback/Derived for frontend compatibility
            source_of_fund: source_of_fund !== undefined ? source_of_fund : current.source_of_fund,
            sof_allocation: sof_allocation !== undefined ? Number(sof_allocation) : current.sof_allocation,
            basecamp_target: basecamp_target !== undefined ? basecamp_target : current.basecamp_target,
            expenditure_framework: expenditure_framework !== undefined ? expenditure_framework : current.expenditure_framework,
            status: status || current.status
        };

        const saved = await azureDb.upsertProject(updatedProject);
        const username = getUserFromReq(req);
        
        const changes = [];
        if (current.name !== updatedProject.name) changes.push(`changed name to "${updatedProject.name}"`);
        if ((current.description || '') !== (updatedProject.description || '')) {
            if (!current.description && updatedProject.description) changes.push(`added description`);
            else if (current.description && !updatedProject.description) changes.push(`removed description`);
            else changes.push(`updated description`);
        }
        if (current.division !== updatedProject.division) changes.push(`changed division to "${updatedProject.division}"`);
        if (current.lead_personnel !== updatedProject.lead_personnel) changes.push(`changed lead personnel to "${updatedProject.lead_personnel}"`);
        if (current.supervising_officer !== updatedProject.supervising_officer) changes.push(`changed supervising officer to "${updatedProject.supervising_officer}"`);
        if (current.assisting_personnel !== updatedProject.assisting_personnel) changes.push(`changed assisting personnel to "${updatedProject.assisting_personnel}"`);
        if (current.status !== updatedProject.status) changes.push(`changed status to "${updatedProject.status}"`);
        if (current.source_of_fund !== updatedProject.source_of_fund) changes.push(`changed fund source to "${updatedProject.source_of_fund}"`);
        if (Number(current.sof_allocation || 0) !== Number(updatedProject.sof_allocation || 0)) {
            changes.push(`updated budget allocation to ₱${Number(updatedProject.sof_allocation).toLocaleString()}`);
        }
        
        const details = `Project: ${saved.name}` + (changes.length > 0 ? ` - ${changes[changes.length - 1]}` : '');
        await azureDb.logActivity(username, 'updated', 'Project', details, id);
        res.json(saved);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET All Divisions
apiRouter.get('/divisions', async (req, res) => {
    try {
        const divs = await azureDb.getDivisions();
        res.json(divs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Create Division
apiRouter.post('/divisions', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });
        const newDiv = { id: uuidv4(), name, created_at: new Date().toISOString() };
        const saved = await azureDb.upsertDivision(newDiv);
        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'created', 'Division', `Division: ${name}`);
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT Update Division
apiRouter.put('/divisions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        // Verify existence? upsertDivision handles insert if id provided, but we want update semantics
        const saved = await azureDb.upsertDivision({ id, name });
        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'updated', 'Division', `Division: ${name}`);
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET All Employees
apiRouter.get('/employees', async (req, res) => {
    try {
        const users = await azureDb.getEmployees();
        const mapped = users.map(u => ({
            ...u,
            name: `${u.first_name || ''} ${u.middle_name || ''} ${u.last_name || ''}`.trim().replace(/\s+/g, ' ')
        }));
        res.json(mapped);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Create Employee
apiRouter.post('/employees', async (req, res) => {
    try {
        const { first_name, middle_name, last_name, division_id, position } = req.body;
        if (!first_name || !last_name || !division_id) return res.status(400).json({ error: 'Name and Division required' });

        // Get Division Name
        const allDivs = await azureDb.getDivisions();
        const div = allDivs.find(d => d.id === division_id);
        const divName = div ? div.name : 'Unknown';

        const id = await azureDb.generateControlCode('employee');
        const newUser = {
            id,
            first_name,
            middle_name: middle_name || '',
            last_name,
            division_id,
            division: divName,
            position: position || 'Staff',
            created_at: new Date().toISOString()
        };

        const saved = await azureDb.upsertEmployee(newUser);
        const username = getUserFromReq(req);
        const fullName = `${saved.first_name} ${saved.middle_name || ''} ${saved.last_name}`.trim().replace(/\s+/g, ' ');
        await azureDb.logActivity(username, 'created', 'Employee', `Employee: ${fullName}`);
        res.status(201).json({
            ...saved,
            name: fullName
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT Update Employee
apiRouter.put('/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const current = await azureDb.getEmployeeById(id);
        if (!current) return res.status(404).json({ error: 'Employee not found' });

        const { first_name, middle_name, last_name, division_id, position } = req.body;

        // Resolve new division Name if changed
        let divisionName = current.division;
        let finalDivId = division_id || current.division_id;
        if (division_id && division_id !== current.division_id) {
            const allDivs = await azureDb.getDivisions();
            const d = allDivs.find(x => x.id === division_id);
            divisionName = d ? d.name : 'Unknown';
        }

        const updatedUser = {
            ...current,
            first_name: first_name || current.first_name,
            middle_name: middle_name !== undefined ? middle_name : current.middle_name,
            last_name: last_name || current.last_name,
            division_id: finalDivId,
            division: divisionName,
            position: position || current.position
        };

        const saved = await azureDb.upsertEmployee(updatedUser);
        const username = getUserFromReq(req);
        const fullName = `${saved.first_name} ${saved.middle_name || ''} ${saved.last_name}`.trim().replace(/\s+/g, ' ');
        await azureDb.logActivity(username, 'updated', 'Employee', `Employee: ${fullName}`);
        res.json({
            ...saved,
            name: fullName
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Employee
apiRouter.delete('/employees/:id', async (req, res) => {
    try {
        const empRes = await azureDb.query('SELECT * FROM employee_list WHERE id = $1', [req.params.id]);
        const emp = empRes.rows[0];
        const fullName = emp ? `${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`.trim().replace(/\s+/g, ' ') : req.params.id;
        
        await azureDb.deleteEmployee(req.params.id);
        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'deleted', 'Employee', `Employee: ${fullName}`);
        res.json({ message: 'Employee deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Project
apiRouter.delete('/projects/:id', async (req, res) => {
    try {
        const proj = await azureDb.getProjectById(req.params.id);
        const projName = proj ? proj.name : req.params.id;
        
        await azureDb.deleteProject(req.params.id);
        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'deleted', 'Project', `Project: ${projName}`, req.params.id);
        res.json({ message: 'Project deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Project Financials (Complex Logic)
apiRouter.get('/projects/:id/financials', async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await azureDb.getProjectById(projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // 1. Get Activities
        const activities = await azureDb.getActivities(projectId);
        console.log(`[Financials] Project ${projectId} has ${activities.length} activities.`);

        // 2. Get Expenses (Direct Costs from expense_list) linked to activities
        const expenses = await azureDb.getExpensesByProject(projectId);
        console.log(`[Financials] Project ${projectId} has ${expenses.length} expenses.`);

        // 3. Calculate Actual Cost (Obligated Funds)
        let obligatedFunds = 0;
        let totalHours = 0; // Simulated/Missing

        // Add up activity.obligated_amount (formerly cost) + expenses (if any)
        activities.forEach(a => {
            obligatedFunds += Number(a.obligated_amount || a.cost) || 0;
        });

        // If expense_list is used separately, keep this. If expenses are now embedded in activities (via obligated_amount), this might be double counting if both exist. 
        // Assuming expense_list tracks OTHER costs not in activities, or is legacy. 
        // For now, let's keep it but label it as potentially extra.
        // User request: "Amount Spent to Obligated Funds".
        // "Total of GMS Allocation and total obligated amount".
        // If I exclude expenses, I might miss data. If I include, I might double count if they migrate data.
        // Given CreateTaskModal saves to obligated_amount, and doesn't write to expense_list, I should rely on obligated_amount for tasks.
        expenses.forEach(e => {
            obligatedFunds += Number(e.amount) || 0;
        });

        console.log(`[Financials] Calculated Obligated Funds: ${obligatedFunds}`);

        // Dynamic Total Allocation (formerly Budget/GMS Allocation)
        let totalAllocation = activities.reduce((sum, a) => sum + (Number(a.allocation || a.gms_allocation || a.budget) || 0), 0);

        // Prioritize overall project budget (sof_allocation) and fall back to sum of activities
        const projectSofAllocation = Number(project.sof_allocation || project.total_budget || 0);
        const finalAllocation = projectSofAllocation > 0 ? projectSofAllocation : totalAllocation;

        const burnRate = finalAllocation > 0 ? (obligatedFunds / finalAllocation) * 100 : 0;

        // CPI
        const completedTasks = activities.filter(t => t.status === 'Accomplished').length;
        const totalTasks = activities.length || 1;
        const percentComplete = completedTasks / totalTasks;

        const cpi = obligatedFunds > 0 ? ((percentComplete * finalAllocation) / obligatedFunds) : 1;
        const remainingFunds = finalAllocation - obligatedFunds;

        res.json({
            id: project.id,
            name: project.name,
            total_budget: finalAllocation, // Keep key for backward comp, or strict rename? Let's use new keys too.
            total_allocation: finalAllocation,
            total_gms_allocation: finalAllocation, // legacy
            obligated_funds: obligatedFunds,
            remaining_budget: remainingFunds, // Legacy key
            remaining_funds: remainingFunds,
            actual_cost: obligatedFunds, // Legacy key
            total_hours: totalHours,
            burn_rate_percent: burnRate,
            cpi: cpi
        });

    } catch (err) {
        console.error(`[Financials] ERROR: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// GET All Activities and Subtasks in Bulk
apiRouter.get('/projects/activities/bulk', async (req, res) => {
    try {
        const [activities, subtasks, expenses] = await Promise.all([
            azureDb.getActivities(),
            azureDb.getSubtasks(),
            azureDb.getAllExpenses()
        ]);
        res.json({ activities, subtasks, expenses });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Hierarchical Tasks
apiRouter.get('/projects/:id/tasks', async (req, res) => {
    try {
        const projectId = req.params.id;
        const activities = await azureDb.getActivities(projectId);
        const users = await azureDb.getEmployees();
        const divisions = await azureDb.getDivisions();

        // Map division name
        const mapped = activities.map(t => {
            let divisionName = 'Unassigned';
            if (t.assignee_id) {
                const user = users.find(u => u.id === t.assignee_id);
                if (user && user.division_id) {
                    const div = divisions.find(d => d.id === user.division_id);
                    if (div) divisionName = div.name;
                }
            }
            return {
                ...t,
                division_name: divisionName,
                subtasks: [] // Will populate
            };
        });

        // Now fetch Subtasks and Expenses for these activities
        const allSubtasks = await azureDb.getSubtasks();
        const allExpenses = await azureDb.getExpensesByProject(projectId);

        mapped.forEach(activity => {
            const subs = allSubtasks.filter(s => s.activity_id === activity.id);
            activity.subtasks = subs;
            
            const exps = allExpenses.filter(e => e.activity_id === activity.id);
            activity.expenses = exps;
        });

        // Sort
        mapped.sort((a, b) => {
            const pA = a.path || a.id;
            const pB = b.path || b.id;
            return pA.localeCompare(pB);
        });

        res.json(mapped);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Create Task (Activity)
apiRouter.post('/tasks', async (req, res) => {
    try {
        const { project_id, title, objective, parent_path, status, assignee_id, milestone_id, activity_type, nature_of_activity, estimated_hours, start_date, due_date, obligated_amount, allocation, gms_allocation, expenses, key_result_area, output } = req.body;

        if (title && title.length > 50) return res.status(400).json({ error: 'Activity title cannot exceed 50 characters' });
        if (objective && objective.length > 100) return res.status(400).json({ error: 'Activity objective cannot exceed 100 characters' });

        // Budget Validation
        const project = await azureDb.getProjectById(project_id);
        if (project) {
            const projectBudget = Number(project.sof_allocation || project.total_budget || 0);
            if (projectBudget > 0) {
                const existingActivities = await azureDb.getActivities(project_id);
                const existingObligatedSum = existingActivities.reduce((sum, a) => sum + (Number(a.obligated_amount || a.cost) || 0), 0);
                
                let requestedObligatedAmount = Number(obligated_amount) || 0;
                if (expenses && Array.isArray(expenses)) {
                    requestedObligatedAmount = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
                }
                
                if (existingObligatedSum + requestedObligatedAmount > projectBudget) {
                    return res.status(400).json({ error: `Action Blocked: Total obligated amount would exceed the project's allocated budget (₱${projectBudget.toLocaleString()}).` });
                }
            }
        }

        const newId = await azureDb.generateControlCode('activity');
        const path = parent_path ? `${parent_path}.${newId}` : newId;

        // Calculate sum from expenses if provided
        let calculatedObligatedAmount = obligated_amount;
        if (expenses && Array.isArray(expenses)) {
            calculatedObligatedAmount = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
        }

        const newTask = {
            id: newId,
            project_id,
            path,
            title,
            objective: objective || '',
            status: status || 'Pending',
            priority: 'Medium',
            assignee_id,
            milestone_id, // Add milestone_id
            activity_type, // Add activity_type
            nature_of_activity: nature_of_activity || '',
            estimated_hours: Number(estimated_hours) || 0,
            start_date,
            due_date,
            obligated_amount: Number(calculatedObligatedAmount) || 0,
            allocation: Number(allocation !== undefined ? allocation : gms_allocation) || 0,
            key_result_area: key_result_area || '',
            output: output || '',
            created_at: new Date().toISOString()
        };

        const saved = await azureDb.upsertActivity(newTask);

        // Handle subtasks if any in payload? (Usually separate call, but original code had it)
        if (req.body.subtasks && Array.isArray(req.body.subtasks)) {
            for (const sub of req.body.subtasks) {
                const subTaskObj = {
                    id: await azureDb.generateControlCode('task'),
                    project_id,
                    activity_id: saved.id,
                    title: sub.title,
                    description: sub.description || '',
                    status: 'Pending'
                };
                await azureDb.upsertSubtask(subTaskObj);
            }
        }

        // Expenses
        if (req.body.expenses && Array.isArray(req.body.expenses)) {
            for (const exp of req.body.expenses) {
                await azureDb.addExpense({
                    id: uuidv4(),
                    task_id: saved.id,
                    description: exp.description,
                    amount: exp.amount,
                    date: exp.date || new Date().toISOString()
                });
            }
        }

        // Re-fetch to return full object with children?
        saved.subtasks = await azureDb.getSubtasks(saved.id);
        saved.expenses = await azureDb.getExpenses(saved.id);

        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'created', 'Activity', `Activity: ${title} under project ${project_id}`, project_id);

        io.to(project_id).emit('task_updated', { type: 'CREATED', task: saved });
        res.status(201).json(saved);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Update Task (Activity)
apiRouter.put('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const current = await azureDb.getActivityById(id);
        if (!current) return res.status(404).json({ error: "Task (Activity) not found" });

        const {
            project_id, title, objective, status, priority, assignee_id,
            milestone_id, activity_type, nature_of_activity, estimated_hours,
            start_date, due_date, allocation, gms_allocation, obligated_amount, expenses,
            key_result_area, output
        } = req.body;

        // Budget Validation
        const resolvedProjectId = project_id || current.project_id;
        const project = await azureDb.getProjectById(resolvedProjectId);
        if (project) {
            const projectBudget = Number(project.sof_allocation || project.total_budget || 0);
            if (projectBudget > 0) {
                const existingActivities = await azureDb.getActivities(resolvedProjectId);
                const otherActivities = existingActivities.filter(a => a.id !== id);
                const existingObligatedSum = otherActivities.reduce((sum, a) => sum + (Number(a.obligated_amount || a.cost) || 0), 0);

                let requestedObligatedAmount = obligated_amount !== undefined ? Number(obligated_amount) : current.obligated_amount;
                if (expenses && Array.isArray(expenses)) {
                    requestedObligatedAmount = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
                }

                if (existingObligatedSum + requestedObligatedAmount > projectBudget) {
                    return res.status(400).json({ error: `Action Blocked: Total obligated amount would exceed the project's allocated budget (₱${projectBudget.toLocaleString()}).` });
                }
            }
        }

        // Sync expenses in database if provided
        let calculatedObligatedAmount = obligated_amount;
        if (expenses && Array.isArray(expenses)) {
            calculatedObligatedAmount = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
            await azureDb.deleteExpensesByActivityId(id);
            for (const exp of expenses) {
                await azureDb.addExpense({
                    id: exp.id && exp.id.length < 30 ? exp.id : uuidv4(),
                    task_id: id,
                    description: exp.description,
                    amount: exp.amount,
                    date: exp.date || new Date().toISOString()
                });
            }
        }

        const updatedTask = {
            ...current,
            title: title || current.title,
            objective: objective !== undefined ? objective : current.objective,
            status: status || current.status,
            priority: priority || current.priority,
            assignee_id: assignee_id || current.assignee_id,
            milestone_id: milestone_id !== undefined ? milestone_id : current.milestone_id,
            activity_type: activity_type !== undefined ? activity_type : current.activity_type,
            nature_of_activity: nature_of_activity !== undefined ? nature_of_activity : current.nature_of_activity,
            estimated_hours: estimated_hours !== undefined ? Number(estimated_hours) : current.estimated_hours,
            start_date: start_date !== undefined ? start_date : current.start_date,
            due_date: due_date || current.due_date,
            obligated_amount: calculatedObligatedAmount !== undefined ? Number(calculatedObligatedAmount) : current.obligated_amount,
            allocation: allocation !== undefined ? Number(allocation) : (gms_allocation !== undefined ? Number(gms_allocation) : (current.allocation !== undefined ? current.allocation : current.gms_allocation)),
            key_result_area: key_result_area !== undefined ? key_result_area : current.key_result_area,
            output: output !== undefined ? output : current.output
        };

        // Sync subtasks in database if provided
        if (req.body.subtasks && Array.isArray(req.body.subtasks)) {
            for (const sub of req.body.subtasks) {
                const subTaskObj = {
                    id: sub.id || await azureDb.generateControlCode('task'),
                    project_id: resolvedProjectId,
                    activity_id: id,
                    title: sub.title,
                    description: sub.description || '',
                    status: sub.status || 'Pending',
                    assignee_id: sub.assignee_id || null,
                    due_date: sub.due_date || null
                };
                await azureDb.upsertSubtask(subTaskObj);
                
                const username = getUserFromReq(req);
                await azureDb.logActivity(username, sub.id ? 'updated' : 'created', 'Subtask', `Subtask: ${sub.title} under activity ${updatedTask.title}`, resolvedProjectId);
            }
        }

        const saved = await azureDb.upsertActivity(updatedTask);

        saved.subtasks = await azureDb.getSubtasks(saved.id);
        saved.expenses = await azureDb.getExpenses(saved.id);

        const username = getUserFromReq(req);
        
        const changes = [];

        // Helper to format dates for comparison and display
        const getLocalDateString = (d) => {
            if (!d) return null;
            const dateObj = new Date(d);
            if (isNaN(dateObj.getTime())) return null;
            return dateObj.toISOString().split('T')[0];
        };

        const getFriendlyDate = (d) => {
            if (!d) return '';
            const dateObj = new Date(d);
            if (isNaN(dateObj.getTime())) return '';
            return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        };

        if (current.title !== updatedTask.title) {
            changes.push(`changed title to "${updatedTask.title}"`);
        }
        if ((current.objective || '') !== (updatedTask.objective || '')) {
            if (!current.objective && updatedTask.objective) changes.push(`added objective`);
            else if (current.objective && !updatedTask.objective) changes.push(`removed objective`);
            else changes.push(`updated objective`);
        }
        if (current.status !== updatedTask.status) {
            changes.push(`changed status to "${updatedTask.status}"`);
        }
        const currStart = getLocalDateString(current.start_date);
        const updStart = getLocalDateString(updatedTask.start_date);
        if (currStart !== updStart) {
            if (updStart) changes.push(`changed start date to ${getFriendlyDate(updStart)}`);
            else changes.push(`removed start date`);
        }
        const currDue = getLocalDateString(current.due_date);
        const updDue = getLocalDateString(updatedTask.due_date);
        if (currDue !== updDue) {
            if (updDue) changes.push(`changed due date to ${getFriendlyDate(updDue)}`);
            else changes.push(`removed due date`);
        }
        if (Number(current.obligated_amount || 0) !== Number(updatedTask.obligated_amount || 0)) {
            changes.push(`updated obligated amount to ₱${Number(updatedTask.obligated_amount).toLocaleString()}`);
        }
        if (Number(current.allocation || 0) !== Number(updatedTask.allocation || 0)) {
            changes.push(`updated allocation to ₱${Number(updatedTask.allocation).toLocaleString()}`);
        }
        if ((current.key_result_area || '') !== (updatedTask.key_result_area || '')) {
            if (!current.key_result_area && updatedTask.key_result_area) {
                changes.push(`set Key Result Area to "${updatedTask.key_result_area}"`);
            } else if (current.key_result_area && !updatedTask.key_result_area) {
                changes.push(`removed Key Result Area`);
            } else {
                changes.push(`changed Key Result Area to "${updatedTask.key_result_area}"`);
            }
        }
        if ((current.output || '') !== (updatedTask.output || '')) {
            if (!current.output && updatedTask.output) changes.push(`added activity output`);
            else if (current.output && !updatedTask.output) changes.push(`removed activity output`);
            else changes.push(`updated activity output`);
        }
        if (current.activity_type !== updatedTask.activity_type) {
            changes.push(`changed type to "${updatedTask.activity_type}"`);
        }
        if ((current.nature_of_activity || '') !== (updatedTask.nature_of_activity || '')) {
            changes.push(`changed nature of activity to "${updatedTask.nature_of_activity}"`);
        }

        const details = `Activity: ${saved.title}` + (changes.length > 0 ? ` - ${changes[changes.length - 1]}` : '');
        await azureDb.logActivity(username, 'updated', 'Activity', details, saved.project_id);

        io.to(saved.project_id).emit('task_updated', { type: 'UPDATED', task: saved });
        res.json(saved);

    } catch (err) {
        require('fs').appendFileSync(path.join(__dirname, 'error_log.txt'), `[${new Date().toISOString()}] PUT /tasks/${req.params.id} error: ${err.message}\n${err.stack}\n\n`);
        res.status(500).json({ error: err.message });
    }
});

// POST Add Expense
apiRouter.post('/tasks/:id/expenses', async (req, res) => {
    try {
        const { id } = req.params;
        const current = await azureDb.getActivityById(id); // Ensure activity exists
        if (!current) return res.status(404).json({ error: "Task not found" });

        const { description, amount, date } = req.body;
        const newExpense = {
            id: uuidv4(),
            task_id: id,
            description,
            amount: Number(amount),
            date: date || new Date().toISOString()
        };
        const saved = await azureDb.addExpense(newExpense);

        // Notify
        const taskWithExpenses = {
            ...current,
            expenses: await azureDb.getExpenses(id)
        };
        io.to(current.project_id).emit('task_updated', { type: 'EXPENSE_ADDED', task: taskWithExpenses });

        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Expense
apiRouter.delete('/tasks/:taskId/expenses/:expenseId', async (req, res) => {
    try {
        const { taskId, expenseId } = req.params;
        await azureDb.deleteExpense(expenseId);

        const current = await azureDb.getActivityById(taskId);
        if (current) {
            const taskWithExpenses = {
                ...current,
                expenses: await azureDb.getExpenses(taskId)
            };
            io.to(current.project_id).emit('task_updated', { type: 'EXPENSE_REMOVED', task: taskWithExpenses });
        }
        res.status(200).json({ message: "Expense removed" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AI Mock Service
apiRouter.post('/ai/predict-risk', (req, res) => {
    const { burnRate, progress } = req.body;
    const isHighRisk = burnRate > 80 && progress < 50;

    setTimeout(() => {
        res.json({
            riskLevel: isHighRisk ? 'HIGH' : 'LOW',
            message: isHighRisk
                ? 'High Risk of Budget Overrun. Immediate action required.'
                : 'Project is currently on track.'
        });
    }, 1000);
});

// POST Create Subtask
apiRouter.post('/activities/:activityId/tasks', async (req, res) => {
    try {
        const { activityId } = req.params;
        const { title, description, assignee_id, due_date, status } = req.body;

        const parent = await azureDb.getActivityById(activityId);
        if (!parent) return res.status(404).json({ error: "Activity not found" });

        if (title && title.length > 50) return res.status(400).json({ error: 'Task title cannot exceed 50 characters' });

        const newTaskId = await azureDb.generateControlCode('task');
        const newTask = {
            id: newTaskId,
            title,
            description: description || '',
            assignee_id,
            due_date,
            status: status || 'Pending',
            project_id: parent.project_id,
            activity_id: activityId,
            created_at: new Date().toISOString()
        };

        const saved = await azureDb.upsertSubtask(newTask);

        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'created', 'Subtask', `Subtask: ${title} under activity ${parent.title}`, parent.project_id);

        io.to(parent.project_id).emit('task_updated', { type: 'SUBTASK_ADDED', activityId, task: saved });
        res.status(201).json(saved);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Milestones (Global)
apiRouter.get('/milestones', async (req, res) => {
    try {
        const ms = await azureDb.getMilestones();
        res.json(ms);
    } catch (err) {
    }
});

// GET Catchups (Global)
apiRouter.get('/catchups', async (req, res) => {
    try {
        const catchups = await azureDb.getCatchups();
        res.json(catchups);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Milestones (Project specific)
apiRouter.get('/projects/:id/milestones', async (req, res) => {
    try {
        const ms = await azureDb.getMilestones(req.params.id);
        res.json(ms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Create Milestone
apiRouter.post('/milestones', async (req, res) => {
    try {
        const { project_id, title, description, target_date, status, notes } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });

        const id = await azureDb.generateControlCode('milestone');
        const newMilestone = {
            id,
            project_id,
            title,
            description,
            target_date,
            status: status || 'Pending',
            notes,
            created_at: new Date().toISOString()
        };
        const saved = await azureDb.upsertMilestone(newMilestone);
        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'created', 'Milestone', `Milestone: ${title}`, project_id);
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT Update Milestone
apiRouter.put('/milestones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, target_date, status, notes } = req.body;

        const all = await azureDb.getMilestones();
        const existing = all.find(m => m.id === id);

        if (!existing) return res.status(404).json({ error: "Milestone not found" });

        const updated = {
            ...existing,
            title: title || existing.title,
            description: description !== undefined ? description : existing.description,
            target_date: target_date || existing.target_date,
            status: status !== undefined ? status : existing.status,
            notes: notes !== undefined ? notes : existing.notes
        };

        const saved = await azureDb.upsertMilestone(updated);
        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'updated', 'Milestone', `Milestone: ${saved.title}`, saved.project_id);
        res.json(saved);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET All Milestones (Global)
apiRouter.get('/milestones', async (req, res) => {
    try {
        const ms = await azureDb.getMilestones();
        res.json(ms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Milestone
apiRouter.delete('/milestones/:id', async (req, res) => {
    try {
        const msQuery = await azureDb.query('SELECT * FROM milestones_list WHERE id = $1', [req.params.id]);
        const milestone = msQuery.rows[0];
        const projectId = milestone ? milestone.project_id : null;
        const title = milestone ? milestone.title : req.params.id;

        await azureDb.deleteMilestone(req.params.id);
        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'deleted', 'Milestone', `Milestone: ${title}`, projectId);
        res.json({ message: 'Milestone deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Create Catch-up
apiRouter.post('/catchups', async (req, res) => {
    try {
        const { activity_id, title, description, target_date, reason } = req.body;
        if (!title) return res.status(400).json({ error: 'Catch-up activity title is required' });

        const newCatchUp = {
            id: uuidv4(),
            activity_id,
            title,
            description: description || '',
            target_date: target_date || null,
            status: 'Pending',
            reason: reason || '',
            created_at: new Date().toISOString()
        };
        const saved = await azureDb.upsertCatchup(newCatchUp);
        
        // Find activity to get project_id
        const activity = await azureDb.getActivityById(activity_id);
        const projectId = activity ? activity.project_id : null;
        
        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'created', 'Catch-up Plan', `Catch-up: ${title}`, projectId);
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Project Catch-ups
apiRouter.get('/projects/:id/catchups', async (req, res) => {
    try {
        const catchups = await azureDb.getCatchupsByProject(req.params.id);
        res.json(catchups);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});




const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// Auth - Register
apiRouter.post('/auth/register', async (req, res) => {
    try {
        const { email, password, authCode } = req.body;
        if (!email || !password || !authCode) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        if (!email.toLowerCase().endsWith('@deped.gov.ph')) {
            return res.status(400).json({ error: 'Only DepEd emails (@deped.gov.ph) are allowed' });
        }
        const expectedAuthCode = process.env.AUTH_SIGNUP_CODE || 'DEPED-MEMBER';
        if (authCode !== expectedAuthCode) {
            return res.status(400).json({ error: 'Invalid Authorization Code' });
        }
        const existing = await azureDb.getUserByEmail(email.toLowerCase());
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        const id = uuidv4();
        const hashedPassword = hashPassword(password);
        const newUser = await azureDb.createUser(id, email.toLowerCase(), hashedPassword);
        res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auth - Login
apiRouter.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        if (!email.toLowerCase().endsWith('@deped.gov.ph')) {
            return res.status(400).json({ error: 'Only DepEd emails (@deped.gov.ph) are allowed' });
        }
        const user = await azureDb.getUserByEmail(email.toLowerCase());
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const hashedPassword = hashPassword(password);
        if (user.password !== hashedPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const secret = process.env.JWT_SECRET || 'opdash-secret-key-2026';
        const token = jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn: '24h' });
        
        await azureDb.logActivity(user.email, 'logged in', 'Authentication', `User logged in`);
        
        res.json({ token, user: { id: user.id, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auth - Reset Password
apiRouter.post('/auth/reset-password', async (req, res) => {
    try {
        const { email, password, authCode } = req.body;
        if (!email || !password || !authCode) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        if (!email.toLowerCase().endsWith('@deped.gov.ph')) {
            return res.status(400).json({ error: 'Only DepEd emails (@deped.gov.ph) are allowed' });
        }
        const expectedAuthCode = process.env.AUTH_SIGNUP_CODE || 'DEPED-MEMBER';
        if (authCode !== expectedAuthCode) {
            return res.status(400).json({ error: 'Invalid Authorization Code' });
        }
        const user = await azureDb.getUserByEmail(email.toLowerCase());
        if (!user) {
            return res.status(404).json({ error: 'Account not found with this email' });
        }
        const hashedPassword = hashPassword(password);
        await azureDb.updateUserPassword(email.toLowerCase(), hashedPassword);
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auth - Me
apiRouter.get('/auth/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET || 'opdash-secret-key-2026';
        const decoded = jwt.verify(token, secret);
        const user = await azureDb.getUserByEmail(decoded.email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user: { id: user.id, email: user.email } });
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
});

// Use the router
app.use(['/api', '/opdash/api'], apiRouter);

// Catch-all for SPA (if not matched by API)
app.get('/opdash/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// DELETE Activity
apiRouter.delete('/tasks/:id', async (req, res) => {
    try {
        const activity = await azureDb.getActivityById(req.params.id);
        const projectId = activity ? activity.project_id : null;
        const title = activity ? activity.title : req.params.id;

        await azureDb.deleteActivity(req.params.id);
        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'deleted', 'Activity', `Activity: ${title}`, projectId);
        res.json({ message: 'Activity deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Subtask
apiRouter.delete('/subtasks/:id', async (req, res) => {
    try {
        const subtaskRes = await azureDb.query('SELECT * FROM task_list WHERE id = $1', [req.params.id]);
        const subtask = subtaskRes.rows[0];
        const projectId = subtask ? subtask.project_id : null;
        const title = subtask ? subtask.title : req.params.id;

        await azureDb.deleteSubtask(req.params.id);
        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'deleted', 'Subtask', `Subtask: ${title}`, projectId);
        res.json({ message: 'Subtask deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Catch-up
apiRouter.delete('/catchups/:id', async (req, res) => {
    try {
        const cuRes = await azureDb.query('SELECT c.*, a.project_id FROM catchup_list c LEFT JOIN activities_list a ON c.activity_id = a.id WHERE c.id = $1', [req.params.id]);
        const catchup = cuRes.rows[0];
        const projectId = catchup ? catchup.project_id : null;
        const title = catchup ? catchup.title : req.params.id;

        await azureDb.deleteCatchup(req.params.id);
        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'deleted', 'Catch-up Plan', `Catch-up: ${title}`, projectId);
        res.json({ message: 'Catch-up plan deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Milestone
apiRouter.delete('/milestones/:id', async (req, res) => {
    try {
        const msQuery = await azureDb.query('SELECT * FROM milestones_list WHERE id = $1', [req.params.id]);
        const milestone = msQuery.rows[0];
        const projectId = milestone ? milestone.project_id : null;
        const title = milestone ? milestone.title : req.params.id;

        await azureDb.deleteMilestone(req.params.id);
        const username = getUserFromReq(req);
        await azureDb.logActivity(username, 'deleted', 'Milestone', `Milestone: ${title}`, projectId);
        res.json({ message: 'Milestone deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

server.listen(PORT, () => {

    console.log(`Server running on http://localhost:${PORT}`);
});
