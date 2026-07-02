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
    updateProject, getDivisions, getEmployees, getActivityLogs
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
import { useToast } from '../components/ToastContext';


const getDivisionDotColor = (divisionName) => {
    const name = (divisionName || '').toLowerCase();
    if (name.includes('personnel')) return 'bg-blue-500';
    if (name.includes('employee welfare')) return 'bg-purple-500';
    if (name.includes('human resource') || name.includes('hrod')) return 'bg-emerald-500';
    if (name.includes('school effectiveness')) return 'bg-amber-500';
    if (name.includes('organization effectiveness')) return 'bg-rose-500';
    if (name.includes('education')) return 'bg-sky-500';
    return 'bg-slate-500';
};

const getDivisionStyles = (divisionName) => {
    const name = (divisionName || '').toLowerCase();
    if (name.includes('personnel')) return 'division-badge division-personnel';
    if (name.includes('employee welfare')) return 'division-badge division-welfare';
    if (name.includes('human resource') || name.includes('hrod')) return 'division-badge division-hrod';
    if (name.includes('school effectiveness')) return 'division-badge division-school-eff';
    if (name.includes('organization effectiveness')) return 'division-badge division-org-eff';
    if (name.includes('education')) return 'division-badge division-education';
    return 'division-badge division-default';
};

const TabButton = ({ active, children, onClick, icon: Icon }) => (
    <button
        onClick={onClick}
        className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all border-2",
            active
                ? "bg-[#075985] text-white border-[#075985] shadow-sm"
                : "bg-white text-[#64748B] border-[#BAE6FD] hover:text-[#08315F] hover:bg-sky-50 shadow-sm"
        )}
    >
        <Icon size={16} />
        {children}
    </button>
);

