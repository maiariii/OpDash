import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProjects, getDivisions, getAllMilestones, getProjectTasks, getBulkActivities } from '../api';
import { Folder, ArrowRight, Filter, ArrowUpDown, Flag, Layers, CheckSquare, LayoutGrid, List } from 'lucide-react';
import CreateProjectModal from '../components/CreateProjectModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { deleteProject } from '../api';
import { Trash2 } from 'lucide-react';
import clsx from 'clsx';

const colors = {
    blue: "#0284C7",
    gold: "#FBBF24",
    red: "#B91C1C",
    green: "#16A34A",
    purple: "#7C3AED",
    slate: "#475569",
    orange: "#EA580C",
    teal: "#0D9488"
};

const fundSources = [
    { label: "GAA-PS", full: "GAA - Personal Services", color: colors.purple, seg: "seg-purple" },
    { label: "GAA-MOOE", full: "GAA - Maintenance and Other Operating Expenses", color: colors.green, seg: "seg-green" },
    { label: "GMS", full: "GMS Allocation", color: colors.orange, seg: "seg-orange" },
    { label: "APB", full: "APB Allocation", color: colors.red, seg: "seg-red" },
    { label: "HRD", full: "Human Resource Development", color: colors.gold, seg: "seg-gold" },
    { label: "HRDP", full: "Human Resource Development Program", color: colors.teal, seg: "seg-teal" },
    { label: "Basic Education Inputs Program", full: "Basic Education Inputs Program", color: colors.slate, seg: "seg-slate" }
];

const fmt = v => Number(v || 0).toLocaleString("en-PH");
const peso = v => "₱" + Number(v || 0).toLocaleString("en-PH");
const pct = v => v.toFixed(0) + "%";

const getDivisionStyles = (divisionName) => {
    const name = (divisionName || '').toLowerCase();
    if (name.includes('personnel')) return 'division-badge division-personnel';
    if (name.includes('employee welfare')) return 'division-badge division-welfare';
    if (name.includes('human resource') || name.includes('hrod')) return 'division-badge division-hrod';
    if (name.includes('school effectiveness') || name.includes('effectiveness')) return 'division-badge division-effectiveness';
    return 'division-badge division-default';
};


