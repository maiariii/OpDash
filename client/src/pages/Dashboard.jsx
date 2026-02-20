import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { getEmployees, getProjects, getProjectTasks, getProjectFinancials, getDivisions, getAllCatchUps, getAllMilestones } from '../api';
import DashboardCharts from '../components/DashboardCharts';
import MultiSelect from '../components/MultiSelect';
import CalendarView from '../components/CalendarView';
import CreateTaskModal from '../components/CreateTaskModal';
import SpilloverTracker from '../components/SpilloverTracker';
import Loader from '../components/Loader';

const Dashboard = () => {
    const [loading, setLoading] = useState(true);
    const [selectedDivisions, setSelectedDivisions] = useState([]); // Array of selected division names
    const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger for re-fetching
    const socketRef = useRef(null);

    const [rawData, setRawData] = useState({
        projects: [],
        employees: [],
        divisions: [],
        projectDetails: [],
        catchups: [],
        milestones: []
    });

    const [stats, setStats] = useState({
        totalProjects: 0,
        totalEmployees: 0,
        totalActivities: 0,
        pendingActivities: 0,
        accomplishedActivities: 0,
        delayedActivities: 0,
        totalBudget: 0,
        totalSpent: 0,
        allProjects: [],
        allEmployees: [],
        allTasks: [],
        pendingTasks: [],
        accomplishedTasks: [],
        delayedTasks: [],
        milestonesReached: 0,
        allMilestones: [],
        totalGaaPs: 0,
        totalGaaMooe: 0
    });
    const [editingTask, setEditingTask] = useState(null);

    // Main Data Fetcher
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [fetchedProjects, fetchedEmployees, fetchedDivisions, fetchedCatchUps, fetchedMilestones] = await Promise.all([
                    getProjects(),
                    getEmployees(),
                    getDivisions(),
                    getAllCatchUps(),
                    getAllMilestones()
                ]);

                // Map Division Names to Employees
                const employeesWithDivision = fetchedEmployees.map(emp => ({
                    ...emp,
                    division_name: fetchedDivisions.find(d => d.id === emp.division_id)?.name || 'Unassigned'
                }));

                // Fetch details for all projects in parallel
                const projectDetails = await Promise.all(
                    fetchedProjects.map(async (project) => {
                        const [tasks, financials] = await Promise.all([
                            getProjectTasks(project.id),
                            getProjectFinancials(project.id)
                        ]);
                        return { ...project, tasks, financials };
                    })
                );

                setRawData({
                    projects: fetchedProjects,
                    employees: employeesWithDivision,
                    divisions: fetchedDivisions,
                    projectDetails: projectDetails,
                    catchups: fetchedCatchUps,
                    milestones: fetchedMilestones
                });

                // Join rooms for all fetched projects
                if (socketRef.current) {
                    fetchedProjects.forEach(p => {
                        socketRef.current.emit('join_project', p.id);
                    });
                }

            } catch (error) {
                console.error("Error loading dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [refreshTrigger]);

    // Socket Connection
    useEffect(() => {
        socketRef.current = io({ path: '/opdash/socket.io' });

        socketRef.current.on('connect', () => {
            console.log("Dashboard connected to socket");
        });

        socketRef.current.on('task_updated', () => {
            // Trigger a refresh when any task is updated
            setRefreshTrigger(prev => prev + 1);
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    // Filter and Calculate Stats
    useEffect(() => {
        if (loading) return;

        const { projectDetails, employees, projects, catchups, milestones } = rawData;

        // Filter Data based on selectedDivisions
        const filteredProjects = selectedDivisions.length === 0
            ? projectDetails
            : projectDetails.filter(p => selectedDivisions.includes(p.division));

        // For employees, we filter by division_name (mapped earlier)
        const filteredEmployees = selectedDivisions.length === 0
            ? employees
            : employees.filter(e => selectedDivisions.includes(e.division_name));

        const filteredProjectIds = new Set(filteredProjects.map(p => p.id));

        const projectTasks = [];
        const activityProjectMap = {}; // activityId -> { projectId, projectName, divisionName }

        filteredProjects.forEach(p => {
            if (p.tasks) {
                p.tasks.forEach(t => {
                    projectTasks.push({
                        ...t,
                        project_name: p.name,
                        division_name: p.division,
                        project_id: p.id
                    });
                    activityProjectMap[t.id] = {
                        project_id: p.id,
                        project_name: p.name,
                        division_name: p.division
                    };
                });
            }
        });

        // Filter Catchups
        const filteredCatchups = (catchups || []).filter(c => activityProjectMap[c.activity_id]);

        // Filter Milestones
        const filteredMilestones = (milestones || []).filter(m => filteredProjectIds.has(m.project_id));


        // Aggregate Metrics (Based on Project Tasks Only)
        let totalActivities = 0;
        let pendingActivities = 0;
        let accomplishedActivities = 0;
        let delayedActivities = 0;
        let totalBudget = 0;
        let totalSpent = 0;
        let totalGaaPs = 0;
        let totalGaaMooe = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pendingTasks = [];
        const accomplishedTasks = [];
        const delayedTasks = [];

        projectTasks.forEach(t => {
            totalActivities++;
            if (t.status === 'Accomplished') {
                accomplishedActivities++;
                accomplishedTasks.push(t);
            } else {
                pendingActivities++;
                pendingTasks.push(t);
                // Check for delay (past due and not done)
                if (t.due_date && new Date(t.due_date) < today) {
                    delayedActivities++;
                    delayedTasks.push(t);
                }
            }
        });

        // Calculate Milestones Reached
        const reachedMilestones = filteredMilestones.filter(m => ['Accomplished', 'Completed', 'Done'].includes(m.status));
        const milestonesReached = reachedMilestones.length;

        filteredProjects.forEach(p => {
            // Financial Metrics
            totalBudget += Number(p.financials?.total_budget || 0);
            totalSpent += Number(p.financials?.actual_cost || 0);
            totalGaaPs += Number(p.gaa_ps || 0);
            totalGaaMooe += Number(p.gaa_mooe || 0);
        });

        // Prepare Calendar Events (Tasks + Catchups + Milestones)
        const allCalendarEvents = [...projectTasks];

        // Add Catchups
        filteredCatchups.forEach(c => {
            const projectInfo = activityProjectMap[c.activity_id];
            allCalendarEvents.push({
                ...c,
                id: `catchup-${c.id}`,
                title: `Catch-up: ${c.title}`,
                status: c.status,
                target_date: c.target_date,
                project_name: projectInfo.project_name,
                is_catchup: true
            });
        });

        // Add Milestones
        filteredMilestones.forEach(m => {
            // Loose comparison for ID to handle string/number differences
            const project = filteredProjects.find(p => p.id == m.project_id);
            allCalendarEvents.push({
                ...m,
                id: `milestone-${m.id}`,
                title: m.title,
                status: m.status,
                target_date: m.target_date,
                project_name: project?.name || 'Unknown Project',
                division_name: project?.division || 'Unassigned',
                importance: m.importance, // Ensure importance is passed
                is_milestone: true
            });
        });

        // Use the enriched list for allMilestones state
        const enrichedMilestones = allCalendarEvents.filter(e => e.is_milestone);

        setStats({
            totalProjects: filteredProjects.length,
            totalEmployees: filteredEmployees.length,
            totalActivities,
            pendingActivities,
            accomplishedActivities,
            delayedActivities,
            totalBudget,
            totalSpent,
            totalGaaPs,
            totalGaaMooe,
            milestonesReached,
            // Detailed Arrays
            allProjects: filteredProjects.map(p => ({
                ...p,
                total_budget: p.financials?.total_budget || 0,
                actual_cost: p.financials?.actual_cost || 0
            })),
            allEmployees: filteredEmployees,
            allTasks: allCalendarEvents, // For Calendar & "All Activities" modal
            pendingTasks,
            accomplishedTasks,
            delayedTasks,
            allMilestones: enrichedMilestones
        });

    }, [rawData, selectedDivisions, loading]);


    if (loading) {
        return <div className="p-8 flex justify-center"><Loader text="Loading dashboard data..." /></div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Executive Dashboard</h2>

                <div className="flex items-center gap-2">
                    <MultiSelect
                        label="Filter by Division"
                        options={rawData.divisions.map(d => ({ label: d.name, value: d.name }))}
                        selected={selectedDivisions}
                        onChange={setSelectedDivisions}
                        placeholder="All Divisions"
                        className="min-w-[350px]"
                    />
                </div>
            </div>

            {/* Metrics & Visuals */}
            <DashboardCharts metrics={stats} />

            {/* Activity Calendar */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <CalendarView
                    activities={stats.allTasks.filter(t => !t.is_milestone)}
                    title="Executive Activity Calendar"
                    onActivityClick={setEditingTask}
                />
            </div>

            {/* Spillover Tracker */}
            <SpilloverTracker tasks={stats.allTasks} />

            {editingTask && (
                <CreateTaskModal
                    projectId={editingTask.project_id}
                    task={editingTask}
                    members={stats.allEmployees} // Pass filtered employees
                    onClose={() => setEditingTask(null)}
                    onCreated={() => {
                        setEditingTask(null);
                        // No need for window.reload() anymore, socket will handle it
                        // keeping it as fallback or removing it? 
                        // Removing it to rely on socket.
                        setRefreshTrigger(prev => prev + 1);
                    }}
                />
            )}

        </div>
    );
};

export default Dashboard;
