import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEmployees, getProjects, getProjectTasks, getProjectFinancials } from '../api';
import { ArrowRight, Folder } from 'lucide-react';
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
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [fetchedProjects, fetchedEmployees] = await Promise.all([
                    getProjects(),
                    getEmployees()
                ]);

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

                // Aggregate Metrics
                let totalActivities = 0;
                let pendingActivities = 0;
                let accomplishedActivities = 0;
                let delayedActivities = 0;
                let totalBudget = 0;
                let totalSpent = 0;

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                projectDetails.forEach(p => {
                    // Task Metrics
                    (p.tasks || []).forEach(t => {
                        totalActivities++;
                        if (t.status === 'Done') {
                            accomplishedActivities++;
                        } else {
                            pendingActivities++;
                            // Check for delay (past due and not done)
                            if (t.due_date && new Date(t.due_date) < today) {
                                delayedActivities++;
                            }
                        }
                    });

                    // Financial Metrics
                    totalBudget += Number(p.financials?.totalBudget || 0);
                    totalSpent += Number(p.financials?.totalExpenses || 0);
                });

                setStats({
                    totalProjects: fetchedProjects.length,
                    totalEmployees: fetchedEmployees.length,
                    totalActivities,
                    pendingActivities,
                    accomplishedActivities,
                    delayedActivities,
                    totalBudget,
                    totalSpent
                });

                setProjects(fetchedProjects);
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

            {/* Recent Projects List */}
            <div>
                <h3 className="text-xl font-bold text-slate-800 mb-4">Active Projects</h3>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {projects.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            No projects found.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {projects.map(project => (
                                <Link
                                    key={project.id}
                                    to={`/projects/${project.id}`}
                                    className="block p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                            <Folder size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-900">{project.name}</h4>
                                            <p className="text-sm text-slate-500">Status: {project.status}</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={20} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
