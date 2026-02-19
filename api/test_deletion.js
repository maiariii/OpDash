const azureDb = require('./azureDb');
const { randomUUID } = require('crypto');

async function runTest() {
    console.log("Starting Deletion Test...");

    try {
        await azureDb.initDB();
        console.log("DB Initialized.");

        // 1. Create a Project
        const project = await azureDb.upsertProject({
            id: randomUUID(),
            name: "Test Project for Deletion",
            status: "On Track",
            division: "Test Division"
        });
        console.log("Created Project:", project.id);

        // 2. Create an Activity
        const activity = await azureDb.upsertActivity({
            id: randomUUID(),
            project_id: project.id,
            title: "Test Activity",
            status: "Pending"
        });
        console.log("Created Activity:", activity.id);

        // 3. Create a Subtask
        const subtask = await azureDb.upsertSubtask({
            id: randomUUID(),
            activity_id: activity.id,
            title: "Test Subtask",
            status: "Pending"
        });
        console.log("Created Subtask:", subtask.id);

        // 4. Create a Catch-up Plan
        const catchup = await azureDb.upsertCatchup({
            id: randomUUID(),
            activity_id: activity.id,
            title: "Test Catchup",
            reason: "Testing"
        });
        console.log("Created Catchup:", catchup.id);

        // 5. Create a Milestone
        const milestone = await azureDb.upsertMilestone({
            id: randomUUID(),
            project_id: project.id,
            title: "Test Milestone",
            target_date: new Date()
        });
        console.log("Created Milestone:", milestone.id);

        // 6. Create an Expense
        const expense = await azureDb.addExpense({
            id: randomUUID(),
            activity_id: activity.id,
            description: "Test Expense",
            amount: 100,
            date: new Date()
        });
        console.log("Created Expense:", expense.id);


        console.log("\nDeleting Project...");
        await azureDb.deleteProject(project.id);
        console.log("Project Deleted.");

        // 7. Verify Deletion
        console.log("\nVerifying Deletion...");

        const p = await azureDb.getProjectById(project.id);
        if (p) console.error("FAIL: Project still exists");
        else console.log("PASS: Project deleted");

        const a = await azureDb.getActivityById(activity.id);
        if (a) console.error("FAIL: Activity still exists");
        else console.log("PASS: Activity deleted");

        // We don't have getSubtaskById efficiently exposed, but we can query DB or use getSubtasks
        const subtasks = await azureDb.getSubtasks(activity.id); // Should be empty
        if (subtasks.length > 0) console.error("FAIL: Subtasks still exist");
        else console.log("PASS: Subtasks deleted");

        // Check Milestone
        const milestones = await azureDb.getMilestones(project.id);
        if (milestones.length > 0) console.error("FAIL: Milestones still exist");
        else console.log("PASS: Milestones deleted");

        // Check Catchups
        const catchups = await azureDb.getCatchups(activity.id);
        if (catchups.length > 0) console.error("FAIL: Catchups still exist");
        else console.log("PASS: Catchups deleted");

        // Check Expenses - we need a way to check. getExpenses(activityId)
        const expenses = await azureDb.getExpenses(activity.id);
        if (expenses.length > 0) console.error("FAIL: Expenses still exist");
        else console.log("PASS: Expenses deleted");

    } catch (err) {
        console.error("Test Failed:", err);
    }
}

runTest();
