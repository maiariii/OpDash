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
// production mode
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

            // NEW LOGIC: Fall back to overall project budget if activity allocations are not defined (sum to 0)
            const finalBudget = calculatedBudget > 0 ? calculatedBudget : (Number(p.sof_allocation || 0));

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
        res.status(201).json({
            ...saved,
            name: `${saved.first_name} ${saved.middle_name || ''} ${saved.last_name}`.trim().replace(/\s+/g, ' ')
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
        res.json({
            ...saved,
            name: `${saved.first_name} ${saved.middle_name || ''} ${saved.last_name}`.trim().replace(/\s+/g, ' ')
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Employee
apiRouter.delete('/employees/:id', async (req, res) => {
    try {
        await azureDb.deleteEmployee(req.params.id);
        res.json({ message: 'Employee deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Project
apiRouter.delete('/projects/:id', async (req, res) => {
    try {
        await azureDb.deleteProject(req.params.id);
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

        // Fall back to overall project budget if activity allocations are not defined (sum to 0)
        const finalAllocation = totalAllocation > 0 ? totalAllocation : (Number(project.sof_allocation) || 0);

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
        const { project_id, title, objective, parent_path, status, assignee_id, milestone_id, activity_type, nature_of_activity, estimated_hours, start_date, due_date, obligated_amount, allocation, gms_allocation, expenses } = req.body;

        if (title && title.length > 50) return res.status(400).json({ error: 'Activity title cannot exceed 50 characters' });
        if (objective && objective.length > 100) return res.status(400).json({ error: 'Activity objective cannot exceed 100 characters' });

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
            start_date, due_date, allocation, gms_allocation, obligated_amount, expenses
        } = req.body;

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
            allocation: allocation !== undefined ? Number(allocation) : (gms_allocation !== undefined ? Number(gms_allocation) : (current.allocation !== undefined ? current.allocation : current.gms_allocation))
        };

        const saved = await azureDb.upsertActivity(updatedTask);

        saved.subtasks = await azureDb.getSubtasks(saved.id);
        saved.expenses = await azureDb.getExpenses(saved.id);

        io.to(saved.project_id).emit('task_updated', { type: 'UPDATED', task: saved });
        res.json(saved);

    } catch (err) {
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
        const { project_id, title, description, target_date, notes } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });

        const id = await azureDb.generateControlCode('milestone');
        const newMilestone = {
            id,
            project_id,
            title,
            description,
            target_date,
            notes,
            created_at: new Date().toISOString()
        };
        const saved = await azureDb.upsertMilestone(newMilestone);
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT Update Milestone
apiRouter.put('/milestones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, target_date, notes } = req.body;

        const all = await azureDb.getMilestones();
        const existing = all.find(m => m.id === id);

        if (!existing) return res.status(404).json({ error: "Milestone not found" });

        const updated = {
            ...existing,
            title: title || existing.title,
            description: description !== undefined ? description : existing.description,
            target_date: target_date || existing.target_date,
            notes: notes !== undefined ? notes : existing.notes
        };

        const saved = await azureDb.upsertMilestone(updated);
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
        await azureDb.deleteMilestone(req.params.id);
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
        await azureDb.deleteActivity(req.params.id);
        res.json({ message: 'Activity deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Subtask
apiRouter.delete('/subtasks/:id', async (req, res) => {
    try {
        await azureDb.deleteSubtask(req.params.id);
        res.json({ message: 'Subtask deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Catch-up
apiRouter.delete('/catchups/:id', async (req, res) => {
    try {
        await azureDb.deleteCatchup(req.params.id);
        res.json({ message: 'Catch-up plan deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Milestone
apiRouter.delete('/milestones/:id', async (req, res) => {
    try {
        await azureDb.deleteMilestone(req.params.id);
        res.json({ message: 'Milestone deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

server.listen(PORT, () => {

    console.log(`Server running on http://localhost:${PORT}`);
});
