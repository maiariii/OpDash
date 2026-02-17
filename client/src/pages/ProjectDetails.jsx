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
    updateTask, createTask, predictRisk,
    updateProject, getDivisions, getEmployees
} from '../api';

// import KanbanBoard from '../components/KanbanBoard';
import GanttChart from '../components/GanttChart';
import CreateTaskModal from '../components/CreateTaskModal';
import EditSubtaskModal from '../components/EditSubtaskModal';
import TaskTable from '../components/TaskTable';
import SubtaskTable from '../components/SubtaskTable';
import CreateSubtaskModal from '../components/CreateSubtaskModal';
import IndicatorsTab from '../components/IndicatorsTab';
import SpilloversTab from '../components/SpilloversTab';
import DashboardCharts from '../components/DashboardCharts';


const TabButton = ({ active, children, onClick, icon: Icon }) => (
    <button
        onClick={onClick}
        className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
            active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
        )}
    >
        <Icon size={18} />
        {children}
    </button>
);

const ProjectDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [financials, setFinancials] = useState(null);
    const [activeTab, setActiveTab] = useState('kanban');
    const [aiRisk, setAiRisk] = useState(null);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [editingTask, setEditingTask] = useState(null); // For Task Modal

    const [isCreatingTask, setIsCreatingTask] = useState(false); // For Creating New Task
    const [showCreateSubtask, setShowCreateSubtask] = useState(false); // For New Subtask Modal
    const [editingSubtask, setEditingSubtask] = useState(null); // For Subtask Modal

    // Dropdown Data
    const [divisions, setDivisions] = useState([]);
    const [employees, setEmployees] = useState([]);

    useEffect(() => {
        // Load initial data
        Promise.all([
            getProjects(),
            getProjectTasks(id),
            getProjectFinancials(id),
            getDivisions(),
            getEmployees()
        ]).then(([projects, tasks, fin, divs, emps]) => {
            const p = projects.find(p => p.id === id);
            setProject(p);
            setTasks(tasks);
            setFinancials(fin);
            setDivisions(divs);
            setEmployees(emps);

            // Init Edit Form
            if (p) setEditForm(p);

            // AI Risk Check
            predictRisk({ burnRate: fin.burn_rate_percent, progress: 40 }) // Mock progress
                .then(setAiRisk);
        });

        // Socket setup
        const socket = io('http://localhost:3000');
        socket.emit('join_project', id);

        socket.on('task_updated', (event) => {
            getProjectTasks(id).then(setTasks);
            getProjectFinancials(id).then(setFinancials);
        });

        return () => socket.disconnect();
    }, [id]);

    const handleTaskUpdate = (task) => {
        setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    };

    const handleSaveProject = async () => {
        try {
            // Clean up members list before saving:
            // 1. Split, trim, filter valid strings
            // 2. Validate against actual employee list
            const cleanForm = { ...editForm };
            if (cleanForm.assisting_personnel) {
                // Create a Set of valid employee names for O(1) lookup
                const validNames = new Set(employees.map(e =>
                    e.name || `${e.first_name} ${e.middle_name || ''} ${e.last_name}`.trim().replace(/\s+/g, ' ')
                ));

                cleanForm.assisting_personnel = cleanForm.assisting_personnel
                    .split(',')
                    .map(s => s.trim())
                    .filter(s => s && s.toLowerCase() !== 'n/a' && validNames.has(s))
                    .join(', ');
            }

            const updated = await updateProject(id, cleanForm);
            setProject(updated);
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

    const handleSubtaskToggle = async (subtask) => {
        try {
            // 1. Find the parent task (activity)
            const parentActivity = tasks.find(t => t.id === subtask.parentId);
            if (!parentActivity) return;

            // 2. Toggle status
            const newStatus = subtask.status === 'Done' ? 'Todo' : 'Done';

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

    if (!project) return <div className="p-8">Loading...</div>;

    const filteredEmployees = getDivisionEmployees();

    // Calculate Project Metrics for Dashboard
    const calculateDashboardMetrics = () => {
        if (!project || !financials) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let pendingCount = 0;
        let accomplishedCount = 0;
        let delayedCount = 0;

        const pendingList = [];
        const accomplishedList = [];
        const delayedList = [];
        const enrichedTasks = tasks.map(t => ({
            ...t,
            project_name: project.name
        }));

        enrichedTasks.forEach(t => {
            if (t.status === 'Done') {
                accomplishedCount++;
                accomplishedList.push(t);
            } else {
                pendingCount++;
                pendingList.push(t);
                if (t.due_date && new Date(t.due_date) < today) {
                    delayedCount++;
                    delayedList.push(t);
                }
            }
        });

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
            totalBudget: Number(financials.total_budget || 0),
            totalSpent: Number(financials.actual_cost || 0),
            // Detailed Arrays
            allProjects: [{ ...project, total_budget: financials.total_budget, actual_cost: financials.actual_cost }],
            allEmployees: filteredEmployees.map(e => ({ ...e, division_name: project.division })),
            allTasks: enrichedTasks,
            pendingTasks: pendingList,
            accomplishedTasks: accomplishedList,
            delayedTasks: delayedList
        };
    };

    const dashboardMetrics = calculateDashboardMetrics();

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

                <div className="flex justify-between items-end">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {/* Renamed Kanban to Dashboard */}
                        <TabButton active={activeTab === 'kanban'} onClick={() => setActiveTab('kanban')} icon={Layout}>Dashboard</TabButton>
                        <TabButton active={activeTab === 'table'} onClick={() => setActiveTab('table')} icon={Table}>Activity List</TabButton>
                        <TabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={List}>Tasks</TabButton>
                        <TabButton active={activeTab === 'gantt'} onClick={() => setActiveTab('gantt')} icon={Calendar}>Timeline</TabButton>
                        <TabButton active={activeTab === 'indicators'} onClick={() => setActiveTab('indicators')} icon={Target}>Indicators</TabButton>
                        <TabButton active={activeTab === 'financials'} onClick={() => setActiveTab('financials')} icon={PieChart}>Financials</TabButton>
                        <TabButton active={activeTab === 'spillovers'} onClick={() => setActiveTab('spillovers')} icon={Layers}>Spillovers</TabButton>
                    </div>

                    {activeTab === 'table' && (
                        <button
                            onClick={() => setIsCreatingTask(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors mb-1"
                        >
                            <Plus size={16} /> Add Activity
                        </button>
                    )}

                    {activeTab === 'tasks' && (
                        <button
                            onClick={() => setShowCreateSubtask(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors mb-1"
                        >
                            <Plus size={16} /> Add Task
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 xl:grid-cols-4">

                {/* Center Workspace (3/4) */}
                <div className="xl:col-span-3 overflow-y-auto p-6">
                    {activeTab === 'kanban' && dashboardMetrics && (
                        <div className="max-w-6xl mx-auto">
                            <DashboardCharts metrics={dashboardMetrics} />
                        </div>
                    )}

                    {activeTab === 'spillovers' && (
                        <SpilloversTab
                            tasks={tasks}
                            onTaskClick={setEditingTask}
                        />
                    )}

                    {activeTab === 'table' && (
                        <TaskTable
                            tasks={tasks}
                            employees={employees}
                            onTaskClick={setEditingTask}
                        />
                    )}

                    {activeTab === 'tasks' && (
                        <SubtaskTable
                            activities={tasks}
                            employees={employees}
                            onSubtaskClick={setEditingSubtask}
                            onToggleStatus={handleSubtaskToggle}
                        />
                    )}

                    {activeTab === 'gantt' && (
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-[600px]">
                            <GanttChart
                                tasks={tasks}
                                onTaskClick={(ganttTask) => {
                                    const originalTask = tasks.find(t => t.id === ganttTask.id);
                                    if (originalTask) setEditingTask(originalTask);
                                }}
                            />
                        </div>
                    )}

                    {activeTab === 'indicators' && (
                        <IndicatorsTab projectId={id} />
                    )}

                    {activeTab === 'financials' && financials && (
                        <div className="max-w-4xl">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Project Financials</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Budget</h3>
                                    <p className="text-3xl font-bold text-slate-800 tracking-tight mt-1">
                                        ₱{Number(financials?.total_budget || 0).toLocaleString()}
                                    </p>
                                </div>
                                <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Actual Cost</h3>
                                    <p className="text-3xl font-bold text-slate-800 tracking-tight mt-1">
                                        ₱{Number(financials?.actual_cost || 0).toLocaleString()}
                                    </p>
                                </div>
                                <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Remaining Cost</h3>
                                    <p className={`text-3xl font-bold tracking-tight mt-1 ${(financials?.remaining_budget || 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        ₱{Number(financials?.remaining_budget || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Burn Rate</h3>
                                    <p className="text-3xl font-bold text-orange-500 tracking-tight">
                                        {financials?.burn_rate_percent?.toFixed(1) || 0}%
                                    </p>
                                    <p className="text-xs text-slate-400 mt-2">Percentage of budget used.</p>
                                </div>

                                {aiRisk && (
                                    <div className={clsx(
                                        "p-6 rounded-xl border shadow-sm flex flex-col gap-2",
                                        aiRisk.riskLevel === 'HIGH' ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"
                                    )}>
                                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-sm">
                                            <Activity size={18} />
                                            AI Risk Assessment: {aiRisk.riskLevel}
                                        </div>
                                        <p className="text-sm leading-relaxed opacity-90">{aiRisk.message}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                </div>

                {/* Right Sidebar (1/4) - Project Details */}
                <div className="border-l border-slate-200 bg-white p-6 overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Layers size={18} /> Project Details
                        </h3>
                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                                <Edit2 size={16} />
                            </button>
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

                        <div className="pt-4 border-t border-slate-100">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Users size={18} /> Team
                            </h4>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Lead Personnel</label>
                                    {isEditing ? (
                                        <select
                                            className="w-full border border-slate-300 rounded p-2 text-sm"
                                            value={editForm.lead_personnel}
                                            onChange={e => setEditForm({ ...editForm, lead_personnel: e.target.value })}
                                        >
                                            <option value="">Select Lead</option>
                                            {filteredEmployees.map(e => {
                                                const name = e.name || `${e.first_name} ${e.middle_name || ''} ${e.last_name}`;
                                                return <option key={e.id} value={name}>{name}</option>
                                            })}
                                        </select>
                                    ) : (
                                        <p className="text-sm font-medium text-slate-800">{project.lead_personnel}</p>
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
                    </div>
                </div>
            </div >
            {(editingTask || isCreatingTask) && (
                <CreateTaskModal
                    projectId={id}
                    task={editingTask}
                    members={employees}
                    onClose={() => {
                        setEditingTask(null);
                        setIsCreatingTask(false);
                    }}
                    onCreated={() => {
                        setEditingTask(null);
                        setIsCreatingTask(false);
                        getProjectTasks(id).then(setTasks);
                        getProjectFinancials(id).then(setFinancials);
                    }}
                />
            )}
            {editingSubtask && (
                <EditSubtaskModal
                    subtask={editingSubtask}
                    parentId={editingSubtask.parentId}
                    parentTask={editingSubtask.parentTask}
                    members={employees}
                    onClose={() => setEditingSubtask(null)}
                    onUpdate={() => {
                        getProjectTasks(id).then(setTasks);
                        getProjectFinancials(id).then(setFinancials);
                    }}
                />
            )}
            {showCreateSubtask && (
                <CreateSubtaskModal
                    activities={tasks}
                    members={employees}
                    onClose={() => setShowCreateSubtask(false)}
                    onCreate={() => {
                        getProjectTasks(id).then(setTasks);
                        getProjectFinancials(id).then(setFinancials);
                    }}
                />
            )}
        </div >
    );
};

export default ProjectDetails;
