import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProjects, getDivisions, getAllMilestones, getProjectTasks } from '../api';
import { Folder, ArrowRight, Filter, ArrowUpDown, Flag, Layers, CheckSquare, LayoutGrid, List } from 'lucide-react';
import CreateProjectModal from '../components/CreateProjectModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { deleteProject } from '../api';
import { Trash2 } from 'lucide-react';

const Projects = () => {
    const [projects, setProjects] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [projectStats, setProjectStats] = useState({}); // { projectId: { milestones: 0, activities: 0, tasks: 0 } }
    const [searchParams, setSearchParams] = useSearchParams();
    const divisionParam = searchParams.get('division') || '';
    const [selectedDivision, setSelectedDivision] = useState(divisionParam);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        setSelectedDivision(divisionParam);
    }, [divisionParam]);

    const handleDivisionChange = (newDivision) => {
        setSelectedDivision(newDivision);
        if (newDivision) {
            setSearchParams({ division: newDivision });
        } else {
            setSearchParams({});
        }
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                const [loadedProjects, loadedDivisions, loadedMilestones] = await Promise.all([
                    getProjects(),
                    getDivisions(),
                    getAllMilestones()
                ]);

                setProjects(loadedProjects);
                setDivisions(loadedDivisions);

                // Fetch tasks for all projects to get counts
                // Optimization: In a real large app, backend should provide counts. 
                // Here we fetch all tasks for all projects in parallel.
                const tasksPromises = loadedProjects.map(p =>
                    getProjectTasks(p.id).then(tasks => ({ projectId: p.id, tasks })).catch(err => ({ projectId: p.id, tasks: [] }))
                );

                const allProjectsTasks = await Promise.all(tasksPromises);

                const newStats = {};
                loadedProjects.forEach(p => {
                    // Milestones Count
                    const pMilestones = loadedMilestones.filter(m => m.project_id === p.id).length;

                    // Tasks/Activities
                    const pTasksData = allProjectsTasks.find(pt => pt.projectId === p.id)?.tasks || [];
                    const activityCount = pTasksData.length;

                    // Subtasks Count (sum of subtasks array length in each activity)
                    const subtaskCount = pTasksData.reduce((acc, curr) => acc + (curr.subtasks?.length || 0), 0);

                    newStats[p.id] = {
                        milestones: pMilestones,
                        activities: activityCount,
                        tasks: subtaskCount
                    };
                });

                setProjectStats(newStats);

            } catch (err) {
                console.error("Failed to load projects data", err);
            }
        };

        loadData();
    }, []);

    const handleProjectCreated = (newProject) => {
        setProjects(prev => [newProject, ...prev]);
        setProjectStats(prev => ({
            ...prev,
            [newProject.id]: { milestones: 0, activities: 0, tasks: 0 }
        }));
    };

    const handleDeleteClick = (e, project) => {
        e.preventDefault();
        e.stopPropagation();
        setProjectToDelete(project);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!projectToDelete) return;
        setIsDeleting(true);
        try {
            await deleteProject(projectToDelete.id);
            setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
            setDeleteModalOpen(false);
            setProjectToDelete(null);
        } catch (err) {
            console.error("Failed to delete project", err);
            alert("Failed to delete project");
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredProjects = selectedDivision
        ? projects.filter(p => p.division === selectedDivision)
        : projects;

    const [sortBy, setSortBy] = useState('latest');

    const sortedProjects = [...filteredProjects].sort((a, b) => {
        if (sortBy === 'latest') {
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        } else if (sortBy === 'oldest') {
            return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        } else if (sortBy === 'name_asc') {
            return (a.name || '').localeCompare(b.name || '');
        } else if (sortBy === 'name_desc') {
            return (b.name || '').localeCompare(a.name || '');
        }
        return 0;
    });

    // View Mode State
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-slate-800">{selectedDivision ? `${selectedDivision} Projects` : 'All Projects'}</h2>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* View Toggle */}
                    <div className="flex bg-white border border-slate-200 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-slate-100 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Grid View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-slate-100 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Table View"
                        >
                            <List size={18} />
                        </button>
                    </div>

                    <div className="relative flex-1 md:hidden">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select
                            value={selectedDivision}
                            onChange={(e) => handleDivisionChange(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white font-medium"
                        >
                            <option value="">All Divisions</option>
                            {divisions.map(d => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative flex-1 md:w-48">
                        <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white font-medium"
                        >
                            <option value="latest">Created Date (Newest First)</option>
                            <option value="oldest">Created Date (Oldest First)</option>
                            <option value="name_asc">Project Name (A - Z)</option>
                            <option value="name_desc">Project Name (Z - A)</option>
                        </select>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                        + New Project
                    </button>
                </div>
            </div>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedProjects.map((project, index) => {
                        const stats = projectStats[project.id] || { milestones: 0, activities: 0, tasks: 0 };

                        return (
                            <Link
                                key={project.id}
                                to={`/projects/${project.id}`}
                                className="card-outlined p-6 hover:shadow-md transition-all group block animate-slide-in relative flex flex-col h-full"
                                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-[#075985]">
                                        <Folder size={24} />
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 uppercase tracking-wide">
                                            {project.division || 'No Division'}
                                        </span>
                                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                            {project.lead_personnel || 'No Lead'}
                                        </div>
                                    </div>
                                </div>

                                <h3 className="font-bold text-lg text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                                    {project.name}
                                </h3>
                                <p className="text-sm text-slate-500 mb-4 line-clamp-2 min-h-[40px]">
                                    {project.description || 'No description provided.'}
                                </p>

                                <div className="mt-auto pt-4 border-t border-slate-100">
                                    <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1.5" title="Milestones">
                                                <Flag size={14} className="text-amber-500" />
                                                <span className="font-semibold">{stats.milestones}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5" title="Activities">
                                                <Layers size={14} className="text-blue-500" />
                                                <span className="font-semibold">{stats.activities}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5" title="Tasks">
                                                <CheckSquare size={14} className="text-emerald-500" />
                                                <span className="font-semibold">{stats.tasks}</span>
                                            </div>
                                        </div>
                                        <div className="text-slate-400">
                                            {project.total_budget && !isNaN(project.total_budget)
                                                ? `₱${Number(project.total_budget).toLocaleString()}`
                                                : ''}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center text-blue-600 text-sm font-medium gap-1 group-hover:underline">
                                            Open Workspace <ArrowRight size={16} />
                                        </div>
                                        <button
                                            onClick={(e) => handleDeleteClick(e, project)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                            title="Delete Project"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            ) : (
                <div className="card-outlined overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">Project Name</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">Division</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">Lead</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider text-right">Budget</th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider text-center" title="Milestones">
                                        <Flag size={16} className="mx-auto text-amber-500" />
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider text-center" title="Activities">
                                        <Layers size={16} className="mx-auto text-blue-500" />
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider text-center" title="Tasks">
                                        <CheckSquare size={16} className="mx-auto text-emerald-500" />
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedProjects.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-8 text-center text-slate-500">
                                            No projects found matching the criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedProjects.map(project => {
                                        const stats = projectStats[project.id] || { milestones: 0, activities: 0, tasks: 0 };
                                        return (
                                            <tr key={project.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <Link to={`/projects/${project.id}`} className="font-bold text-slate-900 hover:text-blue-600 transition-colors block">
                                                        {project.name}
                                                    </Link>
                                                    <div className="text-xs text-slate-500 mt-1 line-clamp-1 max-w-xs">
                                                        {project.description}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                                                        {project.division || 'No Division'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {project.lead_personnel || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600 text-right font-mono">
                                                    {project.total_budget && !isNaN(project.total_budget)
                                                        ? `₱${Number(project.total_budget).toLocaleString()}`
                                                        : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-center font-semibold text-slate-700">
                                                    {stats.milestones}
                                                </td>
                                                <td className="px-6 py-4 text-center font-semibold text-slate-700">
                                                    {stats.activities}
                                                </td>
                                                <td className="px-6 py-4 text-center font-semibold text-slate-700">
                                                    {stats.tasks}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                        <Link
                                                            to={`/projects/${project.id}`}
                                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                                                            title="Open Project"
                                                        >
                                                            <ArrowRight size={16} />
                                                        </Link>
                                                        <button
                                                            onClick={(e) => handleDeleteClick(e, project)}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                                                            title="Delete Project"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {
                isModalOpen && (
                    <CreateProjectModal
                        onClose={() => setIsModalOpen(false)}
                        onProjectCreated={handleProjectCreated}
                    />
                )
            }

            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Project"
                itemName={projectToDelete?.name}
                message="Are you sure you want to delete this project? This will permanently delete all activities, tasks, milestones, and financial data associated with it."
                isDeleting={isDeleting}
                waitDuration={20}
            />
        </div >
    );
};

export default Projects;
