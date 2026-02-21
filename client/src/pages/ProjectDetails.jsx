import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { DragDropContext } from '@hello-pangea/dnd';
import {
    ArrowLeft, Layout, Calendar, PieChart, Activity, Target,
    Users, Edit2, Save, X, Layers, CheckSquare, Square, Table, Plus, List
} from 'lucide-react';
import clsx from 'clsx';
import {
    getProjects, getProjectTasks, getProjectFinancials,
    getProjectMilestones,
    updateTask, createTask, predictRisk,
    updateProject, getDivisions, getEmployees, getPrograms
} from '../api';

import KanbanBoard from '../components/KanbanBoard';
import GanttChart from '../components/GanttChart';
import CreateTaskModal from '../components/CreateTaskModal';
import EditSubtaskModal from '../components/EditSubtaskModal';
import TaskTable from '../components/TaskTable';
import ActivityList from '../components/ActivityList';
import SubtaskTable from '../components/SubtaskTable';
import CreateSubtaskModal from '../components/CreateSubtaskModal';
import MilestonesTab from '../components/MilestonesTab';
import SpilloversTab from '../components/SpilloversTab';
import DashboardCharts from '../components/DashboardCharts';

import CalendarView from '../components/CalendarView';
import Loader from '../components/Loader';


const TabButton = ({ active, children, onClick, icon: Icon }) => (
    <button
        onClick={onClick}
        className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
            active
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 shadow-sm"
        )}
    >
        <Icon size={16} />
        {children}
    </button>
);

const ProjectDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [milestones, setMilestones] = useState([]); // Added milestones state
    const [financials, setFinancials] = useState(null);
    const [activeTab, setActiveTab] = useState('kanban');
    const [viewMode, setViewMode] = useState('table'); // 'table', 'list', 'gantt', 'kanban'
    const [aiRisk, setAiRisk] = useState(null);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [fundingSources, setFundingSources] = useState({ gaaPs: false, gaaMooe: false, gms: false });
    const [editingTask, setEditingTask] = useState(null); // For Task Modal

    const [isCreatingTask, setIsCreatingTask] = useState(false); // For Creating New Task
    const [showCreateSubtask, setShowCreateSubtask] = useState(false); // For New Subtask Modal
    const [editingSubtask, setEditingSubtask] = useState(null); // For Subtask Modal
    const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Sidebar State
    const [initialTaskDate, setInitialTaskDate] = useState(null); // Initial Date for New Task

    // Dropdown Data
    const [divisions, setDivisions] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [programs, setPrograms] = useState([]);

    useEffect(() => {
        // Load initial data
        Promise.all([
            getProjects(),
            getProjectTasks(id),
            getProjectFinancials(id),
            getProjectMilestones(id), // Fetch Milestones
            getDivisions(),
            getEmployees(),
            getPrograms()
        ]).then(([projects, tasks, fin, ms, divs, emps, progs]) => {
            const p = projects.find(p => p.id === id);
            setProject(p);
            setTasks(tasks);
            setFinancials(fin);
            setMilestones(ms); // Set Milestones
            setDivisions(divs);
            setEmployees(emps);
            setPrograms(progs);

            // Init Edit Form
            if (p) setEditForm(p);

            // AI Risk Check
            predictRisk({ burnRate: fin.burn_rate_percent, progress: 40 }) // Mock progress
                .then(setAiRisk);
        });

        // Socket setup
        const socket = io({ path: '/opdash/socket.io' });
        socket.emit('join_project', id);

        socket.on('task_updated', (event) => {
            getProjectTasks(id).then(setTasks);
            getProjectFinancials(id).then(setFinancials);
        });

        return () => socket.disconnect();
    }, [id]);

    useEffect(() => {
        if (isEditing && project) {
            setFundingSources({
                gaaPs: Number(project.gaa_ps) > 0,
                gaaMooe: Number(project.gaa_mooe) > 0,
                gms: Number(project.gms_allocation) > 0
            });
            // Ensure editForm has numeric values or at least 0
            setEditForm(prev => ({
                ...prev,
                gaa_ps: Number(prev.gaa_ps) || 0,
                gaa_mooe: Number(prev.gaa_mooe) || 0,
                gms_allocation: Number(prev.gms_allocation) || 0
            }));
        }
    }, [isEditing, project]);

    const handleTaskUpdate = (task) => {
        setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    };

    const handleTaskDeleted = () => {
        getProjectTasks(id).then(setTasks);
        getProjectFinancials(id).then(setFinancials);
    };

    const handleSaveProject = async () => {
        try {
            // Clean up members list before saving:
            // 1. Split, trim, filter valid strings
            // 2. Validate against actual employee list
            const cleanForm = { ...editForm };
            if (cleanForm.assisting_personnel || cleanForm.lead_personnel) {
                // Create a Set of valid employee names for O(1) lookup
                const validNames = new Set(employees.map(e =>
                    e.name || `${e.first_name} ${e.middle_name || ''} ${e.last_name}`.trim().replace(/\s+/g, ' ')
                ));

                if (cleanForm.assisting_personnel) {
                    cleanForm.assisting_personnel = cleanForm.assisting_personnel
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s && s.toLowerCase() !== 'n/a' && validNames.has(s))
                        .join(', ');
                }

                if (cleanForm.lead_personnel) {
                    cleanForm.lead_personnel = cleanForm.lead_personnel
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s && s.toLowerCase() !== 'n/a' && validNames.has(s))
                        .join(', ');
                }
            }

            const updated = { ...cleanForm };

            updated.gaa_ps = Number(cleanForm.gaa_ps) || 0;
            updated.gaa_mooe = Number(cleanForm.gaa_mooe) || 0;
            updated.gaa_allocation = updated.gaa_ps + updated.gaa_mooe;
            updated.gms_allocation = Number(cleanForm.gms_allocation) || 0;
            updated.total_budget = updated.gaa_allocation + updated.gms_allocation;

            const savedProject = await updateProject(id, updated);
            setProject(savedProject);
            setIsEditing(false);
        } catch (err) {
            console.error(err);
            alert("Failed to update project");
        }
    };

    // Helper: Filter employees by the selected division
    const getDivisionEmployees = () => {
        if (!editForm.division) return [];
        // Find division ID by Name (since project stores Name)
        const div = divisions.find(d => d.name === editForm.division);
        if (!div) return [];
        return employees.filter(e => e.division_id === div.id);
    };

    const toggleLead = (empName) => {
        let currentLeads = editForm.lead_personnel ? editForm.lead_personnel.split(',').map(s => s.trim()) : [];
        currentLeads = currentLeads.filter(m => m && m.toLowerCase() !== 'n/a');

        if (currentLeads.includes(empName)) {
            currentLeads = currentLeads.filter(m => m !== empName);
        } else {
            currentLeads.push(empName);
        }
        setEditForm({ ...editForm, lead_personnel: currentLeads.join(', ') });
    };

    const toggleMember = (empName) => {
        let currentMembers = editForm.assisting_personnel ? editForm.assisting_personnel.split(',').map(s => s.trim()) : [];
        // Clean up garbage and empty strings
        currentMembers = currentMembers.filter(m => m && m.toLowerCase() !== 'n/a');

        if (currentMembers.includes(empName)) {
            currentMembers = currentMembers.filter(m => m !== empName);
        } else {
            currentMembers.push(empName);
        }
        setEditForm({ ...editForm, assisting_personnel: currentMembers.join(', ') });
    };

    const basecampOptions = [
        "Career Progression for DepEd Personnel",
        "Mental Health Professionals for Schools",
        "Workforce Plan and Management",
        "HROD Process Excellence",
        "Prioritization Index for Education Facilities Allocation",
        "Career Opportunities in DepEd for SHS Graduates"
    ];



    const toggleBasecamp = (option) => {
        let current = editForm.basecamp_target ? editForm.basecamp_target.split(',').map(s => s.trim()) : [];
        current = current.filter(c => c); // Clean empty

        if (current.includes(option)) {
            current = current.filter(c => c !== option);
        } else {
            current.push(option);
        }
        setEditForm({ ...editForm, basecamp_target: current.join(', ') });
    };

    const handleSubtaskToggle = async (subtask) => {
        try {
            // 1. Find the parent task (activity)
            const parentActivity = tasks.find(t => t.id === subtask.parentId);
            if (!parentActivity) return;

            // 2. Toggle status
            const newStatus = subtask.status === 'Accomplished' ? 'Pending' : 'Accomplished';

            // 3. Update the specific subtask in the array
            const updatedSubtasks = parentActivity.subtasks.map(st => {
                if (st.id === subtask.id) {
                    return { ...st, status: newStatus };
                }
                return st;
            });

            // 4. Send update to API
            await updateTask(parentActivity.id, { subtasks: updatedSubtasks });

            // 5. Refresh data (or optimistic update could be better, but this is safer)
            getProjectTasks(id).then(setTasks);
            getProjectFinancials(id).then(setFinancials);

        } catch (error) {
            console.error("Failed to toggle subtask", error);
            alert("Failed to update task status");
        }
    };

    if (!project) return <div className="p-8 flex justify-center"><Loader text="Loading project details..." /></div>;

    const filteredEmployees = getDivisionEmployees();

    // Calculate Project Metrics for Dashboard
    const calculateDashboardMetrics = () => {
        if (!project || !financials) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let pendingCount = 0;
        let accomplishedCount = 0;
        let delayedCount = 0;

        // Financial Aggregates from Activities
        let totalActivityGms = 0;
        let totalActivityObligated = 0;

        const pendingList = [];
        const accomplishedList = [];
        const delayedList = [];
        const enrichedTasks = tasks.map(t => ({
            ...t,
            project_name: project.name
        }));

        enrichedTasks.forEach(t => {
            if (t.status === 'Accomplished') {
                accomplishedCount++;
                accomplishedList.push(t);
            } else if (t.status === 'Waitlisted') {
                // Treat waitlisted as separate from pending in count if desired, 
                // OR keep it as "Pending" but just a different status. 
                // Request said "Add Waitlisted as an Activity Status option".
                // Usually it's distinct. Let's add a specific counter.
                // But for "Pending Activities" high level metric, does Waitlisted count?
                // Let's assume Waitlisted is NOT Pending, it is Waitlisted.
                // So we add a new counter.
            } else {
                // This covers Pending, In Progress, Continuing, Deferred, Cancelled?? 
                // Wait, logic above was: if Accomplished -> accomplishedCount. ELSE -> pendingCount.
                // "Pending" in dashboard likely means "Not Accomplished".
                // If I want to split it out, I need to change this logic.

                // New Logic: 
                // Accomplished -> Accomplished
                // Waitlisted -> Waitlisted (New)
                // Others (Pending, In Progress, Continuing, Deferred) -> Pending?
                // Or maybe Cancelled should be ignored?
                // Let's stick to the existing pattern but extract Waitlisted.

                if (t.status === 'Waitlisted') {
                    // Do nothing for pendingCount? Or is it still "Pending" completion?
                    // Let's treat it as a separate category to show zero if needed, 
                    // but usually dashboards sum up to total.
                    // Total = Pending + Accomplished + Delayed? No.
                    // Let's add a specific `waitlistedCount`.
                }

                pendingCount++; // Logic was: everything not accomplished is pending.
                pendingList.push(t);

                if (t.due_date && new Date(t.due_date) < today && t.status !== 'Waitlisted' && t.status !== 'Cancelled') {
                    // Only count delayed if not waitlisted/cancelled?
                    delayedCount++;
                    delayedList.push(t);
                }
            }
        });

        // RE-WRITING THE LOOP TO BE CLEARER AND ADD WAITLISTED
        // Reset counts
        pendingCount = 0;
        accomplishedCount = 0;
        delayedCount = 0;
        let waitlistedCount = 0;
        const waitlistedList = [];

        // Clear lists
        pendingList.length = 0;
        accomplishedList.length = 0;
        delayedList.length = 0;

        enrichedTasks.forEach(t => {
            if (t.status === 'Accomplished') {
                accomplishedCount++;
                accomplishedList.push(t);
            } else if (t.status === 'Waitlisted') {
                waitlistedCount++;
                waitlistedList.push(t);
                // Waitlisted might NOT be considered "Pending" in the strict sense of "To Do", 
                // it's "On Hold". But for Total Activities = Pending + Accomplished + Waitlisted?
            } else {
                // Pending, In Progress, Continuing, Deferred, Cancelled
                if (t.status !== 'Cancelled') {
                    pendingCount++;
                    pendingList.push(t);

                    if (t.due_date && new Date(t.due_date) < today) {
                        delayedCount++;
                        delayedList.push(t);
                    }
                }
            }

            // Sum Financials
            totalActivityGms += Number(t.gms_allocation) || 0;
            totalActivityObligated += Number(t.obligated_amount) || 0;
        });


        // Filter valid completed milestones
        // Filter valid completed milestones
        const completedMilestones = milestones.filter(m => ['Accomplished', 'Completed', 'Done'].includes(m.status));

        // Prepare Activity Data for Financial Breakdown
        // Map tasks to fields compatible with DashboardCharts ('name', 'total_budget', 'actual_cost')
        // Using 'gms_allocation' and 'obligated_amount' properties from task objects
        const activityFinancials = enrichedTasks.map(t => ({
            ...t,
            name: t.title, // Map title to name for the card
            total_budget: t.gms_allocation || 0,
            actual_cost: t.obligated_amount || 0
        })).sort((a, b) => b.total_budget - a.total_budget); // Sort by allocation desc

        // Mock AI Message construction based on single project
        // (If `aiRisk` exists, we can incorporate it or just let the dashboard use it if we passed it down, 
        // but DashboardCharts currently doesn't render AI risk itself, purely stats).

        return {
            totalProjects: 1,
            totalEmployees: filteredEmployees.length,
            totalActivities: tasks.length,
            pendingActivities: pendingCount,
            accomplishedActivities: accomplishedCount,
            delayedActivities: delayedCount,
            waitlistedActivities: waitlistedCount,
            totalBudget: totalActivityGms, // Use Sum of Activities
            totalSpent: totalActivityObligated, // Use Sum of Activities
            remainingBudget: totalActivityGms - totalActivityObligated,
            burnRate: totalActivityGms > 0 ? (totalActivityObligated / totalActivityGms) * 100 : 0,
            milestonesReached: completedMilestones.length,
            // Detailed Arrays
            // IMPORTANT: Passing 'activityFinancials' as 'allProjects' allows the "Total GMS Allocation" and "Obligated Funds" 
            // cards to show the breakdown of Activities (Tasks) instead of just the single project.
            allProjects: activityFinancials,
            allEmployees: filteredEmployees.map(e => ({ ...e, division_name: project.division })),
            allTasks: enrichedTasks,
            pendingTasks: pendingList,
            accomplishedTasks: accomplishedList,
            delayedTasks: delayedList,
            waitlistedTasks: waitlistedList,
            allMilestones: milestones.map(m => ({ ...m, project_name: project.name, division_name: project.division, importance: m.importance }))
        };
    };

    const dashboardMetrics = calculateDashboardMetrics();

    // Filter employees to only those in the project team
    const projectMembers = employees.filter(emp => {
        if (!project) return false;
        const name = emp.name || `${emp.first_name || ''} ${emp.middle_name || ''} ${emp.last_name || ''}`.replace(/\s+/g, ' ').trim();
        const assisting = project.assisting_personnel ? project.assisting_personnel.split(',').map(s => s.trim()) : [];
        const leads = project.lead_personnel ? project.lead_personnel.split(',').map(s => s.trim()) : [];

        return (
            leads.includes(name) ||
            name === project.supervising_officer ||
            assisting.includes(name)
        );
    });

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-4 mb-4">
                    <Link to="/projects" className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                            {project.name}
                            <span className="text-sm font-normal px-2 py-1 bg-green-100 text-green-700 rounded-full border border-green-200">
                                {project.status}
                            </span>
                        </h1>
                        <p className="text-slate-500 text-sm">Workspace ID: {project.id}</p>
                    </div>
                </div>

                <div className="flex justify-between items-center gap-2">
                    <div className="flex justify-start items-center gap-2">
                        {/* Renamed Kanban to Dashboard */}
                        <TabButton active={activeTab === 'kanban'} onClick={() => setActiveTab('kanban')} icon={Layout}>Dashboard</TabButton>
                        <TabButton active={activeTab === 'milestones'} onClick={() => setActiveTab('milestones')} icon={Target}>Milestones</TabButton>
                        <TabButton active={activeTab === 'table'} onClick={() => setActiveTab('table')} icon={Table}>Activities</TabButton>
                        <TabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={CheckSquare}>Tasks</TabButton>
                        <TabButton active={activeTab === 'spillovers'} onClick={() => setActiveTab('spillovers')} icon={Layers}>Spillovers</TabButton>
                        <TabButton active={activeTab === 'financials'} onClick={() => setActiveTab('financials')} icon={PieChart}>Financials</TabButton>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                            isSidebarOpen
                                ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 shadow-sm"
                        )}
                        title={isSidebarOpen ? "Hide Project Details" : "Show Project Details"}
                    >
                        <Layers size={16} />
                        {isSidebarOpen ? "Hide" : "Show"} Project Details
                    </button>
                </div>




            </div>


            {/* Main Content Grid */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 xl:grid-cols-4 transition-all duration-300">

                {/* Center Workspace */}
                <div className={clsx(
                    "overflow-y-auto p-6 transition-all duration-300",
                    isSidebarOpen ? "xl:col-span-3" : "xl:col-span-4"
                )}>
                    {activeTab === 'kanban' && dashboardMetrics && (
                        <div className="max-w-6xl mx-auto space-y-8">
                            <DashboardCharts metrics={dashboardMetrics} />

                            {/* Project Activity Calendar */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <CalendarView
                                    activities={tasks}
                                    title="Project Activity Calendar"
                                    onActivityClick={setEditingTask}
                                    onRangeSelect={(range) => {
                                        setInitialTaskDate(range);
                                        setIsCreatingTask(true);
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'spillovers' && (
                        <SpilloversTab
                            tasks={tasks}
                            onTaskClick={setEditingTask}
                        />
                    )}

                    {activeTab === 'table' && (
                        <div className="h-full flex flex-col">
                            <div className="flex items-center justify-between gap-2 mb-4">
                                <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1">
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={clsx("p-1.5 rounded-md transition-all", viewMode === 'table' ? "bg-white shadow text-slate-800" : "text-slate-400 hover:text-slate-600")}
                                        title="Table View"
                                    >
                                        <Table size={16} />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={clsx("p-1.5 rounded-md transition-all", viewMode === 'list' ? "bg-white shadow text-slate-800" : "text-slate-400 hover:text-slate-600")}
                                        title="List View"
                                    >
                                        <List size={16} />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('gantt')}
                                        className={clsx("p-1.5 rounded-md transition-all", viewMode === 'gantt' ? "bg-white shadow text-slate-800" : "text-slate-400 hover:text-slate-600")}
                                        title="Timeline View"
                                    >
                                        <Calendar size={16} />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('kanban')}
                                        className={clsx("p-1.5 rounded-md transition-all", viewMode === 'kanban' ? "bg-white shadow text-slate-800" : "text-slate-400 hover:text-slate-600")}
                                        title="Kanban View"
                                    >
                                        <Layout size={16} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => setIsCreatingTask(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors"
                                >
                                    <Plus size={16} /> Add Activity
                                </button>
                            </div>
                            {viewMode === 'table' && (
                                <TaskTable
                                    tasks={tasks}
                                    employees={employees}
                                    onTaskClick={setEditingTask}
                                    onTaskDeleted={handleTaskDeleted}
                                />
                            )}
                            {viewMode === 'list' && (
                                <ActivityList
                                    activities={tasks}
                                    employees={employees}
                                    onActivityClick={setEditingTask}
                                />
                            )}
                            {viewMode === 'gantt' && (
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-[600px] overflow-hidden">
                                    <GanttChart
                                        tasks={tasks}
                                        onTaskClick={(ganttTask) => {
                                            const originalTask = tasks.find(t => t.id === ganttTask.id);
                                            if (originalTask) setEditingTask(originalTask);
                                        }}
                                    />
                                </div>
                            )}
                            {viewMode === 'kanban' && (
                                <div className="h-full">
                                    <KanbanBoard
                                        tasks={tasks}
                                        members={employees}
                                        onTaskUpdate={handleTaskUpdate}
                                        onTaskClick={setEditingTask}
                                        onAddTask={() => setIsCreatingTask(true)}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'tasks' && (
                        <div className="h-full flex flex-col">
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={() => setShowCreateSubtask(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors"
                                >
                                    <Plus size={16} /> Add Task
                                </button>
                            </div>
                            <SubtaskTable
                                activities={tasks}
                                employees={employees}
                                onSubtaskClick={setEditingSubtask}
                                onToggleStatus={handleSubtaskToggle}
                                onSubtaskDeleted={handleTaskDeleted}
                            />
                        </div>
                    )}

                    {/* Old Gantt tab location removed */}

                    {activeTab === 'milestones' && (
                        <MilestonesTab projectId={id} activities={dashboardMetrics?.allTasks || []} />
                    )}

                    {activeTab === 'financials' && financials && (
                        <div className="max-w-4xl">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Project Financials</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total GMS Allocation</h3>
                                    <p className="text-3xl font-bold text-slate-800 tracking-tight mt-1">
                                        ₱{dashboardMetrics?.totalBudget?.toLocaleString() || '0'}
                                    </p>
                                </div>
                                <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Obligated Funds</h3>
                                    <p className="text-3xl font-bold text-slate-800 tracking-tight mt-1">
                                        ₱{dashboardMetrics?.totalSpent?.toLocaleString() || '0'}
                                    </p>
                                </div>
                                <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Remaining Budget</h3>
                                    <p className={`text-3xl font-bold tracking-tight mt-1 ${(dashboardMetrics?.remainingBudget || 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        ₱{dashboardMetrics?.remainingBudget?.toLocaleString() || '0'}
                                    </p>
                                </div>
                                <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Utilization Rate</h3>
                                    <p className="text-3xl font-bold text-orange-500 tracking-tight">
                                        {dashboardMetrics?.burnRate?.toFixed(1) || 0}%
                                    </p>
                                    <p className="text-xs text-slate-400 mt-2">Percentage of budget used.</p>
                                </div>
                            </div>
                        </div>
                    )}


                </div>

                {/* Right Sidebar - Project Details */}
                {!isSidebarOpen ? (
                    <div className="border-l border-slate-200 bg-white w-12 flex flex-col items-center justify-end py-6 transition-all duration-300">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 mb-4"
                            title="Expand Sidebar"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="writing-vertical-lr transform rotate-180 text-slate-400 font-bold tracking-wider text-xs whitespace-nowrap">
                            PROJECT DETAILS
                        </div>
                    </div>
                ) : (
                    <div className="border-l border-slate-200 bg-white p-6 overflow-y-auto xl:col-span-1 transition-all duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Layers size={18} /> Project Details
                            </h3>
                            {!isEditing ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsSidebarOpen(false)}
                                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                                        title="Minimize Sidebar"
                                    >
                                        <ArrowLeft className="rotate-180" size={16} />
                                    </button>
                                    <button onClick={() => setIsEditing(true)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                                        <Edit2 size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={handleSaveProject} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                                        <Save size={16} />
                                    </button>
                                    <button onClick={() => { setIsEditing(false); setEditForm(project); }} className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            {isEditing && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Project Name</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                                        value={editForm.name || ''}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Program</label>
                                {isEditing ? (
                                    <select
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editForm.program_id || ''}
                                        onChange={e => setEditForm({ ...editForm, program_id: e.target.value })}
                                    >
                                        <option value="">Select Program</option>
                                        {programs
                                            .filter(p => !p.division || p.division === editForm.division)
                                            .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                ) : (
                                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="text-sm font-medium text-blue-800">
                                            {project.program_id ? programs.find(p => p.id === project.program_id)?.name || "Unknown Program" : "No Program Assigned"}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Description</label>
                                {isEditing ? (
                                    <textarea
                                        className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        rows="4"
                                        value={editForm.description}
                                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                    />
                                ) : (
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        {project.description || "No description provided."}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Division</label>
                                {isEditing ? (
                                    <select
                                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                                        value={editForm.division}
                                        onChange={e => setEditForm({ ...editForm, division: e.target.value })}
                                    >
                                        <option value="">Select Division</option>
                                        {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                    </select>
                                ) : (
                                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="text-sm font-medium text-slate-700">{project.division}</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Project Funding</label>
                                {isEditing ? (
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                                        <div className="flex flex-wrap gap-4 mb-3">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                    checked={fundingSources.gaaPs}
                                                    onChange={e => {
                                                        const checked = e.target.checked;
                                                        setFundingSources(prev => ({ ...prev, gaaPs: checked }));
                                                        if (!checked) setEditForm(prev => ({ ...prev, gaa_ps: 0 }));
                                                    }}
                                                />
                                                <span className="text-sm font-medium text-slate-700">GAA-PS</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                    checked={fundingSources.gaaMooe}
                                                    onChange={e => {
                                                        const checked = e.target.checked;
                                                        setFundingSources(prev => ({ ...prev, gaaMooe: checked }));
                                                        if (!checked) setEditForm(prev => ({ ...prev, gaa_mooe: 0 }));
                                                    }}
                                                />
                                                <span className="text-sm font-medium text-slate-700">GAA-MOOE</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="rounded text-blue-600 focus:ring-blue-500"
                                                    checked={fundingSources.gms}
                                                    onChange={e => {
                                                        const checked = e.target.checked;
                                                        setFundingSources(prev => ({ ...prev, gms: checked }));
                                                        if (!checked) setEditForm(prev => ({ ...prev, gms_allocation: 0 }));
                                                    }}
                                                />
                                                <span className="text-sm font-medium text-slate-700">GMS</span>
                                            </label>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {fundingSources.gaaPs && (
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">GAA-PS Allocation (₱)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className="w-full border border-slate-300 rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                        value={editForm.gaa_ps || ''}
                                                        onChange={e => setEditForm({ ...editForm, gaa_ps: e.target.value })}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            )}
                                            {fundingSources.gaaMooe && (
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">GAA-MOOE Allocation (₱)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className="w-full border border-slate-300 rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                        value={editForm.gaa_mooe || ''}
                                                        onChange={e => setEditForm({ ...editForm, gaa_mooe: e.target.value })}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            )}
                                            {fundingSources.gms && (
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">GMS Allocation (₱)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className="w-full border border-slate-300 rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                        value={editForm.gms_allocation || ''}
                                                        onChange={e => setEditForm({ ...editForm, gms_allocation: e.target.value })}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right text-xs font-bold text-slate-700 border-t border-slate-200 pt-2">
                                            Total: ₱{((Number(editForm.gaa_ps) || 0) + (Number(editForm.gaa_mooe) || 0) + (Number(editForm.gms_allocation) || 0)).toLocaleString()}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {(Number(project.gaa_allocation) > 0 || Number(project.gms_allocation) > 0) ? (
                                            <div className="text-sm space-y-1">
                                                {Number(project.gaa_ps) > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">GAA-PS:</span>
                                                        <span className="font-mono text-slate-700 font-medium">₱{Number(project.gaa_ps).toLocaleString()}</span>
                                                    </div>
                                                )}
                                                {Number(project.gaa_mooe) > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">GAA-MOOE:</span>
                                                        <span className="font-mono text-slate-700 font-medium">₱{Number(project.gaa_mooe).toLocaleString()}</span>
                                                    </div>
                                                )}
                                                {/* Fallback for old GAA allocation if specific split is missing but total exists */}
                                                {(Number(project.gaa_allocation) > 0 && Number(project.gaa_ps) === 0 && Number(project.gaa_mooe) === 0) && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">GAA (Total):</span>
                                                        <span className="font-mono text-slate-700 font-medium">₱{Number(project.gaa_allocation).toLocaleString()}</span>
                                                    </div>
                                                )}
                                                {Number(project.gms_allocation) > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">GMS:</span>
                                                        <span className="font-mono text-slate-700 font-medium">₱{Number(project.gms_allocation).toLocaleString()}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between border-t border-slate-100 pt-1 mt-1 font-bold">
                                                    <span className="text-slate-800">Total:</span>
                                                    <span className="font-mono text-slate-800">₱{Number(project.total_budget || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-slate-800">
                                                    ₱{Number(project.total_budget || 0).toLocaleString()}
                                                </p>
                                                <p className="text-xs text-slate-400 italic">No specific source breakdown</p>
                                            </div>
                                        )}

                                        {/* Activity Rollup comparison */}
                                        <div className="pt-2 mt-2 border-t border-slate-100">
                                            <p className="text-xs text-slate-400">Allocated to Activities:</p>
                                            <p className="text-sm font-bold text-blue-600">
                                                ₱{Number(financials?.total_gms_allocation || financials?.total_budget || 0).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Users size={18} /> Team
                                </h4>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Lead Personnel</label>
                                        {isEditing ? (
                                            <div className="border border-slate-300 rounded-lg p-2 max-h-40 overflow-y-auto space-y-2">
                                                {filteredEmployees.length === 0 && <span className="text-xs text-slate-400">No employees found in this division.</span>}
                                                {filteredEmployees.map(e => {
                                                    const name = e.name || `${e.first_name} ${e.middle_name || ''} ${e.last_name}`;
                                                    const isSelected = editForm.lead_personnel?.includes(name);
                                                    return (
                                                        <div key={e.id} onClick={() => toggleLead(name)} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                                                            {isSelected ?
                                                                <CheckSquare size={16} className="text-blue-600" /> :
                                                                <Square size={16} className="text-slate-300" />
                                                            }
                                                            <span className={clsx("text-sm select-none", isSelected ? "text-slate-900 font-medium" : "text-slate-500")}>
                                                                {name}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-600 leading-relaxed">{project.lead_personnel}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Supervising Officer</label>
                                        {isEditing ? (
                                            <select
                                                className="w-full border border-slate-300 rounded p-2 text-sm"
                                                value={editForm.supervising_officer}
                                                onChange={e => setEditForm({ ...editForm, supervising_officer: e.target.value })}
                                            >
                                                <option value="">Select Supervisor</option>
                                                {filteredEmployees.map(e => {
                                                    const name = e.name || `${e.first_name} ${e.middle_name || ''} ${e.last_name}`;
                                                    return <option key={e.id} value={name}>{name}</option>
                                                })}
                                            </select>
                                        ) : (
                                            <p className="text-sm font-medium text-slate-800">{project.supervising_officer}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Members</label>
                                        {isEditing ? (
                                            <div className="border border-slate-300 rounded-lg p-2 max-h-40 overflow-y-auto space-y-2">
                                                {filteredEmployees.length === 0 && <span className="text-xs text-slate-400">No employees found in this division.</span>}
                                                {filteredEmployees.map(e => {
                                                    const name = e.name || `${e.first_name} ${e.middle_name || ''} ${e.last_name}`;
                                                    const isSelected = editForm.assisting_personnel?.includes(name);
                                                    return (
                                                        <div key={e.id} onClick={() => toggleMember(name)} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                                                            {isSelected ?
                                                                <CheckSquare size={16} className="text-blue-600" /> :
                                                                <Square size={16} className="text-slate-300" />
                                                            }
                                                            <span className={clsx("text-sm select-none", isSelected ? "text-slate-900 font-medium" : "text-slate-500")}>
                                                                {name}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-600 leading-relaxed">{project.assisting_personnel}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Basecamp Target</label>
                                {isEditing ? (
                                    <div className="border border-slate-300 rounded-lg p-2 max-h-60 overflow-y-auto space-y-2">
                                        {basecampOptions.map((option, idx) => {
                                            const isSelected = editForm.basecamp_target?.split(',').map(s => s.trim()).includes(option);
                                            return (
                                                <div key={idx} onClick={() => toggleBasecamp(option)} className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                                                    {isSelected ?
                                                        <CheckSquare size={16} className="text-blue-600 mt-0.5 flex-shrink-0" /> :
                                                        <Square size={16} className="text-slate-300 mt-0.5 flex-shrink-0" />
                                                    }
                                                    <span className={clsx("text-sm select-none leading-tight", isSelected ? "text-slate-900 font-medium" : "text-slate-500")}>
                                                        {option}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        {/* Others Option */}
                                        <div
                                            className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded"
                                            onClick={() => {
                                                let current = editForm.basecamp_target ? editForm.basecamp_target.split(',').map(s => s.trim()).filter(Boolean) : [];
                                                // Check if any custom value exists
                                                const hasCustom = current.some(opt => !basecampOptions.includes(opt));

                                                if (hasCustom) {
                                                    // Remove custom
                                                    current = current.filter(opt => basecampOptions.includes(opt));
                                                } else {
                                                    // Add placeholder
                                                    current.push("Others: ");
                                                }
                                                setEditForm({ ...editForm, basecamp_target: current.join(', ') });
                                            }}
                                        >
                                            {(editForm.basecamp_target?.split(',').map(s => s.trim()).some(opt => opt && !basecampOptions.includes(opt))) ?
                                                <CheckSquare size={16} className="text-blue-600 mt-0.5 flex-shrink-0" /> :
                                                <Square size={16} className="text-slate-300 mt-0.5 flex-shrink-0" />
                                            }
                                            <span className="text-sm select-none leading-tight text-slate-500">
                                                Others
                                            </span>
                                        </div>
                                        {/* Input for Others */}
                                        {(editForm.basecamp_target?.split(',').map(s => s.trim()).some(opt => opt && !basecampOptions.includes(opt))) && (
                                            <input
                                                type="text"
                                                className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm outline-none focus:border-blue-500"
                                                placeholder="Specify other target..."
                                                value={editForm.basecamp_target.split(',').map(s => s.trim()).find(opt => !basecampOptions.includes(opt))?.replace("Others: ", "") || ""}
                                                onChange={(e) => {
                                                    const customVal = "Others: " + e.target.value;
                                                    let current = editForm.basecamp_target.split(',').map(s => s.trim()).filter(Boolean);
                                                    // Remove old custom and add new
                                                    current = current.filter(opt => basecampOptions.includes(opt));
                                                    current.push(customVal);
                                                    setEditForm({ ...editForm, basecamp_target: current.join(', ') });
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {project.basecamp_target ? (
                                            project.basecamp_target.split(',').map((target, i) => (
                                                <div key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1.5 rounded-md border border-blue-100 font-medium leading-snug">
                                                    {target.trim()}
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-slate-400 italic">No targets selected</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {
                (editingTask || isCreatingTask) && (
                    <CreateTaskModal
                        projectId={id}
                        task={editingTask}
                        members={projectMembers}
                        milestones={milestones} // Pass milestones
                        onClose={() => {
                            setEditingTask(null);
                            setIsCreatingTask(false);
                            setInitialTaskDate(null);
                        }}
                        initialDate={initialTaskDate}
                        onCreated={() => {
                            setEditingTask(null);
                            setIsCreatingTask(false);
                            setInitialTaskDate(null);
                            getProjectTasks(id).then(setTasks);
                            getProjectFinancials(id).then(setFinancials);
                        }}
                    />
                )
            }
            {
                editingSubtask && (
                    <EditSubtaskModal
                        subtask={editingSubtask}
                        parentId={editingSubtask.parentId}
                        parentTask={editingSubtask.parentTask}
                        members={projectMembers}
                        onClose={() => setEditingSubtask(null)}
                        onUpdate={() => {
                            getProjectTasks(id).then(setTasks);
                            getProjectFinancials(id).then(setFinancials);
                        }}
                    />
                )
            }
            {
                showCreateSubtask && (
                    <CreateSubtaskModal
                        activities={tasks}
                        members={projectMembers}
                        onClose={() => setShowCreateSubtask(false)}
                        onCreate={() => {
                            getProjectTasks(id).then(setTasks);
                            getProjectFinancials(id).then(setFinancials);
                        }}
                    />
                )
            }
        </div >
    );
};


export default ProjectDetails;
