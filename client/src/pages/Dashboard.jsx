import React, { useEffect, useState } from 'react';
import { getEmployees, getProjects, getProjectTasks, getProjectFinancials, getDivisions } from '../api';
import DashboardCharts from '../components/DashboardCharts';

const Dashboard = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalProjects: 0,
        totalEmployees: 0,
        totalActivities: 0,
        pendingActivities: 0,
        accomplishedActivities: 0,
        delayedActivities: 0,
        totalBudget: 0,
        totalSpent: 0
    });


    useEffect(() => {
        const fetchData = async () => {
            try {
                const [fetchedProjects, fetchedEmployees, fetchedDivisions] = await Promise.all([
                    getProjects(),
                    getEmployees(),
                    getDivisions()
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

                const allTasks = [];
                projectDetails.forEach(p => {
                    if (p.tasks) {
                        p.tasks.forEach(t => {
                            allTasks.push({
                                ...t,
                                project_name: p.name,
                                division_name: p.division // Ensure division context is available if needed
                            });
                        });
                    }
                });

                // Aggregate Metrics
                let totalActivities = 0;
                let pendingActivities = 0;
                let accomplishedActivities = 0;
                let delayedActivities = 0;
                let totalBudget = 0;
                let totalSpent = 0;

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const pendingTasks = [];
                const accomplishedTasks = [];
                const delayedTasks = [];

                allTasks.forEach(t => {
                    totalActivities++;
                    if (t.status === 'Done') {
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

                projectDetails.forEach(p => {
                    // Financial Metrics
                    totalBudget += Number(p.financials?.total_budget || 0);
                    totalSpent += Number(p.financials?.actual_cost || 0);
                });

                setStats({
                    totalProjects: fetchedProjects.length,
                    totalEmployees: employeesWithDivision.length,
                    totalActivities,
                    pendingActivities,
                    accomplishedActivities,
                    delayedActivities,
                    totalBudget,
                    totalSpent,
                    // Detailed Arrays
                    allProjects: projectDetails.map(p => ({
                        ...p,
                        total_budget: p.financials?.total_budget || 0,
                        actual_cost: p.financials?.actual_cost || 0
                    })),
                    allEmployees: employeesWithDivision,
                    allTasks,
                    pendingTasks,
                    accomplishedTasks,
                    delayedTasks
                });


            } catch (error) {
                console.error("Error loading dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading dashboard data...</div>;
    }

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-slate-800">Executive Dashboard</h2>

            {/* Metrics & Visuals */}
            <DashboardCharts metrics={stats} />


        </div>
    );
};

export default Dashboard;
