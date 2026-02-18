import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProjects, getDivisions } from '../api';
import { Folder, ArrowRight, Filter } from 'lucide-react';
import CreateProjectModal from '../components/CreateProjectModal';

const Projects = () => {
    const [projects, setProjects] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const divisionParam = searchParams.get('division') || '';
    const [selectedDivision, setSelectedDivision] = useState(divisionParam);
    const [isModalOpen, setIsModalOpen] = useState(false);

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
        getProjects().then(setProjects).catch(console.error);
        getDivisions().then(setDivisions).catch(console.error);
    }, []);

    const handleProjectCreated = (newProject) => {
        setProjects(prev => [newProject, ...prev]);
    };

    const filteredProjects = selectedDivision
        ? projects.filter(p => p.division === selectedDivision)
        : projects;

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-slate-800">All Projects</h2>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select
                            value={selectedDivision}
                            onChange={(e) => handleDivisionChange(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                        >
                            <option value="">All Divisions</option>
                            {divisions.map(d => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((project, index) => (
                    <Link
                        key={project.id}
                        to={`/projects/${project.id}`}
                        className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group block animate-slide-in"
                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
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
                        <div className="text-sm text-slate-500 mb-4 flex items-center gap-1">
                            Budget: <span className="font-medium text-slate-700">
                                {project.total_budget && !isNaN(project.total_budget)
                                    ? `₱${Number(project.total_budget).toLocaleString()}`
                                    : 'N/A'}
                            </span>
                        </div>

                        <div className="flex items-center text-blue-600 text-sm font-medium gap-1">
                            Open Workspace <ArrowRight size={16} />
                        </div>
                    </Link>
                ))}
            </div >

            {isModalOpen && (
                <CreateProjectModal
                    onClose={() => setIsModalOpen(false)}
                    onProjectCreated={handleProjectCreated}
                />
            )}
        </div >
    );
};

export default Projects;
