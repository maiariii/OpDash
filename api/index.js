const express = require('express');
const cors = require('cors');
const { readDb, writeDb } = require('./db');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

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

    const newProject = {
        id: uuidv4(),
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

    res.status(201).json(newProject);
});

// PUT Update Project
app.put('/api/projects/:id', (req, res) => {
    const db = readDb();
    const { id } = req.params;
    const { name, description, division, lead_personnel, supervising_officer, assisting_personnel, status } = req.body;

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

    const newUser = {
        id: uuidv4(),
        first_name,
        middle_name: middle_name || '',
        last_name,
        division_id,
        position: position || 'Staff',
        hourly_rate: 50 // Default
    };

    if (!db.users) db.users = [];
    db.users.push(newUser);
    writeDb(db);

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
    const db = readDb();
    const { project_id, title, objective, parent_path, status, assignee_id, estimated_hours, start_date, due_date, cost, budget } = req.body;

    const newId = uuidv4().replace(/-/g, '_'); // Safe ID
    const path = parent_path ? `${parent_path}.${newId}` : newId;

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

    if (!db.tasks) db.tasks = [];
    db.tasks.push(newTask);
    writeDb(db);

    io.to(project_id).emit('task_updated', { type: 'CREATED', task: newTask });
    res.status(201).json(newTask);
});

// PUT Update Task
app.put('/api/tasks/:id', (req, res) => {
    const db = readDb();
    const { status, title, objective, priority, assignee_id, start_date, due_date, cost, budget } = req.body;
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

server.listen(PORT, () => {
    console.log(`Enterprise Server (Local Mode) running on http://localhost:${PORT}`);
});
// Server restart trigger
