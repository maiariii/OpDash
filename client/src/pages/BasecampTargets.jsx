import React, { useState, useEffect } from 'react';
import { getProjects, getAllMilestones, getDivisions } from '../api';
import { ChevronDown, ChevronRight, LayoutList, LayoutGrid, Flag, Calendar, CheckCircle2, Clock, AlertTriangle, User, Star } from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';

const BASECAMP_TARGETS = [
    "Career Progression for DepEd Personnel",
    "Mental Health Professionals for Schools",
    "Workforce Plan and Management",
    "HROD Process Excellence",
    "Prioritization Index for Education Facilities Allocation",
    "Career Opportunities in DepEd for SHS Graduates",
    "Others"
];



const BasecampTargets = () => {
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState([]);
    const [milestones, setMilestones] = useState([]);
    const [viewMode, setViewMode] = useState('table'); // 'table' | 'card'
    const [expandedSections, setExpandedSections] = useState(new Set()); // Default all collapsed

    useEffect(() => {
        Promise.all([
            getProjects(),
            getAllMilestones()
        ]).then(([projs, ms]) => {
            setProjects(projs);
            setMilestones(ms);
            setLoading(false);
        }).catch(err => {
            console.error("Failed to load basecamp details", err);
            setLoading(false);
        });
    }, []);

    const toggleSection = (target) => {
        const newSet = new Set(expandedSections);
        if (newSet.has(target)) {
            newSet.delete(target);
        } else {
            newSet.add(target);
        }
        setExpandedSections(newSet);
    };

    const getMilestonesForBasecamp = (target) => {
        // 1. Find projects that include this target string in their comma-separated list
        const relatedProjectIds = new Set(
            projects
                .filter(p => p.basecamp_target && p.basecamp_target.includes(target))
                .map(p => p.id)
        );

        // 2. Filter milestones for these projects and sort by progress (descending)
        return milestones
            .filter(m => relatedProjectIds.has(m.project_id))
            .map(m => {
                const proj = projects.find(p => p.id === m.project_id);
                return {
                    ...m,
                    project_name: proj?.name || 'Unknown Project',
                    division_name: proj?.division || 'Unassigned',
                    project_id: m.project_id
                };
            })
            .sort((a, b) => (Number(b.progress) || 0) - (Number(a.progress) || 0));
    };



    if (loading) return <div className="p-8 text-center text-slate-500">Loading Basecamp Targets...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Flag className="text-blue-600" />
                        Basecamp Targets
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Track milestones aligned with strategic basecamp goals.</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                        onClick={() => setViewMode('table')}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                            viewMode === 'table' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <LayoutList size={16} /> Table
                    </button>
                    <button
                        onClick={() => setViewMode('card')}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                            viewMode === 'card' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <LayoutGrid size={16} /> Card
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {BASECAMP_TARGETS.map(target => {
                    const targetMilestones = getMilestonesForBasecamp(target);
                    const isExpanded = expandedSections.has(target);

                    return (
                        <div 
                            key={target} 
                            className={clsx(
                                "bg-white rounded-xl border transition-all duration-200 overflow-hidden",
                                isExpanded 
                                    ? "border-blue-500 shadow-md ring-1 ring-blue-500/10" 
                                    : "border-slate-200 shadow-sm hover:shadow hover:border-slate-300"
                            )}
                        >
                            <button
                                onClick={() => toggleSection(target)}
                                className={clsx(
                                    "w-full flex items-center justify-between p-4 text-left transition-colors relative",
                                    isExpanded ? "bg-blue-50/20" : "bg-white hover:bg-slate-50/50"
                                )}
                            >
                                <div className={clsx(
                                    "absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-200",
                                    isExpanded ? "bg-blue-600" : "bg-transparent"
                                )} />
                                
                                <div className="flex items-center gap-3 pr-2 flex-1 min-w-0">
                                    <div className={clsx(
                                        "flex items-center justify-center w-7 h-7 rounded-lg transition-colors shrink-0",
                                        isExpanded ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                                    )}>
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </div>
                                    <h3 className={clsx(
                                        "font-bold text-slate-800 text-sm sm:text-base leading-snug flex-1",
                                        isExpanded && "text-blue-900"
                                    )}>
                                        {target}
                                    </h3>
                                </div>
                                <span className={clsx(
                                    "px-2.5 py-0.5 rounded-full text-xs font-black border transition-all shrink-0",
                                    isExpanded 
                                        ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                                        : "bg-slate-100 text-slate-600 border-slate-200"
                                )}>
                                    {targetMilestones.length}
                                </span>
                            </button>

                            {isExpanded && (
                                <div className="p-4">
                                    {targetMilestones.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400 italic bg-slate-50 rounded-lg border border-slate-100 border-dashed">
                                            No milestones linked to this target yet.
                                        </div>
                                    ) : (
                                        <>
                                            {viewMode === 'table' ? (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm text-left border-collapse">
                                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                                            <tr>
                                                                <th className="px-4 py-3 font-semibold w-1/3">Milestone</th>
                                                                <th className="px-4 py-3 font-semibold w-32">Progress</th>
                                                                <th className="px-4 py-3 font-semibold">Project</th>
                                                                <th className="px-4 py-3 font-semibold">Division</th>

                                                                <th className="px-4 py-3 font-semibold text-right">Target Date</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {targetMilestones.map(m => (
                                                                <tr key={m.id} className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                                                                    <td className="px-4 py-3 font-medium text-slate-800">{m.title}</td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-full max-w-[80px]">
                                                                                <div
                                                                                    className={clsx("h-full rounded-full",
                                                                                        m.progress === 100 ? "bg-green-500" : "bg-blue-500"
                                                                                    )}
                                                                                    style={{ width: `${m.progress || 0}%` }}
                                                                                />
                                                                            </div>
                                                                            <span className="text-xs font-medium text-slate-600">{m.progress || 0}%</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-600">
                                                                        <Link to={`/projects/${m.project_id}`} className="hover:text-blue-600 hover:underline">
                                                                            {m.project_name}
                                                                        </Link>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-600">{m.division_name}</td>

                                                                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                                                                        {m.target_date ? new Date(m.target_date).toLocaleDateString() : '-'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {targetMilestones.map(m => (
                                                        <div key={m.id} className="p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3 bg-white hover:bg-slate-50">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <h4 className="font-bold text-slate-800 line-clamp-2" title={m.title}>{m.title}</h4>

                                                            </div>
                                                            <div className="flex items-center gap-2 w-full">
                                                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={clsx("h-full rounded-full",
                                                                            m.progress === 100 ? "bg-green-500" : "bg-blue-500"
                                                                        )}
                                                                        style={{ width: `${m.progress || 0}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-600 min-w-[30px] text-right">{m.progress || 0}%</span>
                                                            </div>
                                                            {m.description && (
                                                                <p className="text-sm text-slate-600 line-clamp-3 bg-white/50 p-2 rounded border border-slate-200/50 italic">
                                                                    {m.description}
                                                                </p>
                                                            )}
                                                            <div className="mt-auto pt-3 border-t border-slate-200/50 text-xs space-y-1.5">
                                                                <div className="flex items-center gap-2 text-slate-600">
                                                                    <Calendar size={14} className="text-slate-400" />
                                                                    <span>Target: {m.target_date ? new Date(m.target_date).toLocaleDateString() : 'N/A'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-slate-600">
                                                                    <User size={14} className="text-slate-400" />
                                                                    <Link to={`/projects/${m.project_id}`} className="hover:text-blue-600 hover:underline truncate">
                                                                        {m.project_name}
                                                                    </Link>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BasecampTargets;
