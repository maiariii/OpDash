import React, { useState, useEffect, useMemo } from 'react';
import { getProjects, getAllMilestones, getDivisions } from '../api';
import { ChevronDown, ChevronRight, LayoutList, LayoutGrid, Flag, Calendar, CheckCircle2, Clock, AlertTriangle, User, Star, TrendingUp, Target, Briefcase, Users, BookOpen, Award, Wrench } from 'lucide-react';
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

const TARGET_ICONS = {
    "Career Progression for DepEd Personnel": TrendingUp,
    "Mental Health Professionals for Schools": Users,
    "Workforce Plan and Management": Briefcase,
    "HROD Process Excellence": Award,
    "Prioritization Index for Education Facilities Allocation": Target,
    "Career Opportunities in DepEd for SHS Graduates": BookOpen,
    "Others": Wrench
};

const TARGET_COLORS = {
    "Career Progression for DepEd Personnel": { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', ring: 'ring-blue-500/10', gradient: 'from-blue-500 to-blue-600' },
    "Mental Health Professionals for Schools": { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', ring: 'ring-emerald-500/10', gradient: 'from-emerald-500 to-emerald-600' },
    "Workforce Plan and Management": { bg: 'bg-violet-500', light: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', ring: 'ring-violet-500/10', gradient: 'from-violet-500 to-violet-600' },
    "HROD Process Excellence": { bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', ring: 'ring-amber-500/10', gradient: 'from-amber-500 to-amber-600' },
    "Prioritization Index for Education Facilities Allocation": { bg: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', ring: 'ring-rose-500/10', gradient: 'from-rose-500 to-rose-600' },
    "Career Opportunities in DepEd for SHS Graduates": { bg: 'bg-cyan-500', light: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', ring: 'ring-cyan-500/10', gradient: 'from-cyan-500 to-cyan-600' },
    "Others": { bg: 'bg-slate-500', light: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', ring: 'ring-slate-500/10', gradient: 'from-slate-500 to-slate-600' }
};

const getProgressColor = (progress) => {
    if (progress >= 75) return { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (progress >= 40) return { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' };
    return { bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' };
};

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

    const getAverageProgress = (milestonesList) => {
        if (milestonesList.length === 0) return 0;
        const total = milestonesList.reduce((sum, m) => sum + (Number(m.progress) || 0), 0);
        return Math.round(total / milestonesList.length);
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

            <div className="space-y-3">
                {BASECAMP_TARGETS.map((target, idx) => {
                    const targetMilestones = getMilestonesForBasecamp(target);
                    const isExpanded = expandedSections.has(target);
                    const avgProgress = getAverageProgress(targetMilestones);
                    const progressColors = getProgressColor(avgProgress);
                    const colors = TARGET_COLORS[target] || TARGET_COLORS["Others"];
                    const IconComponent = TARGET_ICONS[target] || Wrench;
                    const completedCount = targetMilestones.filter(m => Number(m.progress) >= 100).length;

                    return (
                        <div 
                            key={target} 
                            className={clsx(
                                "bg-white rounded-xl border transition-all duration-300 overflow-hidden",
                                isExpanded 
                                    ? `border-blue-500 shadow-lg ring-1 ring-blue-500/10` 
                                    : "border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300"
                            )}
                            style={{ animationDelay: `${idx * 50}ms` }}
                        >
                            <button
                                onClick={() => toggleSection(target)}
                                className={clsx(
                                    "w-full flex items-center gap-4 p-4 text-left transition-all duration-200 relative group",
                                    isExpanded ? "bg-gradient-to-r from-blue-50/50 to-white" : "bg-white hover:bg-slate-50/50"
                                )}
                            >
                                {/* Left accent bar */}
                                <div className={clsx(
                                    "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 rounded-r-full",
                                    isExpanded ? `bg-gradient-to-b ${colors.gradient}` : "bg-transparent group-hover:bg-slate-200"
                                )} />
                                
                                {/* Icon */}
                                <div className={clsx(
                                    "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 shrink-0",
                                    isExpanded 
                                        ? `${colors.light} ${colors.text}` 
                                        : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                                )}>
                                    <IconComponent size={20} />
                                </div>

                                {/* Title + mini stats */}
                                <div className="flex-1 min-w-0">
                                    <h3 className={clsx(
                                        "font-bold text-sm sm:text-base leading-snug transition-colors",
                                        isExpanded ? "text-blue-900" : "text-slate-800"
                                    )}>
                                        {target}
                                    </h3>
                                    {targetMilestones.length > 0 && !isExpanded && (
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="text-xs text-slate-500">
                                                {completedCount}/{targetMilestones.length} completed
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Mini progress bar (collapsed only) */}
                                {targetMilestones.length > 0 && !isExpanded && (
                                    <div className="hidden sm:flex items-center gap-3 shrink-0 mr-4">
                                        <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={clsx("h-full rounded-full transition-all duration-500", progressColors.bar)}
                                                style={{ width: `${avgProgress}%` }}
                                            />
                                        </div>
                                        <span className={clsx("text-xs font-bold min-w-[32px] text-right", progressColors.text)}>
                                            {avgProgress}%
                                        </span>
                                    </div>
                                )}

                                {/* Chevron + count badge */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={clsx(
                                        "px-2.5 py-1 rounded-full text-xs font-black transition-all",
                                        isExpanded 
                                            ? `bg-gradient-to-r ${colors.gradient} text-white shadow-sm` 
                                            : "bg-slate-100 text-slate-600 border border-slate-200"
                                    )}>
                                        {targetMilestones.length}
                                    </span>
                                    <div className={clsx(
                                        "w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200",
                                        isExpanded ? "bg-blue-100 text-blue-600 rotate-0" : "bg-transparent text-slate-400"
                                    )}>
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </div>
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="p-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {targetMilestones.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400 italic bg-slate-50 rounded-lg border border-slate-100 border-dashed">
                                            No milestones linked to this target yet.
                                        </div>
                                    ) : (
                                        <>
                                            {/* Summary strip */}
                                            <div className="flex items-center gap-4 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <div className={clsx("w-2 h-2 rounded-full", progressColors.bar)} />
                                                    <span className="text-slate-500">Avg Progress:</span>
                                                    <span className={clsx("font-bold", progressColors.text)}>{avgProgress}%</span>
                                                </div>
                                                <div className="w-px h-4 bg-slate-200" />
                                                <div className="flex items-center gap-2 text-sm">
                                                    <CheckCircle2 size={14} className="text-emerald-500" />
                                                    <span className="text-slate-500">Completed:</span>
                                                    <span className="font-bold text-emerald-600">{completedCount}/{targetMilestones.length}</span>
                                                </div>
                                            </div>

                                            {viewMode === 'table' ? (
                                                <div className="overflow-x-auto rounded-lg border border-slate-200">
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
                                                            {targetMilestones.map(m => {
                                                                const mProgress = Number(m.progress) || 0;
                                                                const mColors = getProgressColor(mProgress);
                                                                return (
                                                                    <tr key={m.id} className="bg-white hover:bg-slate-50 transition-colors">
                                                                        <td className="px-4 py-3 font-medium text-slate-800">{m.title}</td>
                                                                        <td className="px-4 py-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden w-full max-w-[80px]">
                                                                                    <div
                                                                                        className={clsx("h-full rounded-full transition-all duration-500", mColors.bar)}
                                                                                        style={{ width: `${mProgress}%` }}
                                                                                    />
                                                                                </div>
                                                                                <span className={clsx("text-xs font-bold", mColors.text)}>{mProgress}%</span>
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
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {targetMilestones.map(m => {
                                                        const mProgress = Number(m.progress) || 0;
                                                        const mColors = getProgressColor(mProgress);
                                                        return (
                                                            <div key={m.id} className="p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3 bg-white hover:bg-slate-50/50 group">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <h4 className="font-bold text-slate-800 line-clamp-2" title={m.title}>{m.title}</h4>
                                                                    <span className={clsx(
                                                                        "text-xs font-bold px-2 py-0.5 rounded-full shrink-0",
                                                                        mColors.bg, mColors.text
                                                                    )}>
                                                                        {mProgress}%
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 w-full">
                                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={clsx("h-full rounded-full transition-all duration-500", mColors.bar)}
                                                                            style={{ width: `${mProgress}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {m.description && (
                                                                    <p className="text-sm text-slate-600 line-clamp-3 bg-slate-50/50 p-2 rounded border border-slate-100 italic">
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
                                                        );
                                                    })}
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