const Projects = () => {
    const [projects, setProjects] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [projectStats, setProjectStats] = useState({}); // { projectId: { milestones: 0, activities: 0, tasks: 0 } }
    const [projectsWithTasks, setProjectsWithTasks] = useState([]);

    const [searchParams, setSearchParams] = useSearchParams();
    const divisionParam = searchParams.get('division') || '';
    const [selectedDivision, setSelectedDivision] = useState(divisionParam);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Distribution View Settings States
    const [distributionMode, setDistributionMode] = useState('status'); // 'status' | 'budget' | 'fund'
    const [unitMode, setUnitMode] = useState('count'); // 'count' | 'budget'
    const [distributionView, setDistributionView] = useState('bar'); // 'bar' | 'heatmap'

    const renderStackedSegments = (values, scale, classes, labels, formatValue = fmt) => {
        return values.map((v, i) => {
            const width = scale ? Math.max((v / scale) * 100, 0) : 0;
            if (v === 0) return null;
            const text = formatValue(v);
            const showText = width * 4.5 > text.length * 6;
            return (
                <div 
                    key={i}
                    className={`segment ${classes[i]}`} 
                    style={{ width: `${width}%` }} 
                    title={`${labels[i]}: ${text}`}
                >
                    {showText && <span>{text}</span>}
                </div>
            );
        });
    };

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
                const [loadedProjects, loadedDivisions, loadedMilestones, bulkData] = await Promise.all([
                    getProjects(),
                    getDivisions(),
                    getAllMilestones(),
                    getBulkActivities()
                ]);

                setDivisions(loadedDivisions);

                const allActivities = bulkData?.activities || [];
                const allSubtasks = bulkData?.subtasks || [];

                const newStats = {};
                const mappedProjectsWithTasks = loadedProjects.map(p => {
                    const pActivities = allActivities.filter(a => a.project_id === p.id);
                    const pTasks = pActivities.map(act => {
                        const subs = allSubtasks.filter(sub => sub.activity_id === act.id);
                        return { ...act, subtasks: subs };
                    });

                    const pMilestones = loadedMilestones.filter(m => m.project_id === p.id).length;
                    const activityCount = pTasks.length;
                    const subtaskCount = pTasks.reduce((acc, curr) => acc + (curr.subtasks?.length || 0), 0);

                    newStats[p.id] = {
                        milestones: pMilestones,
                        activities: activityCount,
                        tasks: subtaskCount
                    };

                    return { ...p, tasks: pTasks };
                });

                setProjects(mappedProjectsWithTasks);
                setProjectStats(newStats);
                setProjectsWithTasks(mappedProjectsWithTasks);

            } catch (err) {
                console.error("Failed to load projects data", err);
            }
        };

        loadData();
    }, []);

    const processedActivities = useMemo(() => {
        const list = [];
        projectsWithTasks.forEach(p => {
            const projectSourceOfFund = p.source_of_fund || 'GAA-PS';
            const projectTotalBudget = Number(p.sof_allocation || p.total_budget || 0);
            const tasksBudgetSum = p.tasks ? p.tasks.reduce((sum, t) => sum + (Number(t.allocation || t.gms_allocation) || 0), 0) : 0;

            if (p.tasks && p.tasks.length > 0) {
                p.tasks.forEach((t, idx) => {
                    let taskBudget = Number(t.allocation || t.gms_allocation || 0);
                    if (idx === 0) {
                        const unallocated = projectTotalBudget - tasksBudgetSum;
                        if (unallocated > 0) {
                            taskBudget += unallocated;
                        }
                    }

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const isAccomplished = t.status === 'Accomplished' || t.status === 'Done' || t.status === 'Completed';
                    const isOverdue = t.due_date && new Date(t.due_date) < today;
                    let resolvedStatus = 'Pending';
                    if (isAccomplished) {
                        resolvedStatus = 'Accomplished';
                    } else if (t.status === 'Delayed' || isOverdue) {
                        resolvedStatus = 'Delayed';
                    }

                    list.push({
                        id: t.id,
                        name: t.title,
                        division: p.division || 'Unassigned',
                        project: p.name,
                        status: resolvedStatus,
                        budget: taskBudget,
                        obligated: Number(t.obligated_amount || 0),
                        used: Number(t.obligated_amount || 0),
                        sourceOfFund: projectSourceOfFund,
                    });
                });
            } else {
                list.push({
                    id: `${p.id}-placeholder`,
                    name: 'Project Initialization',
                    division: p.division || 'Unassigned',
                    project: p.name,
                    status: 'Pending',
                    budget: projectTotalBudget,
                    obligated: 0,
                    used: 0,
                    sourceOfFund: projectSourceOfFund,
                });
            }
        });
        return list;
    }, [projectsWithTasks]);

    const activeActivities = useMemo(() => {
        if (selectedDivision) {
            return processedActivities.filter(a => a.division === selectedDivision);
        }
        return processedActivities;
    }, [processedActivities, selectedDivision]);

    const groupKey = selectedDivision ? 'project' : 'division';
    const groupedActivities = useMemo(() => {
        const groups = {};
        if (!selectedDivision) {
            divisions.forEach(d => {
                groups[d.name] = [];
            });
        }
        activeActivities.forEach(a => {
            const key = a[groupKey];
            if (!groups[key]) groups[key] = [];
            groups[key].push(a);
        });
        return groups;
    }, [activeActivities, groupKey, selectedDivision, divisions]);

    const metricValue = (rows) => {
        return unitMode === 'budget' ? rows.reduce((s, r) => s + r.budget, 0) : rows.length;
    };

    const metricFormat = (val) => {
        return unitMode === 'budget' ? peso(val) : fmt(val);
    };

    const maxTotal = useMemo(() => {
        const vals = Object.values(groupedActivities).map(r => {
            if (distributionMode === 'fund') {
                return fundSources.reduce((sum, f) => sum + metricValue(r.filter(a => a.sourceOfFund === f.label)), 0);
            } else if (distributionMode === 'budget') {
                return r.reduce((s, a) => s + a.budget, 0);
            } else {
                return r.length;
            }
        });
        return Math.max(...vals, 1);
    }, [groupedActivities, distributionMode, unitMode]);

    const maxBudgetTotal = useMemo(() => {
        const vals = Object.values(groupedActivities).map(r => r.reduce((s, a) => s + a.budget, 0));
        return Math.max(...vals, 1);
    }, [groupedActivities]);

    const totals = useMemo(() => {
        const tBudget = activeActivities.reduce((s, r) => s + r.budget, 0);
        const tObligated = activeActivities.reduce((s, r) => s + r.obligated, 0);
        const tUsed = activeActivities.reduce((s, r) => s + r.used, 0);
        const accomplishments = activeActivities.filter(r => r.status === 'Accomplished');
        const pending = activeActivities.filter(r => r.status === 'Pending');
        const delayed = activeActivities.filter(r => r.status === 'Delayed');

        return {
            budget: tBudget,
            obligated: tObligated,
            used: tUsed,
            accomplished: accomplishments,
            pending: pending,
            delayed: delayed
        };
    }, [activeActivities]);

    const donutData = useMemo(() => {
        if (distributionMode === 'budget') {
            return [
                { label: "Utilized", value: totals.used, color: colors.blue, format: "peso" },
                { label: "Unutilized", value: Math.max(totals.budget - totals.used, 0), color: colors.gold, format: "peso" }
            ];
        } else if (distributionMode === 'fund') {
            return fundSources.map(f => {
                const rows = activeActivities.filter(a => a.sourceOfFund === f.label);
                return { label: f.label, shortLabel: f.shortLabel || f.label, value: metricValue(rows), color: f.color };
            });
        } else {
            return [
                { label: "Pending", value: metricValue(totals.pending), color: colors.gold },
                { label: "Accomplished", value: metricValue(totals.accomplished), color: colors.green },
                { label: "Delayed", value: metricValue(totals.delayed), color: colors.red }
            ];
        }
    }, [distributionMode, totals, activeActivities, unitMode]);

    const donutTotal = useMemo(() => donutData.reduce((s, r) => s + r.value, 0) || 1, [donutData]);
    const donutFormat = (val) => donutData.some(r => r.format === 'peso') ? peso(val) : metricFormat(val);

    const donutStyle = useMemo(() => {
        let start = 0;
        const stops = donutData.map(r => {
            const p = (r.value / donutTotal) * 100;
            const s = `${r.color} ${start.toFixed(2)}% ${(start + p).toFixed(2)}%`;
            start += p;
            return s;
        });
        return {
            background: `conic-gradient(${stops.join(",")})`
        };
    }, [donutData, donutTotal]);

    const getBadgeStyle = () => {
        if (distributionMode === 'budget') return 'badge gold';
        if (distributionMode === 'fund') return 'badge purple';
        return 'badge';
    };

    const getBadgeText = () => {
        if (distributionMode === 'budget') return 'Budget Utilization';
        if (distributionMode === 'fund') return 'Sources of Fund';
        return 'Activity Status';
    };

    const metricLabel = () => {
        return unitMode === 'budget' ? "budget" : "activities";
    };

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

                <div className="flex items-center gap-3 flex-nowrap">
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

                    <select 
                        value={sortBy} 
                        onChange={(e) => setSortBy(e.target.value)} 
                        className="select" 
                        style={{ minWidth: '200px', margin: 0 }}
                    >
                        <option value="latest">Created Date (Newest First)</option>
                        <option value="oldest">Created Date (Oldest First)</option>
                        <option value="name_asc">Project Name (A - Z)</option>
                        <option value="name_desc">Project Name (Z - A)</option>
                    </select>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                        + New Project
                    </button>
                </div>
            </div>

            {/* Filter Panel (Copied from Dashboard) */}
            {selectedDivision && (
                <section className="card filters mb-6">
                    <div 
                        className="filter-grid"
                        style={{ gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))' }}
                    >
                        <label>
                            <span>Distribution by</span>
                            <select 
                                value={distributionMode} 
                                onChange={(e) => setDistributionMode(e.target.value)} 
                                className="select"
                            >
                                <option value="status">Activity status</option>
                                <option value="budget">Budget utilization</option>
                                <option value="fund">Sources of fund</option>
                            </select>
                        </label>
                        <label>
                            <span>Units</span>
                            <select 
                                value={unitMode} 
                                onChange={(e) => setUnitMode(e.target.value)} 
                                className="select"
                            >
                                <option value="count">Number of activities</option>
                                <option value="budget">Budget</option>
                            </select>
                        </label>
                        <p className="schema-note"><b>Executive intent:</b> division-specific performance and budget distribution metrics.</p>
                    </div>
                </section>
            )}

            {/* Distribution Graph Section (Copied from Dashboard) */}
            {filteredProjects.length > 0 && selectedDivision && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-6 items-stretch">
                    {/* Left side: Main bar/heatmap chart */}
                    <article className="card wide h-full md:col-span-3 animate-slide-in" id="distributionGraph" style={{ marginBottom: 0 }}>
                        <div className="section-head">
                            <div>
                                <h2 className="section-title">
                                    {selectedDivision ? `${selectedDivision} — Distribution by Project` : 'Distribution by Division'}
                                </h2>
                                <p className="subtext text-xs text-slate-500 font-bold">
                                    {selectedDivision ? 'Project-level distribution for the selected division.' : 'Primary comparison view. Select a division to view projects.'}
                                </p>
                            </div>
                            <div className="flex gap-2 items-center flex-wrap">
                                <button 
                                    onClick={() => setDistributionView(prev => prev === 'bar' ? 'heatmap' : 'bar')}
                                    className="mini-button hover:opacity-90 px-3 py-1 bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-lg"
                                >
                                    {distributionView === 'bar' ? 'Heatmap' : 'Stacked bar'}
                                </button>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="legend mb-4">
                            {distributionMode === 'budget' && (
                                <>
                                    <span className="legend-item"><i className="dot bg-[#0284C7]" />Utilized</span>
                                    <span className="legend-item"><i className="dot bg-[#FBBF24]" />Unutilized</span>
                                </>
                            )}
                            {distributionMode === 'fund' && fundSources.map(f => (
                                <span key={f.label} className="legend-item"><i className="dot" style={{ background: f.color }} />{f.label}</span>
                            ))}
                            {distributionMode === 'status' && (
                                <>
                                    <span className="legend-item"><i className="dot bg-[#FBBF24]" />Pending</span>
                                    <span className="legend-item"><i className="dot bg-[#16A34A]" />Accomplished</span>
                                    <span className="legend-item"><i className="dot bg-[#B91C1C]" />Delayed</span>
                                </>
                            )}
                        </div>

                        {/* Bars or Heatmap View */}
                        {distributionView === 'bar' ? (
                            <div className="bars space-y-3">
                                {Object.entries(groupedActivities).map(([d, r]) => {
                                    const totalVal = metricValue(r);
                                    return (
                                        <div 
                                            key={d} 
                                            onClick={() => !selectedDivision && handleDivisionChange(d)}
                                            className="bar-row"
                                            style={!selectedDivision ? { cursor: 'pointer' } : {}}
                                            title={!selectedDivision ? "Click to view projects" : ""}
                                        >
                                            <span>{d}</span>
                                            <div className="track flex">
                                                {distributionMode === 'budget' && (() => {
                                                    const u = r.reduce((s, a) => s + a.used, 0);
                                                    const b = r.reduce((s, a) => s + a.budget, 0);
                                                    return renderStackedSegments(
                                                        [u, Math.max(b - u, 0)],
                                                        maxBudgetTotal,
                                                        ["seg-blue", "seg-gold"],
                                                        ["Utilized", "Unutilized"],
                                                        peso
                                                    );
                                                })()}
                                                {distributionMode === 'fund' && (() => {
                                                    const vals = fundSources.map(f => metricValue(r.filter(a => a.sourceOfFund === f.label)));
                                                    return renderStackedSegments(
                                                        vals,
                                                        maxTotal,
                                                        fundSources.map(f => f.seg),
                                                        fundSources.map(f => f.label),
                                                        metricFormat
                                                    );
                                                })()}
                                                {distributionMode === 'status' && (() => {
                                                    const p = metricValue(r.filter(a => a.status === 'Pending'));
                                                    const acc = metricValue(r.filter(a => a.status === 'Accomplished'));
                                                    const del = metricValue(r.filter(a => a.status === 'Delayed'));
                                                    return renderStackedSegments(
                                                        [p, acc, del],
                                                        maxTotal,
                                                        ["seg-gold", "seg-green", "seg-red"],
                                                        ["Pending", "Accomplished", "Delayed"],
                                                        metricFormat
                                                    );
                                                })()}
                                            </div>
                                            <b>{metricFormat(totalVal)}</b>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div 
                                className="fund-heatmap overflow-x-auto grid gap-2 mt-4"
                                style={{ '--heat-cols': distributionMode === 'fund' ? fundSources.length : (distributionMode === 'budget' ? 2 : 3) }}
                            >
                                <div className="heat-cell heat-empty"></div>
                                {distributionMode === 'budget' && (
                                    <>
                                        <div className="heat-cell heat-head">Utilized</div>
                                        <div className="heat-cell heat-head">Unutilized</div>
                                    </>
                                )}
                                {distributionMode === 'fund' && fundSources.map(f => (
                                    <div key={f.label} className="heat-cell heat-head" title={f.full}>{f.label}</div>
                                ))}
                                {distributionMode === 'status' && (
                                    <>
                                        <div className="heat-cell heat-head">Pending</div>
                                        <div className="heat-cell heat-head">Accomplished</div>
                                        <div className="heat-cell heat-head">Delayed</div>
                                    </>
                                )}
                                <div className="heat-cell heat-head">Total</div>

                                {/* Group rows */}
                                {Object.entries(groupedActivities).map(([d, r]) => {
                                    const totalVal = metricValue(r);
                                    const cells = [];

                                    if (distributionMode === 'budget') {
                                        const u = r.reduce((s, a) => s + a.used, 0);
                                        const b = r.reduce((s, a) => s + a.budget, 0);
                                        const un = Math.max(b - u, 0);

                                        const maxVal = Math.max(...Object.values(groupedActivities).flatMap(g => {
                                            const gu = g.reduce((s, a) => s + a.used, 0);
                                            const gb = g.reduce((s, a) => s + a.budget, 0);
                                            return [gu, Math.max(gb - gu, 0)];
                                        }), 1);

                                        const uIntensity = u / maxVal;
                                        const unIntensity = un / maxVal;

                                        cells.push(
                                            <div key="u" className={`heat-cell ${u === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.blue} ${Math.round(16 + uIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.blue} 48%, #DBEAFE)`, color: uIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{peso(u)}</div>,
                                            <div key="un" className={`heat-cell ${un === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.gold} ${Math.round(16 + unIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.gold} 48%, #DBEAFE)`, color: unIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{peso(un)}</div>
                                        );
                                    } else if (distributionMode === 'fund') {
                                        const maxVal = Math.max(...Object.values(groupedActivities).flatMap(g => 
                                            fundSources.map(f => metricValue(g.filter(a => a.sourceOfFund === f.label)))
                                        ), 1);

                                        fundSources.forEach(f => {
                                            const v = metricValue(r.filter(a => a.sourceOfFund === f.label));
                                            const intensity = v / maxVal;
                                            cells.push(
                                                <div key={f.label} className={`heat-cell ${v === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${f.color} ${Math.round(16 + intensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${f.color} 48%, #DBEAFE)`, color: intensity > 0.58 ? 'white' : 'var(--navy)' }}>{metricFormat(v)}</div>
                                            );
                                        });
                                    } else {
                                        const p = metricValue(r.filter(a => a.status === 'Pending'));
                                        const acc = metricValue(r.filter(a => a.status === 'Accomplished'));
                                        const del = metricValue(r.filter(a => a.status === 'Delayed'));

                                        const maxVal = Math.max(...Object.values(groupedActivities).flatMap(g => {
                                            const gp = metricValue(g.filter(a => a.status === 'Pending'));
                                            const gacc = metricValue(g.filter(a => a.status === 'Accomplished'));
                                            const gdel = metricValue(g.filter(a => a.status === 'Delayed'));
                                            return [gp, gacc, gdel];
                                        }), 1);

                                        const pIntensity = p / maxVal;
                                        const accIntensity = acc / maxVal;
                                        const delIntensity = del / maxVal;

                                        cells.push(
                                            <div key="p" className={`heat-cell ${p === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.gold} ${Math.round(16 + pIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.gold} 48%, #DBEAFE)`, color: pIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{metricFormat(p)}</div>,
                                            <div key="acc" className={`heat-cell ${acc === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.green} ${Math.round(16 + accIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.green} 48%, #DBEAFE)`, color: accIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{metricFormat(acc)}</div>,
                                            <div key="del" className={`heat-cell ${del === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.red} ${Math.round(16 + delIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.red} 48%, #DBEAFE)`, color: delIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{metricFormat(del)}</div>
                                        );
                                    }

                                    return (
                                        <React.Fragment key={d}>
                                            <div 
                                                className="heat-cell heat-division font-bold"
                                            >
                                                {d}
                                            </div>
                                            {cells}
                                            <div className="heat-cell heat-total font-bold">{metricFormat(totalVal)}</div>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        )}
                    </article>

                    {/* Right side: Histogram Details and Donut Snapshot stacked vertically */}
                    <div className="md:col-span-2 flex flex-col gap-5 h-full justify-between">
                        {/* Histogram Details */}
                        <article className="card flex-1 flex flex-col justify-between animate-slide-in" id="distributionDetails" style={{ marginBottom: 0 }}>
                            <div className="section-head">
                                <div>
                                    <h2 className="section-title">Distribution Details</h2>
                                    <p className="subtext text-xs text-slate-500 font-bold">Histogram showing active metrics.</p>
                                </div>
                                <span className={getBadgeStyle()}>{getBadgeText()}</span>
                            </div>

                            <div className="histogram" style={{ '--cols': donutData.length }}>
                                {donutData.map((d, i) => {
                                    const maxVal = Math.max(...donutData.map(x => x.value), 1);
                                    const hPct = Math.max((d.value / maxVal) * 100, 8);
                                    return (
                                        <div key={i} className="hist-col">
                                            <div className="hist-area">
                                                <div className="hist-bar-wrap" style={{ height: `${hPct}%` }}>
                                                    <div className="hist-value">{donutFormat(d.value)}</div>
                                                    <div 
                                                        className="hist-bar" 
                                                        style={{ 
                                                            height: d.value === 0 ? '8px' : 'calc(100% - 22px)', 
                                                            minHeight: d.value === 0 ? '8px' : '16px',
                                                            backgroundColor: d.color 
                                                        }} 
                                                    />
                                                </div>
                                            </div>
                                            <div className="hist-label" title={d.label}>
                                                {d.shortLabel || d.label}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </article>

                        {/* Donut Snapshot Chart */}
                        <article className="card flex-1 flex flex-col justify-between animate-slide-in" id="distributionPanel" style={{ marginBottom: 0 }}>
                            <div className="section-head">
                                <div>
                                    <h2 className="section-title">Distribution Snapshot</h2>
                                    <p className="subtext text-xs text-slate-500 font-bold">Overview breakdown and percentage shares.</p>
                                </div>
                                <span className={getBadgeStyle()}>{getBadgeText()}</span>
                            </div>

                            <div className="donut-layout">
                                <div className="donut" style={donutStyle}>
                                    <div className="donut-center">
                                        <span>{donutFormat(donutTotal)}</span>
                                        <small className="text-[9px] uppercase tracking-wide text-slate-400 mt-0.5" style={{ display: 'block' }}>{metricLabel()}</small>
                                    </div>
                                </div>
                                <div id="distributionDonutTable" className="flex-1 w-full">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Segment</th>
                                                <th>Value</th>
                                                <th>Share</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {donutData.map((d, i) => (
                                                <tr key={i}>
                                                    <td>
                                                        <span className="dot" style={{ backgroundColor: d.color, marginRight: '7px' }} />
                                                        {d.label}
                                                    </td>
                                                    <td><b>{donutFormat(d.value)}</b></td>
                                                    <td><b>{pct((d.value / donutTotal) * 100)}</b></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </article>
                    </div>
                </div>
            )}

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
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${getDivisionStyles(project.division)}`}>
                                            {project.division || 'No Division'}
                                        </span>
                                        <span className={clsx("text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                                            project.status === 'Accomplished' ? 'bg-green-100 text-green-700 border-green-200' :
                                            project.status === 'In Progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                            project.status === 'Deferred' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                            project.status === 'Cancelled' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                                        )}>
                                            {project.status || 'Planning'}
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
                                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">Status</th>
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
                                                    <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getDivisionStyles(project.division)}`}>
                                                        {project.division || 'No Division'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={clsx("text-xs font-semibold px-2.5 py-1 rounded-full border uppercase tracking-wider",
                                                        project.status === 'Accomplished' ? 'bg-green-100 text-green-700 border-green-200' :
                                                        project.status === 'In Progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                        project.status === 'Deferred' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                        project.status === 'Cancelled' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                                                    )}>
                                                        {project.status || 'Planning'}
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
