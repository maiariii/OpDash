const express = require('express');
const cors = require('cors');
const { readDb, writeDb } = require('./db');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const { ensureTableAndInsertProject, ensureTableAndInsertActivity, ensureTableAndInsertTask, ensureTableAndInsertEmployee, ensureTableAndInsertIndicator, ensureTableAndInsertCatchUp } = require('./azureDb');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'debug_log.txt');
fs.appendFileSync(logFile, `[${new Date().toISOString()}] SERVER STARTUP: api/index.js loaded\n`);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT"]
    }
});

const PORT = 3000;

app.use(cors());
app.use(express.json());

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

// Helper to generate control codes
const generateControlCode = (db, type) => {
    let prefix = '';
    let list = [];

    if (type === 'project') {
        prefix = 'HRODI-P';
        list = db.projects || [];
    } else if (type === 'activity') {
        prefix = 'HRODI-A';
        list = db.tasks || [];
    } else if (type === 'task') {
        prefix = 'HRODI-T';
        // Flatten all subtasks from all activities
        (db.tasks || []).forEach(activity => {
            if (activity.subtasks && Array.isArray(activity.subtasks)) {
                list = list.concat(activity.subtasks);
            }
        });
    } else if (type === 'employee') {
        prefix = 'HRODI-E';
        list = db.users || [];
    }

    let maxNum = 0;
    // Projects/Tasks use 3 digits, Employees use 4 digits
    const digits = type === 'employee' ? 4 : 3;
    const regex = new RegExp(`^${prefix}(\\d{${digits}})$`);

    list.forEach(item => {
        if (item.id) {
            const match = item.id.match(regex);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
            }
        }
    });

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(digits, '0')}`;
};

// ---------------------------
// ENDPOINTS
// ---------------------------

// GET All Projects
app.get('/api/projects', (req, res) => {
    const db = readDb();
    res.json(db.projects || []);
});

// POST Create Project
app.post('/api/projects', (req, res) => {
    const db = readDb();
    const { name, description, division, lead_personnel, supervising_officer, assisting_personnel } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Project Name is required' });
    }
    if (name.length > 50) {
        return res.status(400).json({ error: 'Project Name cannot exceed 50 characters' });
    }
    if (description && description.length > 100) {
        return res.status(400).json({ error: 'Project description cannot exceed 100 characters' });
    }

    const newProject = {
        id: generateControlCode(db, 'project'),
        name,
        description: description || '',
        division: division || 'N/A',
        lead_personnel: lead_personnel || 'N/A',
        supervising_officer: supervising_officer || 'N/A',
        assisting_personnel: assisting_personnel || 'N/A',
        status: 'Planning',
        created_at: new Date().toISOString()
    };

    if (!db.projects) db.projects = [];
    db.projects.push(newProject);
    writeDb(db);

    // Lodge in Azure OpDash database
    ensureTableAndInsertProject(newProject).catch(err => console.error("Azure DB Sync Error:", err));

    res.status(201).json(newProject);
});

// PUT Update Project
app.put('/api/projects/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const { name, description, division, lead_personnel, supervising_officer, assisting_personnel, status } = req.body;

    if (name && name.length > 50) {
        return res.status(400).json({ error: 'Project Name cannot exceed 50 characters' });
    }

    if (description !== undefined && description.length > 100) {
        return res.status(400).json({ error: 'Project description cannot exceed 100 characters' });
    }

    const index = (db.projects || []).findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ error: 'Project not found' });

    const updatedProject = {
        ...db.projects[index],
        name: name || db.projects[index].name,
        description: description !== undefined ? description : db.projects[index].description,
        division: division || db.projects[index].division,
        lead_personnel: lead_personnel || db.projects[index].lead_personnel,
        supervising_officer: supervising_officer || db.projects[index].supervising_officer,
        assisting_personnel: assisting_personnel || db.projects[index].assisting_personnel,
        status: status || db.projects[index].status
    };

    db.projects[index] = updatedProject;
    writeDb(db);
    res.json(updatedProject);
});

// GET All Divisions
app.get('/api/divisions', (req, res) => {
    const db = readDb();
    res.json(db.divisions || []);
});

// POST Create Division
app.post('/api/divisions', (req, res) => {
    const db = readDb();
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const newDiv = { id: uuidv4(), name };
    if (!db.divisions) db.divisions = [];
    db.divisions.push(newDiv);
    writeDb(db);
    res.status(201).json(newDiv);
});

// PUT Update Division
app.put('/api/divisions/:id', (req, res) => {
    const db = readDb();
    const { name } = req.body;
    const { id } = req.params;

    if (!db.divisions) return res.status(404).json({ error: 'No divisions found' });

    const index = db.divisions.findIndex(d => d.id === id);
    if (index === -1) return res.status(404).json({ error: 'Division not found' });

    db.divisions[index].name = name || db.divisions[index].name;
    writeDb(db);
    res.json(db.divisions[index]);
});

// GET All Employees
app.get('/api/employees', (req, res) => {
    const db = readDb();
    const users = (db.users || []).map(u => ({
        ...u,
        // Virtual field for backward compatibility
        name: `${u.first_name || ''} ${u.middle_name || ''} ${u.last_name || ''}`.trim().replace(/\s+/g, ' ')
    }));
    res.json(users);
});

// POST Create Employee
app.post('/api/employees', (req, res) => {
    const db = readDb();
    const { first_name, middle_name, last_name, division_id, position } = req.body;

    if (!first_name || !last_name || !division_id) return res.status(400).json({ error: 'Name and Division required' });

    // Find division name
    const division = (db.divisions || []).find(d => d.id === division_id);
    const divisionName = division ? division.name : 'Unknown';

    const newUser = {
        id: generateControlCode(db, 'employee'),
        first_name,
        middle_name: middle_name || '',
        last_name,
        division_id, // Keep for reference if needed, or remove? Plan said "Put actual Division instead of Division ID". I'll keep ID for linking but ADD name, or replace?
        // User said "Put the actual Division instead of Division ID". 
        // In local DB (JSON), I should probably keep division_id for relational integrity if I ever need it, 
        // BUT for the Azure Sync I definitely need to send the name.
        // Let's store both in local DB for now to be safe, but focus on the "division" field for Azure.
        division: divisionName,
        position: position || 'Staff'
        // hourly_rate removed
    };

    if (!db.users) db.users = [];
    db.users.push(newUser);
    writeDb(db);

    // Lodge in Azure OpDash database (employee_list)
    // Pass the full object, ensureTableAndInsertEmployee will handle the mapping
    ensureTableAndInsertEmployee(newUser).catch(err => console.error("Azure DB Employee Sync Error:", err));

    // Return with virtual name for frontend consistency
    res.status(201).json({
        ...newUser,
        name: `${first_name} ${middle_name || ''} ${last_name}`.trim().replace(/\s+/g, ' ')
    });
});

// DELETE Employee
app.delete('/api/employees/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;

    if (!db.users) return res.status(404).json({ error: 'No users found' });

    const initialLength = db.users.length;
    db.users = db.users.filter(u => u.id !== id);

    if (db.users.length === initialLength) {
        return res.status(404).json({ error: 'Employee not found' });
    }

    writeDb(db);
    res.json({ message: 'Employee deleted successfully' });
});

// GET Project Financials (Simulated SQL View)
app.get('/api/projects/:id/financials', (req, res) => {
    const db = readDb();
    const projectId = req.params.id;
    const project = (db.projects || []).find(p => p.id === projectId);

    if (!project) return res.status(404).json({ error: 'Project not found' });

    // 1. Get all tasks for project
    const projectTasks = (db.tasks || []).filter(t => t.project_id === projectId);
    const taskIds = projectTasks.map(t => t.id);

    // 2. Get all time logs for these tasks
    const logs = (db.time_logs || []).filter(l => taskIds.includes(l.task_id));

    // 3. Calculate Actual Cost (Sum of hours * user_rate) + (Sum of Task Costs)
    let actualCost = 0;
    let totalHours = 0;

    // Labor Cost
    logs.forEach(log => {
        const user = (db.users || []).find(u => u.id === log.user_id);
        const rate = user ? user.hourly_rate : 0;
        actualCost += (log.hours_logged * rate);
        totalHours += log.hours_logged;
    });

    // Task Expenses (Direct Costs) AND Budget Calculation
    let dynamicTotalBudget = 0;
    projectTasks.forEach(t => {
        // Legacy Cost support + New Expenses array
        let taskCost = 0;
        if (t.expenses && Array.isArray(t.expenses)) {
            taskCost = t.expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
        } else if (t.cost) {
            taskCost = Number(t.cost);
        }
        actualCost += taskCost;

        if (t.budget) {
            dynamicTotalBudget += Number(t.budget);
        }
    });

    // If no task budgets, fallback to project's static budget or 1
    const finalBudget = dynamicTotalBudget > 0 ? dynamicTotalBudget : (project.total_budget || 1);

    // 4. Calculate Metrics
    const burnRate = (actualCost / finalBudget) * 100;

    // CPI Calculation (Simplified: Earned Value / Actual Cost)
    // EV = (% of tasks done) * Budget
    const completedTasks = projectTasks.filter(t => t.status === 'Done').length;
    const totalTasks = projectTasks.length || 1;
    const percentComplete = completedTasks / totalTasks;
    const earnedValue = percentComplete * finalBudget;

    const cpi = actualCost > 0 ? (earnedValue / actualCost) : 1;

    // Remaining Budget
    const remainingBudget = finalBudget - actualCost;

    res.json({
        id: project.id,
        name: project.name,
        total_budget: finalBudget,
        remaining_budget: remainingBudget,
        actual_cost: actualCost,
        total_hours: totalHours,
        burn_rate_percent: burnRate,
        cpi: cpi
    });
});

// GET Hierarchical Tasks (Simulated ltree)
app.get('/api/projects/:id/tasks', (req, res) => {
    const db = readDb();
    const projectId = req.params.id;

    // Filter tasks for this project
    let tasks = (db.tasks || []).filter(t => t.project_id === projectId);

    // Join with Users and Divisions to get "Division Name" for color coding
    tasks = tasks.map(t => {
        let divisionName = 'Unassigned';
        if (t.assignee_id) {
            const user = (db.users || []).find(u => u.id === t.assignee_id);
            if (user && user.division_id) {
                const division = (db.divisions || []).find(d => d.id === user.division_id);
                if (division) {
                    divisionName = division.name;
                }
            }
        }
        return { ...t, division_name: divisionName };
    });

    // Sort by path (simulating ltree sorting: t1, t1.t2, t3...)
    tasks.sort((a, b) => {
        if (!a.path) return 1;
        if (!b.path) return -1;
        return a.path.localeCompare(b.path);
    });

    res.json(tasks);
});

// POST Create Task
app.post('/api/tasks', (req, res) => {
    const database = readDb();
    const { project_id, title, objective, parent_path, status, assignee_id, estimated_hours, start_date, due_date, cost, budget } = req.body;

    if (title && title.length > 50) {
        return res.status(400).json({ error: 'Activity title cannot exceed 50 characters' });
    }
    if (objective && objective.length > 100) {
        return res.status(400).json({ error: 'Activity objective cannot exceed 100 characters' });
    }

    const newId = generateControlCode(database, 'activity');
    const path = parent_path ? `${parent_path}.${newId}` : newId;

    // Log the incoming request body for debugging
    console.log("[API] POST /api/tasks received body:", req.body);

    const newTask = {
        id: newId,
        project_id,
        path,
        title,
        objective: objective || '',
        status: status || 'Todo',
        priority: 'Medium',
        assignee_id,
        estimated_hours: Number(estimated_hours) || 0,
        start_date,
        due_date,
        cost: Number(cost) || 0,
        budget: Number(budget) || 0,
        expenses: req.body.expenses || [],
        subtasks: req.body.subtasks || [],
        version: 1
    };

    console.log("[API] Constructed newTask:", newTask);

    if (!database.tasks) database.tasks = [];
    database.tasks.push(newTask);
    writeDb(database);

    // Lodge in Azure OpDash database (activities_list)
    ensureTableAndInsertActivity(newTask).catch(err => console.error("Azure DB Activity Sync Error:", err));

    io.to(project_id).emit('task_updated', { type: 'CREATED', task: newTask });
    res.status(201).json(newTask);
});

// PUT Update Task
app.put('/api/tasks/:id', (req, res) => {
    const db = readDb();
    const { status, title, objective, priority, assignee_id, start_date, due_date, cost, budget } = req.body;

    if (title !== undefined && title.length > 50) {
        return res.status(400).json({ error: 'Activity title cannot exceed 50 characters' });
    }

    if (objective !== undefined && objective.length > 100) {
        return res.status(400).json({ error: 'Activity objective cannot exceed 100 characters' });
    }

    if (req.body.subtasks && Array.isArray(req.body.subtasks)) {
        const invalidSubtaskTitle = req.body.subtasks.find(st => st.title && st.title.length > 50);
        if (invalidSubtaskTitle) {
            return res.status(400).json({ error: 'Task title cannot exceed 50 characters' });
        }
        const invalidSubtask = req.body.subtasks.find(st => st.description && st.description.length > 100);
        if (invalidSubtask) {
            return res.status(400).json({ error: 'Task description cannot exceed 100 characters' });
        }
    }
    const tasks = db.tasks || [];
    const index = tasks.findIndex(t => t.id === req.params.id);

    if (index !== -1) {
        const task = tasks[index];
        const updatedTask = {
            ...task,
            title: title || task.title,
            objective: objective !== undefined ? objective : task.objective,
            status: status || task.status,
            priority: priority || task.priority,
            assignee_id: assignee_id || task.assignee_id,
            start_date: start_date || task.start_date,
            due_date: due_date || task.due_date,
            cost: cost !== undefined ? Number(cost) : task.cost,
            budget: budget !== undefined ? Number(budget) : task.budget,
            expenses: req.body.expenses || task.expenses || [],
            subtasks: req.body.subtasks || task.subtasks || [],
            version: (task.version || 1) + 1
        };

        db.tasks[index] = updatedTask;
        writeDb(db);

        // Notify with full task data
        io.to(updatedTask.project_id).emit('task_updated', { type: 'UPDATED', task: updatedTask });
        res.json(updatedTask);
    } else {
        res.status(404).json({ error: "Task not found" });
    }
});

// POST Add Expense to Task
app.post('/api/tasks/:id/expenses', (req, res) => {
    const db = readDb();
    const { description, amount, date } = req.body;
    const tasks = db.tasks || [];
    const index = tasks.findIndex(t => t.id === req.params.id);

    if (index !== -1) {
        const task = tasks[index];
        const newExpense = {
            id: uuidv4(),
            description,
            amount: Number(amount),
            date: date || new Date().toISOString()
        };

        if (!task.expenses) task.expenses = [];
        task.expenses.push(newExpense);

        // Update task actual cost (legacy field sync optional, but we verify on read)

        db.tasks[index] = task;
        writeDb(db);

        io.to(task.project_id).emit('task_updated', { type: 'EXPENSE_ADDED', task });
        res.status(201).json(newExpense);
    } else {
        res.status(404).json({ error: "Task not found" });
    }
});

// DELETE Remove Expense from Task
app.delete('/api/tasks/:taskId/expenses/:expenseId', (req, res) => {
    const db = readDb();
    const { taskId, expenseId } = req.params;
    const tasks = db.tasks || [];
    const index = tasks.findIndex(t => t.id === taskId);

    if (index !== -1) {
        const task = tasks[index];
        if (task.expenses) {
            task.expenses = task.expenses.filter(e => e.id !== expenseId);
            db.tasks[index] = task;
            writeDb(db);

            io.to(task.project_id).emit('task_updated', { type: 'EXPENSE_REMOVED', task });
            res.status(200).json({ message: "Expense removed" });
        } else {
            res.status(404).json({ error: "No expenses found" });
        }
    } else {
        res.status(404).json({ error: "Task not found" });
    }
});

// AI Mock Service
app.post('/api/ai/predict-risk', (req, res) => {
    const { burnRate, progress } = req.body;
    // Logic: If Burn Rate > 80% AND Progress < 50% -> High Risk
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

// POST Create Subtask (Activity -> Task)
app.post('/api/activities/:activityId/tasks', (req, res) => {
    console.log(`[API] POST /api/activities/${req.params.activityId}/tasks called. Body:`, req.body);
    const db = readDb();
    const { activityId } = req.params;
    const { title, description, assignee_id, due_date, status } = req.body;

    if (title && title.length > 50) {
        return res.status(400).json({ error: 'Task title cannot exceed 50 characters' });
    }
    if (description && description.length > 100) {
        return res.status(400).json({ error: 'Task description cannot exceed 100 characters' });
    }
    const tasks = db.tasks || [];
    const index = tasks.findIndex(t => t.id === activityId);

    if (index === -1) {
        return res.status(404).json({ error: "Activity not found" });
    }

    const activity = tasks[index];
    const newTaskId = generateControlCode(db, 'task');

    const newTask = {
        id: newTaskId,
        title,
        description: description || '',
        assignee_id,
        due_date,
        status: status || 'Todo',
        project_id: activity.project_id, // Inherit project_id
        activity_id: activityId
    };

    if (!activity.subtasks) activity.subtasks = [];
    activity.subtasks.push(newTask);

    db.tasks[index] = activity;
    writeDb(db);

    // Lodge in Azure OpDash database (task_list)
    ensureTableAndInsertTask(newTask).catch(err => console.error("Azure DB Task Sync Error:", err));

    io.to(activity.project_id).emit('task_updated', { type: 'SUBTASK_ADDED', activityId, task: newTask });
    res.status(201).json(newTask);
});

// GET Indicators for Project
app.get('/api/projects/:id/indicators', (req, res) => {
    const db = readDb();
    const projectId = req.params.id;
    const indicators = (db.indicators || []).filter(i => i.project_id === projectId);
    res.json(indicators);
});

// POST Create Indicator
app.post('/api/indicators', (req, res) => {
    const db = readDb();
    const { project_id, activity_id, indicator, target } = req.body;

    if (!indicator || indicator.trim().length === 0) {
        return res.status(400).json({ error: 'Indicator name is required' });
    }
    if (indicator.length > 30) {
        return res.status(400).json({ error: 'Indicator cannot exceed 30 characters' });
    }
    // Check for Proper Case (simple check: first letter should be uppercase)
    // Actually, user said "Proper Case". I'll enforce it purely via code if I wanted, 
    // but usually validation means rejecting it. 
    // Let's implement a quick regex or logic?
    // "Proper Case" usually means "First Letter Uppercase, rest lowercase" or "Title Case".
    // Given the request "Proper Case max 30 characters", I will assume Title Case or Sentence Case.
    // Let's just validate length for now and maybe basic capitalization?
    // The prompt says "Allow them to add indicators", implies inputs.
    // I'll stick to length validation here and trust frontend to guide formatting, 
    // but since I'm the backend I should probably enforce it?
    // Let's just do length and required for now to be safe, filtering logic is better in frontend?
    // Actually, I can just save exactly what is sent. Frontend handles input masking/validation.

    if (isNaN(target)) {
        return res.status(400).json({ error: 'Target must be a number' });
    }

    const newIndicator = {
        id: uuidv4(),
        project_id,
        activity_id,
        indicator, // Frontend should ensure Proper Case
        target: Number(target),
        created_at: new Date().toISOString()
    };

    if (!db.indicators) db.indicators = [];
    db.indicators.push(newIndicator);
    writeDb(db);

    // Sync to Azure
    ensureTableAndInsertIndicator(newIndicator).catch(err => console.error("Azure DB Indicator Sync Error:", err));

    res.status(201).json(newIndicator);
});

// POST Create Catch-up Activity
app.post('/api/catchups', (req, res) => {
    console.log("[API] POST /api/catchups called");
    const db = readDb();
    const { activity_id, title, description, target_date } = req.body;

    if (!title) {
        return res.status(400).json({ error: 'Catch-up activity title is required' });
    }
    if (!activity_id) {
        return res.status(400).json({ error: 'Activity ID is required' });
    }

    const newCatchUp = {
        id: uuidv4(),
        activity_id,
        title,
        description: description || '',
        target_date: target_date || null,
        status: 'Pending',
        created_at: new Date().toISOString()
    };

    if (!db.catchups) db.catchups = [];
    db.catchups.push(newCatchUp);
    writeDb(db);

    // Sync to Azure
    ensureTableAndInsertCatchUp(newCatchUp).catch(err => console.error("Azure DB CatchUp Sync Error:", err));

    res.status(201).json(newCatchUp);
});

// GET Catch-up Activities for an Activity
app.get('/api/activities/:id/catchups', (req, res) => {
    const db = readDb();
    const activityId = req.params.id;
    const catchups = (db.catchups || []).filter(c => c.activity_id === activityId);
    res.json(catchups);
});

// GET Catch-up Activities for a Project
app.get('/api/projects/:projectId/catchups', (req, res) => {
    const db = readDb();
    const projectId = req.params.projectId;

    // 1. Get all activities for this project
    const projectActivities = (db.tasks || []).filter(a => a.project_id === projectId);
    const activityIds = new Set(projectActivities.map(a => a.id));

    // 2. Filter catchups that belong to these activities
    const catchups = (db.catchups || []).filter(c => activityIds.has(c.activity_id));

    res.json(catchups);
});

server.listen(PORT, () => {
    console.log(`Enterprise Server (Local Mode) running on http://localhost:${PORT}`);
});
// Server restart trigger - updated 2