const ProjectDetails = () => {
    const { showToast } = useToast();
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [milestones, setMilestones] = useState([]); // Added milestones state
    const [financials, setFinancials] = useState(null);
    const [activeTab, setActiveTab] = useState('kanban');
    const [activityLogs, setActivityLogs] = useState([]);
    const [viewMode, setViewMode] = useState('table'); // 'table', 'list', 'gantt', 'kanban'
    const [aiRisk, setAiRisk] = useState(null);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [selectedFundingSource, setSelectedFundingSource] = useState('');
    const [allocationAmount, setAllocationAmount] = useState('');
    const [editingTask, setEditingTask] = useState(null); // For Task Modal

    const [isCreatingTask, setIsCreatingTask] = useState(false); // For Creating New Task
    const [showCreateSubtask, setShowCreateSubtask] = useState(false); // For New Subtask Modal
    const [editingSubtask, setEditingSubtask] = useState(null); // For Subtask Modal
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Sidebar State
    const [initialTaskDate, setInitialTaskDate] = useState(null); // Initial Date for New Task

    // Dropdown Data
    const [divisions, setDivisions] = useState([]);
    const [employees, setEmployees] = useState([]);

    const [leadSearch, setLeadSearch] = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const [supervisorSearch, setSupervisorSearch] = useState('');

    useEffect(() => {
        // Load initial data
        Promise.all([
            getProjects(),
            getProjectTasks(id),
            getProjectFinancials(id),
            getProjectMilestones(id), // Fetch Milestones
            getDivisions(),
            getEmployees(),
            getActivityLogs(id) // Fetch project-specific logs
        ]).then(([projects, tasks, fin, ms, divs, emps, logs]) => {
            const p = projects.find(p => p.id === id);
            setProject(p);
            setTasks(tasks);
            setFinancials(fin);
            setMilestones(ms); // Set Milestones
            setDivisions(divs);
            setEmployees(emps);
            setActivityLogs(logs);

            // Init Edit Form
            if (p) {
                setEditForm({
                    ...p
                });
            }

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
            getActivityLogs(id).then(setActivityLogs); // Refresh activity logs
        });

        return () => socket.disconnect();
    }, [id]);

    useEffect(() => {
        if (isEditing && project) {
            setSelectedFundingSource(project.source_of_fund || '');
            setAllocationAmount(project.sof_allocation ? String(project.sof_allocation) : (project.total_budget ? String(project.total_budget) : ''));
        }
    }, [isEditing, project]);

    const handleTaskUpdate = (task) => {
        setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    };

    const handleTaskDeleted = () => {
        getProjectTasks(id).then(setTasks);
        getProjectFinancials(id).then(setFinancials);
        getActivityLogs(id).then(setActivityLogs);
    };

    const startEditProject = () => {
        if (project) {
            setEditForm({ ...project });
        }
        setIsEditing(true);
        setIsSidebarOpen(true);
    };

    const handleSaveProject = async () => {
        try {
            // Validation Checks to ensure complete detail
            if (!editForm.name || !editForm.name.trim()) {
                showToast("Project Name is required.", "warning");
                return;
            }
            if (!editForm.description || !editForm.description.trim()) {
                showToast("Description is required.", "warning");
                return;
            }
            if (!editForm.division) {
                showToast("Division is required.", "warning");
                return;
            }
            if (!selectedFundingSource) {
                showToast("Source of Fund is required.", "warning");
                return;
            }
            if (allocationAmount === '' || Number(allocationAmount) < 0) {
                showToast("Allocation Amount is required and must be 0 or greater.", "warning");
                return;
            }
            if (!editForm.expenditure_framework) {
                showToast("Expenditure Framework is required.", "warning");
                return;
            }
            if (!editForm.lead_personnel || !editForm.lead_personnel.split(',').map(s => s.trim()).filter(Boolean).length) {
                showToast("At least one Lead Personnel is required.", "warning");
                return;
            }
            if (!editForm.supervising_officer || !editForm.supervising_officer.split(',').map(s => s.trim()).filter(Boolean).length) {
                showToast("At least one Supervising Officer is required.", "warning");
                return;
            }
            if (!editForm.assisting_personnel || !editForm.assisting_personnel.split(',').map(s => s.trim()).filter(Boolean).length) {
                showToast("At least one Assisting Personnel is required.", "warning");
                return;
            }
            if (!editForm.basecamp_target || !editForm.basecamp_target.split(',').map(s => s.trim()).filter(Boolean).length) {
                showToast("At least one Basecamp Target is required.", "warning");
                return;
            }

            const basecampTargets = editForm.basecamp_target.split(',').map(s => s.trim());
            const customTarget = basecampTargets.find(opt => opt.startsWith("Others:") || opt.startsWith("Others"));
            if (customTarget !== undefined) {
                const specifiedText = customTarget.replace(/^Others:\s*/i, '').trim();
                if (!specifiedText) {
                    showToast("Please specify the custom Basecamp target in the 'Others' section.", "warning");
                    return;
                }
            }

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

            const cleanedBasecamp = basecampTargets.map(opt => {
                if (opt.startsWith("Others:") || opt.startsWith("Others")) {
                    const cleanedVal = opt.replace(/^Others:\s*/i, '').trim();
                    return `Others: ${cleanedVal}`;
                }
                return opt;
            });

            const updated = { ...cleanForm };
            updated.basecamp_target = cleanedBasecamp.join(', ');

            const amount = Number(allocationAmount) || 0;
            updated.source_of_fund = selectedFundingSource;
            updated.sof_allocation = amount;
            updated.total_budget = amount;

            const savedProject = await updateProject(id, updated);
            showToast("Project updated successfully!", "success");
            setProject(savedProject);
            setIsEditing(false);
        } catch (err) {
            console.error(err);
            showToast("Failed to update project", "error");
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

    const toggleSupervisor = (empName) => {
        let currentSups = editForm.supervising_officer ? editForm.supervising_officer.split(',').map(s => s.trim()) : [];
        currentSups = currentSups.filter(m => m && m.toLowerCase() !== 'n/a');

        if (currentSups.includes(empName)) {
            currentSups = currentSups.filter(m => m !== empName);
        } else {
            currentSups.push(empName);
        }
        setEditForm({ ...editForm, supervising_officer: currentSups.join(', ') });
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

    const searchFilteredLeads = filteredEmployees.filter(e => {
        const name = e.name || `${e.first_name} ${e.middle_name || ''} ${e.last_name}`;
        return name.toLowerCase().includes(leadSearch.toLowerCase()) ||
               (e.position && e.position.toLowerCase().includes(leadSearch.toLowerCase()));
    });

    const searchFilteredMembers = filteredEmployees.filter(e => {
        const name = e.name || `${e.first_name} ${e.middle_name || ''} ${e.last_name}`;
        return name.toLowerCase().includes(memberSearch.toLowerCase()) ||
               (e.position && e.position.toLowerCase().includes(memberSearch.toLowerCase()));
    });

    const searchFilteredSupervisors = filteredEmployees.filter(e => {
        const name = e.name || `${e.first_name} ${e.middle_name || ''} ${e.last_name}`;
        return name.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
               (e.position && e.position.toLowerCase().includes(supervisorSearch.toLowerCase()));
    });

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
            const isAccomplished = t.status === 'Accomplished' || t.status === 'Completed' || t.status === 'Done';
            const isOverdue = t.due_date && new Date(t.due_date) < today;

            if (isAccomplished) {
                accomplishedCount++;
                accomplishedList.push(t);
            } else if (t.status === 'Waitlisted') {
                waitlistedCount++;
                waitlistedList.push(t);
            } else {
                // Pending, In Progress, Continuing, Deferred, Cancelled, Delayed
                if (t.status !== 'Cancelled') {
                    if (t.status === 'Delayed' || isOverdue) {
                        delayedCount++;
                        delayedList.push(t);
                    } else {
                        pendingCount++;
                        pendingList.push(t);
                    }
                }
            }

            // Sum Financials (with fallback to legacy 'budget' and 'cost' fields)
            totalActivityGms += Number(t.allocation || t.gms_allocation || t.budget) || 0;
            totalActivityObligated += Number(t.obligated_amount || t.cost) || 0;
        });


        // Filter valid completed milestones
        // Filter valid completed milestones
        const completedMilestones = milestones.filter(m => ['Accomplished', 'Completed', 'Done'].includes(m.status));

        // Prepare Activity Data for Financial Breakdown
        // Map tasks to fields compatible with DashboardCharts ('name', 'total_budget', 'actual_cost')
        // Using 'allocation' and 'obligated_amount' properties from task objects
        const activityFinancials = enrichedTasks.map(t => ({
            ...t,
            name: t.title, // Map title to name for the card
            total_budget: t.allocation || t.gms_allocation || t.budget || 0,
            actual_cost: t.obligated_amount || t.cost || 0
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
            totalBudget: Number(project.sof_allocation || project.total_budget) || totalActivityGms,
            totalSpent: totalActivityObligated,
            remainingBudget: (Number(project.sof_allocation || project.total_budget) || totalActivityGms) - totalActivityObligated,
            burnRate: (Number(project.sof_allocation || project.total_budget) || totalActivityGms) > 0 ? (totalActivityObligated / (Number(project.sof_allocation || project.total_budget) || totalActivityGms)) * 100 : 0,
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
            allMilestones: milestones.map(m => ({ ...m, project_name: project.name, division_name: project.division }))
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

                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                    <div className="flex justify-start items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none whitespace-nowrap -mx-6 px-6 md:mx-0 md:px-0">
                        {/* Renamed Kanban to Dashboard */}
                        <TabButton active={activeTab === 'kanban'} onClick={() => setActiveTab('kanban')} icon={Layout}>Dashboard</TabButton>
                        <TabButton active={activeTab === 'milestones'} onClick={() => setActiveTab('milestones')} icon={Target}>Milestones</TabButton>
                        <TabButton active={activeTab === 'table'} onClick={() => setActiveTab('table')} icon={Table}>Activities</TabButton>
                        <TabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={CheckSquare}>Tasks</TabButton>
                        <TabButton active={activeTab === 'spillovers'} onClick={() => setActiveTab('spillovers')} icon={Layers}>Spillovers</TabButton>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className={clsx(
                            "flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border w-full md:w-auto",
                            isSidebarOpen
                                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm font-semibold"
                                : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 shadow-sm font-semibold"
                        )}
                        title={isSidebarOpen ? "Hide Project Details" : "Show Project Details"}
                    >
                        <Layers size={16} />
                        {isSidebarOpen ? "Hide" : "Show"} Project Details
                    </button>
                </div>




            </div>


            {/* Main Content Flex Layout */}
            <div className="flex-1 overflow-hidden flex flex-row transition-all duration-300">

                {/* Center Workspace */}
                <div className="flex-1 overflow-y-auto p-6 transition-all duration-300">
                    {activeTab === 'kanban' && dashboardMetrics && (
                        <div className="w-full space-y-8">
                            {/* Grid row: Dashboard Charts on the left (2/4 width), Activity Log (1/4 width) beside Activity Overview (1/4 width) */}
                            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
                                <div className="xl:col-span-2">
                                    <DashboardCharts metrics={dashboardMetrics} />
                                </div>
                                
                                {/* Project Activity Log Card */}
                                <div className="xl:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[610px]">
                                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                                        <Activity size={16} className="text-blue-500 animate-pulse" />
                                        Project Activity Log
                                    </h3>
                                    <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                                        {activityLogs.length === 0 ? (
                                            <div className="h-full flex flex-col justify-center items-center text-slate-400">
                                                <Activity size={36} className="text-slate-200 mb-2 animate-bounce" />
                                                <p className="text-xs">No activity logs recorded yet.</p>
                                            </div>
                                        ) : (
                                            activityLogs.slice(0, 15).map((log) => (
                                                <div key={log.id} className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-100 flex flex-col gap-1 transition-all duration-200">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-slate-700 text-xs">{log.username}</span>
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            {new Date(log.timestamp).toLocaleString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 my-0.5">
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                            log.action.includes('create') 
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                                : log.action.includes('update') 
                                                                    ? 'bg-blue-50 text-blue-700 border-blue-100' 
                                                                    : 'bg-red-50 text-red-700 border-red-100'
                                                        }`}>
                                                            {log.action}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400">{log.resource}</span>
                                                    </div>
                                                    <p className="text-slate-600 text-xs font-medium leading-relaxed">{log.details}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Activity Overview Card */}
                                <div className="xl:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[610px]">
                                    <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                            <CheckSquare size={16} className="text-blue-500" />
                                            Activity Overview
                                        </h3>
                                    </div>

                                    <div className="flex-1 overflow-y-auto pr-1">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                                                    <th className="px-3 py-2">Activity Name</th>
                                                    <th className="px-3 py-2">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                            {(() => {
                                                const delayedTasks = tasks.filter(task => {
                                                    const isCompleted = task.status && ['accomplished', 'completed', 'done'].includes(task.status.toLowerCase());
                                                    const isOverdue = !isCompleted && task.due_date && new Date(task.due_date).setHours(0,0,0,0) < new Date().setHours(0,0,0,0);
                                                    const displayStatus = isOverdue ? 'Delayed' : (task.status || 'Pending');
                                                    return displayStatus.toLowerCase() === 'delayed';
                                                });

                                                if (delayedTasks.length === 0) {
                                                    return (
                                                        <tr>
                                                            <td colSpan="2" className="px-3 py-8 text-center text-slate-400 font-medium">
                                                                No delayed activities in this project.
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                return delayedTasks.map((task) => {
                                                    return (
                                                        <tr 
                                                            key={task.id} 
                                                            onClick={() => setEditingTask(task)}
                                                            className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                                                        >
                                                            <td className="px-3 py-2 font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                                                                    {task.title}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-50 text-red-700 border-red-100">
                                                                    Delayed
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Project Activity Calendar (Full width below) */}
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
                                    milestones={milestones}
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






                </div>

                {/* Floating Project Details Modal */}
                {isSidebarOpen && (
                    <>
                        <div 
                            className="fixed inset-0 bg-black/40 z-40 animate-fade-in backdrop-blur-sm"
                            onClick={() => setIsSidebarOpen(false)}
                        />
                        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-lg max-h-[85vh] bg-white border border-slate-200 p-6 overflow-y-auto shadow-2xl rounded-xl transition-all duration-300 flex-shrink-0">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Layers size={18} /> Project Details
                                </h3>
                                <button
                                    onClick={() => setIsSidebarOpen(false)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                                    title="Close"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                        <div className="space-y-6">
                            {isEditing && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Project Name<span className="text-red-500"> *</span></label>
                                        <input
                                            type="text"
                                            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                                            value={editForm.name || ''}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Project Status<span className="text-red-500"> *</span></label>
                                        <select
                                            className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800 bg-white"
                                            value={editForm.status || 'Planning'}
                                            onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                                        >
                                            <option value="Planning">Planning</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Accomplished">Accomplished</option>
                                            <option value="Deferred">Deferred</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Description{isEditing && <span className="text-red-500"> *</span>}</label>
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
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Division{isEditing && <span className="text-red-500"> *</span>}</label>
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
                                    <div className={`flex items-center gap-2 p-3 rounded-lg border ${getDivisionStyles(project.division)}`}>
                                        <div className={`w-2 h-2 rounded-full ${getDivisionDotColor(project.division)}`}></div>
                                        <span className="text-sm font-medium">{project.division || 'No Division'}</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Project Funding{isEditing && <span className="text-red-500"> *</span>}</label>
                                {isEditing ? (
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Source of Fund<span className="text-red-500"> *</span></label>
                                            <select
                                                required
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                                                value={selectedFundingSource}
                                                onChange={e => setSelectedFundingSource(e.target.value)}
                                            >
                                                <option value="">Select Source of Fund</option>
                                                <option value="GAA-PS">GAA-PS</option>
                                                <option value="GAA-MOOE">GAA-MOOE</option>
                                                <option value="GMS">GMS</option>
                                                <option value="APB">APB</option>
                                                <option value="HRD">HRD</option>
                                                <option value="HRDP">HRDP</option>
                                                <option value="Basic Education Inputs Program">Basic Education Inputs Program</option>
                                            </select>
                                        </div>

                                        {selectedFundingSource && (
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">{selectedFundingSource} Allocation (₱)<span className="text-red-500"> *</span></label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    required
                                                    className="w-full border border-slate-300 rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="0.00"
                                                    value={allocationAmount}
                                                    onChange={e => setAllocationAmount(e.target.value)}
                                                />
                                            </div>
                                        )}

                                        {selectedFundingSource && (
                                            <div className="text-right text-xs font-bold text-slate-700 border-t border-slate-200 pt-2">
                                                Total: ₱{(Number(allocationAmount) || 0).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {project.source_of_fund ? (
                                            <div className="text-sm space-y-1">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Source of Fund:</span>
                                                    <span className="text-slate-700 font-medium">{project.source_of_fund}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">SOF Allocation:</span>
                                                    <span className="font-mono text-slate-700 font-medium">₱{Number(project.sof_allocation || project.total_budget || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between border-t border-slate-100 pt-1 mt-1 font-bold">
                                                    <span className="text-slate-800">Total Budget:</span>
                                                    <span className="font-mono text-slate-800">₱{Number(project.total_budget || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-slate-800">
                                                    ₱{Number(project.total_budget || 0).toLocaleString()}
                                                </p>
                                                <p className="text-xs text-slate-400 italic">No source of fund specified</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Expenditure Framework{isEditing && <span className="text-red-500"> *</span>}</label>
                                {isEditing ? (
                                    <div className="flex gap-4 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="expenditure_framework_edit"
                                                value="PREXC"
                                                checked={editForm.expenditure_framework === 'PREXC'}
                                                onChange={e => setEditForm({ ...editForm, expenditure_framework: e.target.value })}
                                                className="text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-slate-700 font-medium">PREXC</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="expenditure_framework_edit"
                                                value="WFP"
                                                checked={editForm.expenditure_framework === 'WFP'}
                                                onChange={e => setEditForm({ ...editForm, expenditure_framework: e.target.value })}
                                                className="text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-slate-700 font-medium">WFP</span>
                                        </label>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 font-normal">
                                        <span className="text-sm font-semibold text-slate-700">
                                            {project.expenditure_framework || "Not Specified"}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Users size={18} /> Team
                                </h4>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Lead Personnel{isEditing && <span className="text-red-500"> *</span>}</label>
                                        {isEditing ? (
                                            <div className="border border-slate-300 rounded-lg p-2 bg-white space-y-2">
                                                {filteredEmployees.length > 0 && (
                                                    <input
                                                        type="text"
                                                        placeholder="Search lead personnel..."
                                                        value={leadSearch}
                                                        onChange={e => setLeadSearch(e.target.value)}
                                                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none font-normal"
                                                    />
                                                )}
                                                <div className="max-h-32 overflow-y-auto space-y-1">
                                                    {filteredEmployees.length === 0 ? (
                                                        <span className="text-xs text-slate-400">No employees found in this division.</span>
                                                    ) : searchFilteredLeads.length === 0 ? (
                                                        <span className="text-xs text-slate-400">No matching employees found.</span>
                                                    ) : searchFilteredLeads.map(e => {
                                                        const name = e.name || `${e.first_name} ${e.middle_name || ''} ${e.last_name}`;
                                                        const isSelected = editForm.lead_personnel?.includes(name);
                                                        return (
                                                            <div key={e.id} onClick={() => toggleLead(name)} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 p-1 rounded">
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
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-600 leading-relaxed">{project.lead_personnel}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Supervising Officer{isEditing && <span className="text-red-500"> *</span>}</label>
                                        {isEditing ? (
                                            <div className="border border-slate-300 rounded-lg p-2 bg-white space-y-2">
                                                {filteredEmployees.length > 0 && (
                                                    <input
                                                        type="text"
                                                        placeholder="Search supervising officer..."
                                                        value={supervisorSearch}
                                                        onChange={e => setSupervisorSearch(e.target.value)}
                                                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none font-normal"
                                                    />
                                                )}
                                                <div className="max-h-32 overflow-y-auto space-y-1">
                                                    {filteredEmployees.length === 0 ? (
                                                        <span className="text-xs text-slate-400">No employees found in this division.</span>
                                                    ) : searchFilteredSupervisors.length === 0 ? (
                                                        <span className="text-xs text-slate-400">No matching employees found.</span>
                                                    ) : searchFilteredSupervisors.map(e => {
                                                        const name = e.name || `${e.first_name} ${e.middle_name || ''} ${e.last_name}`;
                                                        const isSelected = editForm.supervising_officer?.includes(name);
                                                        return (
                                                            <div key={e.id} onClick={() => toggleSupervisor(name)} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 p-1 rounded">
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
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-600 leading-relaxed">{project.supervising_officer}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Members{isEditing && <span className="text-red-500"> *</span>}</label>
                                        {isEditing ? (
                                            <div className="border border-slate-300 rounded-lg p-2 bg-white space-y-2">
                                                {filteredEmployees.length > 0 && (
                                                    <input
                                                        type="text"
                                                        placeholder="Search members..."
                                                        value={memberSearch}
                                                        onChange={e => setMemberSearch(e.target.value)}
                                                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none font-normal"
                                                    />
                                                )}
                                                <div className="max-h-32 overflow-y-auto space-y-1">
                                                    {filteredEmployees.length === 0 ? (
                                                        <span className="text-xs text-slate-400">No employees found in this division.</span>
                                                    ) : searchFilteredMembers.length === 0 ? (
                                                        <span className="text-xs text-slate-400">No matching employees found.</span>
                                                    ) : searchFilteredMembers.map(e => {
                                                        const name = e.name || `${e.first_name} ${e.middle_name || ''} ${e.last_name}`;
                                                        const isSelected = editForm.assisting_personnel?.includes(name);
                                                        return (
                                                            <div key={e.id} onClick={() => toggleMember(name)} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 p-1 rounded">
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
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-600 leading-relaxed">{project.assisting_personnel}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Basecamp Target{isEditing && <span className="text-red-500"> *</span>}</label>
                                {isEditing ? (
                                    <div className="border border-slate-300 rounded-lg p-2 max-h-60 overflow-y-auto space-y-2">
                                        {basecampOptions.map((option, idx) => {
                                            const isSelected = editForm.basecamp_target?.split(',').map(s => s.trim()).includes(option);
                                            return (
                                                <div key={idx} onClick={() => toggleBasecamp(option)} className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 p-1 rounded">
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
                                            className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 p-1 rounded"
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

                            {/* Action Buttons at the bottom */}
                            <div className="pt-6 border-t border-slate-100 flex flex-col gap-2">
                                {!isEditing ? (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
                                    >
                                        <Edit2 size={16} />
                                        Edit Project Details
                                    </button>
                                ) : (
                                    <div className="flex gap-2 w-full">
                                        <button
                                            onClick={handleSaveProject}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
                                        >
                                            <Save size={16} />
                                            Save Changes
                                        </button>
                                        <button
                                            onClick={() => { setIsEditing(false); setEditForm(project); }}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                                        >
                                            <X size={16} />
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    </>
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
