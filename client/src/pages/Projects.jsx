import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProjects, getDivisions, getAllMilestones, getProjectTasks, getBulkActivities } from '../api';
import { Folder, ArrowRight, Filter, ArrowUpDown, Flag, Layers, CheckSquare, LayoutGrid, List, Search } from 'lucide-react';
import CreateProjectModal from '../components/CreateProjectModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { deleteProject } from '../api';
import { Trash2, Settings, Activity } from 'lucide-react';
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

    // Advanced Data Controls & Category Picker
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState(null);
    const [categorySearchQuery, setCategorySearchQuery] = useState('');
    const [categorySortMode, setCategorySortMode] = useState('value');
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

    // Per-card split states
    const [mainSplitBy, setMainSplitBy] = useState('status');
    const [detailsSplitBy, setDetailsSplitBy] = useState('status');

    // Sync per-card split states with global distributionMode
    useEffect(() => {
        setMainSplitBy(distributionMode);
        setDetailsSplitBy(distributionMode);
    }, [distributionMode]);

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

    // Available categories dynamically based on distributionMode
    const availableCategories = useMemo(() => {
        if (distributionMode === 'status') {
            return [
                { id: 'Pending', label: 'Pending', count: activeActivities.filter(a => a.status === 'Pending').length, value: activeActivities.filter(a => a.status === 'Pending').reduce((s, a) => s + a.budget, 0) },
                { id: 'Accomplished', label: 'Accomplished', count: activeActivities.filter(a => a.status === 'Accomplished').length, value: activeActivities.filter(a => a.status === 'Accomplished').reduce((s, a) => s + a.budget, 0) },
                { id: 'Delayed', label: 'Delayed', count: activeActivities.filter(a => a.status === 'Delayed').length, value: activeActivities.filter(a => a.status === 'Delayed').reduce((s, a) => s + a.budget, 0) },
            ];
        } else if (distributionMode === 'budget') {
            const uCount = activeActivities.filter(a => a.used > 0).length;
            const uVal = activeActivities.reduce((s, a) => s + a.used, 0);
            const unCount = activeActivities.filter(a => (a.budget - a.used) > 0).length;
            const unVal = activeActivities.reduce((s, a) => s + Math.max(a.budget - a.used, 0), 0);
            return [
                { id: 'Utilized', label: 'Utilized', count: uCount, value: uVal },
                { id: 'Unutilized', label: 'Unutilized', count: unCount, value: unVal }
            ];
        } else { // 'fund'
            return fundSources.map(f => {
                const rows = activeActivities.filter(a => a.sourceOfFund === f.label);
                return {
                    id: f.label,
                    label: f.label,
                    count: rows.length,
                    value: rows.reduce((s, a) => s + a.budget, 0)
                };
            });
        }
    }, [distributionMode, activeActivities, fundSources]);

    // Active Category IDs with Default logic (Top 5 when > 5 items)
    const activeCategoryIds = useMemo(() => {
        if (selectedCategories !== null) {
            return selectedCategories;
        }
        if (availableCategories.length > 5) {
            const sorted = [...availableCategories].sort((a, b) => b.value - a.value);
            return sorted.slice(0, 5).map(c => c.id);
        }
        return availableCategories.map(c => c.id);
    }, [availableCategories, selectedCategories]);

    // Filtered categories shown inside the picker modal
    const modalFilteredCategories = useMemo(() => {
        let list = availableCategories.filter(cat => 
            cat.label.toLowerCase().includes(categorySearchQuery.toLowerCase())
        );
        if (categorySortMode === 'value') {
            list.sort((a, b) => b.value - a.value);
        } else {
            list.sort((a, b) => a.label.localeCompare(b.label));
        }
        return list;
    }, [availableCategories, categorySearchQuery, categorySortMode]);


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

    const activityDonutData = useMemo(() => {
        return [
            { label: "Pending", value: totals.pending.length, color: colors.gold },
            { label: "Accomplished", value: totals.accomplished.length, color: colors.green },
            { label: "Delayed", value: totals.delayed.length, color: colors.red }
        ];
    }, [totals]);

    const activityDonutTotal = useMemo(() => activityDonutData.reduce((s, r) => s + r.value, 0) || 1, [activityDonutData]);

    const activityDonutStyle = useMemo(() => {
        let start = 0;
        const stops = activityDonutData.map(r => {
            const p = (r.value / activityDonutTotal) * 100;
            const s = `${r.color} ${start.toFixed(2)}% ${(start + p).toFixed(2)}%`;
            start += p;
            return s;
        });
        return {
            background: `conic-gradient(${stops.join(",")})`
        };
    }, [activityDonutData, activityDonutTotal]);

    const financialDonutData = useMemo(() => {
        return [
            { label: "Utilized", value: totals.used, color: colors.blue },
            { label: "Unutilized", value: Math.max(totals.budget - totals.used, 0), color: colors.gold }
        ];
    }, [totals]);

    const financialDonutTotal = useMemo(() => financialDonutData.reduce((s, r) => s + r.value, 0) || 1, [financialDonutData]);

    const financialDonutStyle = useMemo(() => {
        let start = 0;
        const stops = financialDonutData.map(r => {
            const p = (r.value / financialDonutTotal) * 100;
            const s = `${r.color} ${start.toFixed(2)}% ${(start + p).toFixed(2)}%`;
            start += p;
            return s;
        });
        return {
            background: `conic-gradient(${stops.join(",")})`
        };
    }, [financialDonutData, financialDonutTotal]);

    const getBadgeStyle = (mode = distributionMode) => {
        if (mode === 'budget') return 'badge gold';
        if (mode === 'fund') return 'badge purple';
        return 'badge';
    };

    const getBadgeText = (mode = distributionMode) => {
        if (mode === 'budget') return 'Budget Utilization';
        if (mode === 'fund') return 'Sources of Fund';
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

    const [projectSearch, setProjectSearch] = useState('');

    const filteredProjects = projects.filter(p => {
        const matchesDivision = !selectedDivision || p.division === selectedDivision;
        const matchesSearch = !projectSearch || 
            (p.name || '').toLowerCase().includes(projectSearch.toLowerCase()) ||
            (p.description || '').toLowerCase().includes(projectSearch.toLowerCase()) ||
            (p.lead_personnel || '').toLowerCase().includes(projectSearch.toLowerCase());
        return matchesDivision && matchesSearch;
    });

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
                    <div className="relative flex items-center">
                        <Search size={16} className="absolute left-3 text-slate-400 pointer-events-none" />
                        <input
                            type="search"
                            placeholder="Search projects..."
                            value={projectSearch}
                            onChange={(e) => setProjectSearch(e.target.value)}
                            className="column-filter"
                            style={{ width: '220px', height: '38px', margin: 0, paddingLeft: '32px' }}
                        />
                    </div>
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

            {/* Filter Panel (Upgraded Data Controls) */}
            {selectedDivision && (() => {
                const resetFilters = () => {
                    setDistributionMode('status');
                    setUnitMode('count');
                    setSelectedCategories(null);
                };

                return (
                    <section className="card filters mb-6">
                        <div className="card-inner">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div>
                                    <h2 className="section-title mb-0 flex items-center gap-2" style={{ marginBottom: 0 }}>
                                        <Activity className="text-blue-600 w-5 h-5" /> Data Controls
                                    </h2>
                                    <p className="subtext text-xs text-slate-500 font-bold">
                                        Filter records, configure active distribution categories, switch unit aggregation, and reset the view.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                                    <button
                                        id="resetBtn"
                                        type="button"
                                        onClick={resetFilters}
                                        className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                        style={{ background: 'none' }}
                                    >
                                        Reset
                                    </button>
                                    <button
                                        id="advancedToggle"
                                        type="button"
                                        onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                                        className={clsx(
                                            "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
                                            isAdvancedMode 
                                                ? "bg-sky-600 hover:bg-sky-700 text-white" 
                                                : "bg-amber-400 hover:bg-amber-500 text-slate-900"
                                        )}
                                    >
                                        {isAdvancedMode ? 'Toggle Basic Mode' : 'Toggle Advanced Mode'}
                                    </button>
                                </div>
                            </div>

                            {/* Basic Filters Subcard */}
                            <div className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-xl p-4 mb-4">
                                <div className="grid grid-cols-1 gap-4">
                                    <label className="flex flex-col gap-1.5 w-full">
                                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Division</span>
                                        <select 
                                            value={selectedDivision} 
                                            onChange={(e) => handleDivisionChange(e.target.value)} 
                                            className="select w-full"
                                            style={{ margin: 0 }}
                                        >
                                            <option value="">All Divisions</option>
                                            {divisions.map(d => d.name).sort().map(div => (
                                                <option key={div} value={div}>{div}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            </div>

                            {/* Advanced Controls Card (Highlight Treatment) */}
                            {isAdvancedMode && (
                                <div className="bg-amber-500/5 border-2 border-amber-400/40 rounded-xl p-4 animate-fadeIn">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3" style={{ color: 'var(--navy)' }}>
                                        Advanced Controls
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Distribution by</span>
                                            <div className="flex gap-2">
                                                <select
                                                    value={distributionMode}
                                                    onChange={(e) => {
                                                        setDistributionMode(e.target.value);
                                                        setSelectedCategories(null);
                                                    }}
                                                    className="select flex-1"
                                                    style={{ margin: 0 }}
                                                >
                                                    <option value="status">Activity status</option>
                                                    <option value="budget">Budget utilization</option>
                                                    <option value="fund">Sources of fund</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsCategoryModalOpen(true)}
                                                    className="p-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-805 hover:bg-slate-55 text-slate-600 dark:text-slate-350 rounded-lg cursor-pointer flex items-center justify-center"
                                                    title="Configure values picker"
                                                >
                                                    <Settings size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Units</span>
                                            <select
                                                value={unitMode}
                                                onChange={(e) => setUnitMode(e.target.value)}
                                                className="select w-full"
                                                style={{ margin: 0 }}
                                            >
                                                <option value="count">Number of activities</option>
                                                <option value="budget">Budget</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                );
            })()}

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
                                <select
                                    value={mainSplitBy}
                                    onChange={(e) => setMainSplitBy(e.target.value)}
                                    className="select py-1 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                                    style={{ width: 'auto', minWidth: '120px', margin: 0 }}
                                >
                                    <option value="status">Split by Status</option>
                                    <option value="budget">Split by Budget</option>
                                    <option value="fund">Split by Fund</option>
                                </select>
                                <button 
                                    onClick={() => setDistributionView(prev => prev === 'bar' ? 'heatmap' : 'bar')}
                                    className="mini-button hover:opacity-90 px-3 py-1 bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-lg"
                                >
                                    {distributionView === 'bar' ? 'Heatmap' : 'Stacked bar'}
                                </button>
                                <span className={getBadgeStyle(mainSplitBy)}>{getBadgeText(mainSplitBy)}</span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="legend mb-4">
                            {mainSplitBy === 'budget' && (
                                <>
                                    {(!isAdvancedMode || distributionMode !== 'budget' || activeCategoryIds.includes('Utilized')) && (
                                        <span className="legend-item"><i className="dot bg-[#0284C7]" />Utilized</span>
                                    )}
                                    {(!isAdvancedMode || distributionMode !== 'budget' || activeCategoryIds.includes('Unutilized')) && (
                                        <span className="legend-item"><i className="dot bg-[#FBBF24]" />Unutilized</span>
                                    )}
                                </>
                            )}
                            {mainSplitBy === 'fund' && fundSources.map(f => {
                                if (isAdvancedMode && distributionMode === 'fund' && !activeCategoryIds.includes(f.label)) return null;
                                return (
                                    <span key={f.label} className="legend-item"><i className="dot" style={{ background: f.color }} />{f.label}</span>
                                );
                            })}
                            {mainSplitBy === 'status' && (
                                <>
                                    {(!isAdvancedMode || distributionMode !== 'status' || activeCategoryIds.includes('Pending')) && (
                                        <span className="legend-item"><i className="dot bg-[#FBBF24]" />Pending</span>
                                    )}
                                    {(!isAdvancedMode || distributionMode !== 'status' || activeCategoryIds.includes('Accomplished')) && (
                                        <span className="legend-item"><i className="dot bg-[#16A34A]" />Accomplished</span>
                                    )}
                                    {(!isAdvancedMode || distributionMode !== 'status' || activeCategoryIds.includes('Delayed')) && (
                                        <span className="legend-item"><i className="dot bg-[#B91C1C]" />Delayed</span>
                                    )}
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
                                                {mainSplitBy === 'budget' && (() => {
                                                    const u = r.reduce((s, a) => s + a.used, 0);
                                                    const b = r.reduce((s, a) => s + a.budget, 0);
                                                    const un = Math.max(b - u, 0);

                                                    const isFilterActive = isAdvancedMode && distributionMode === 'budget';
                                                    const uVal = (!isFilterActive || activeCategoryIds.includes('Utilized')) ? u : 0;
                                                    const unVal = (!isFilterActive || activeCategoryIds.includes('Unutilized')) ? un : 0;

                                                    return renderStackedSegments(
                                                        [uVal, unVal],
                                                        maxBudgetTotal,
                                                        ["seg-blue", "seg-gold"],
                                                        ["Utilized", "Unutilized"],
                                                        peso
                                                    );
                                                })()}
                                                {mainSplitBy === 'fund' && (() => {
                                                    const isFilterActive = isAdvancedMode && distributionMode === 'fund';
                                                    const vals = fundSources.map(f => {
                                                        const val = metricValue(r.filter(a => a.sourceOfFund === f.label));
                                                        return (!isFilterActive || activeCategoryIds.includes(f.label)) ? val : 0;
                                                    });
                                                    return renderStackedSegments(
                                                        vals,
                                                        maxTotal,
                                                        fundSources.map(f => f.seg),
                                                        fundSources.map(f => f.label),
                                                        metricFormat
                                                    );
                                                })()}
                                                {mainSplitBy === 'status' && (() => {
                                                    const p = metricValue(r.filter(a => a.status === 'Pending'));
                                                    const acc = metricValue(r.filter(a => a.status === 'Accomplished'));
                                                    const del = metricValue(r.filter(a => a.status === 'Delayed'));

                                                    const isFilterActive = isAdvancedMode && distributionMode === 'status';
                                                    const pVal = (!isFilterActive || activeCategoryIds.includes('Pending')) ? p : 0;
                                                    const accVal = (!isFilterActive || activeCategoryIds.includes('Accomplished')) ? acc : 0;
                                                    const delVal = (!isFilterActive || activeCategoryIds.includes('Delayed')) ? del : 0;

                                                    return renderStackedSegments(
                                                        [pVal, accVal, delVal],
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
                        ) : (() => {
                            const isBudget = mainSplitBy === 'budget';
                            const isFund = mainSplitBy === 'fund';
                            const isStatus = mainSplitBy === 'status';

                            const visibleFundSources = fundSources.filter(f => 
                                !isAdvancedMode || distributionMode !== 'fund' || activeCategoryIds.includes(f.label)
                            );
                            
                            const isBudgetUtilizedVisible = !isAdvancedMode || distributionMode !== 'budget' || activeCategoryIds.includes('Utilized');
                            const isBudgetUnutilizedVisible = !isAdvancedMode || distributionMode !== 'budget' || activeCategoryIds.includes('Unutilized');
                            
                            const isStatusPendingVisible = !isAdvancedMode || distributionMode !== 'status' || activeCategoryIds.includes('Pending');
                            const isStatusAccomplishedVisible = !isAdvancedMode || distributionMode !== 'status' || activeCategoryIds.includes('Accomplished');
                            const isStatusDelayedVisible = !isAdvancedMode || distributionMode !== 'status' || activeCategoryIds.includes('Delayed');

                            let colCount = 0;
                            if (isBudget) {
                                if (isBudgetUtilizedVisible) colCount++;
                                if (isBudgetUnutilizedVisible) colCount++;
                            } else if (isStatus) {
                                if (isStatusPendingVisible) colCount++;
                                if (isStatusAccomplishedVisible) colCount++;
                                if (isStatusDelayedVisible) colCount++;
                            } else {
                                colCount = visibleFundSources.length;
                            }

                            return (
                                <div 
                                    className="fund-heatmap overflow-x-auto grid gap-2 mt-4"
                                    style={{ '--heat-cols': colCount }}
                                >
                                    <div className="heat-cell heat-empty"></div>
                                    {isBudget && (
                                        <>
                                            {isBudgetUtilizedVisible && <div className="heat-cell heat-head">Utilized</div>}
                                            {isBudgetUnutilizedVisible && <div className="heat-cell heat-head">Unutilized</div>}
                                        </>
                                    )}
                                    {isFund && visibleFundSources.map(f => (
                                        <div key={f.label} className="heat-cell heat-head" title={f.full}>{f.label}</div>
                                    ))}
                                    {isStatus && (
                                        <>
                                            {isStatusPendingVisible && <div className="heat-cell heat-head">Pending</div>}
                                            {isStatusAccomplishedVisible && <div className="heat-cell heat-head">Accomplished</div>}
                                            {isStatusDelayedVisible && <div className="heat-cell heat-head">Delayed</div>}
                                        </>
                                    )}
                                    <div className="heat-cell heat-head">Total</div>

                                    {/* Group rows */}
                                    {Object.entries(groupedActivities).map(([d, r]) => {
                                        const totalVal = metricValue(r);
                                        const cells = [];

                                        if (isBudget) {
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

                                            if (isBudgetUtilizedVisible) {
                                                cells.push(
                                                    <div key="u" className={`heat-cell ${u === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.blue} ${Math.round(16 + uIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.blue} 48%, #DBEAFE)`, color: uIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{peso(u)}</div>
                                                );
                                            }
                                            if (isBudgetUnutilizedVisible) {
                                                cells.push(
                                                    <div key="un" className={`heat-cell ${un === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.gold} ${Math.round(16 + unIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.gold} 48%, #DBEAFE)`, color: unIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{peso(un)}</div>
                                                );
                                            }
                                        } else if (isFund) {
                                            const maxVal = Math.max(...Object.values(groupedActivities).flatMap(g => 
                                                visibleFundSources.map(f => metricValue(g.filter(a => a.sourceOfFund === f.label)))
                                            ), 1);

                                            visibleFundSources.forEach(f => {
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

                                            if (isStatusPendingVisible) {
                                                cells.push(
                                                    <div key="p" className={`heat-cell ${p === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.gold} ${Math.round(16 + pIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.gold} 48%, #DBEAFE)`, color: pIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{metricFormat(p)}</div>
                                                );
                                            }
                                            if (isStatusAccomplishedVisible) {
                                                cells.push(
                                                    <div key="acc" className={`heat-cell ${acc === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.green} ${Math.round(16 + accIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.green} 48%, #DBEAFE)`, color: accIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{metricFormat(acc)}</div>
                                                );
                                            }
                                            if (isStatusDelayedVisible) {
                                                cells.push(
                                                    <div key="del" className={`heat-cell ${del === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.red} ${Math.round(16 + delIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.red} 48%, #DBEAFE)`, color: delIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{metricFormat(del)}</div>
                                                );
                                            }
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
                            );
                        })()}
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
                                <div className="flex gap-2 items-center flex-wrap">
                                    <select
                                        value={detailsSplitBy}
                                        onChange={(e) => setDetailsSplitBy(e.target.value)}
                                        className="select py-1 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                                        style={{ width: 'auto', minWidth: '120px', margin: 0 }}
                                    >
                                        <option value="status">Split by Status</option>
                                        <option value="budget">Split by Budget</option>
                                        <option value="fund">Split by Fund</option>
                                    </select>
                                    <span className={getBadgeStyle(detailsSplitBy)}>{getBadgeText(detailsSplitBy)}</span>
                                </div>
                            </div>

                            {(() => {
                                const detailsData = (() => {
                                    let segments = [];
                                    if (detailsSplitBy === 'budget') {
                                        segments = [
                                            { label: "Utilized", value: totals.used, color: colors.blue, format: "peso" },
                                            { label: "Unutilized", value: Math.max(totals.budget - totals.used, 0), color: colors.gold, format: "peso" }
                                        ];
                                    } else if (detailsSplitBy === 'fund') {
                                        segments = fundSources.map(f => {
                                            const rows = activeActivities.filter(a => a.sourceOfFund === f.label);
                                            return { label: f.label, shortLabel: f.shortLabel || f.label, value: metricValue(rows), color: f.color };
                                        });
                                    } else {
                                        segments = [
                                            { label: "Pending", value: metricValue(totals.pending), color: colors.gold },
                                            { label: "Accomplished", value: metricValue(totals.accomplished), color: colors.green },
                                            { label: "Delayed", value: metricValue(totals.delayed), color: colors.red }
                                        ];
                                    }
                                    if (detailsSplitBy === distributionMode && isAdvancedMode) {
                                        segments = segments.filter(d => activeCategoryIds.includes(d.label));
                                    }
                                    return segments;
                                })();

                                const detailsFormat = (val) => detailsData.some(r => r.format === 'peso') ? peso(val) : metricFormat(val);
                                const maxVal = Math.max(...detailsData.map(x => x.value), 1);

                                return (
                                    <div className="histogram" style={{ '--cols': detailsData.length }}>
                                        {detailsData.map((d, i) => {
                                            const hPct = Math.max((d.value / maxVal) * 100, 8);
                                            return (
                                                <div key={i} className="hist-col">
                                                    <div className="hist-area">
                                                        <div className="hist-bar-wrap" style={{ height: `${hPct}%` }}>
                                                            <div className="hist-value">{detailsFormat(d.value)}</div>
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
                                );
                            })()}
                        </article>

                        {/* Donut Snapshot Chart */}
                        <article className="card flex-1 flex flex-col justify-between animate-slide-in" id="distributionPanel" style={{ marginBottom: 0 }}>
                            <div className="section-head">
                                <div>
                                    <h2 className="section-title">Accomplishment Snapshot</h2>
                                    <p className="subtext text-xs text-slate-500 font-bold">Activity and Financial breakdowns side-by-side.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4">
                                {/* Activities Accomplishment */}
                                <div className="flex flex-col items-center">
                                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Activities Accomplishment</h3>
                                    <div className="donut-layout flex-col items-center gap-4 w-full">
                                        <div className="donut" style={activityDonutStyle}>
                                            <div className="donut-center">
                                                <span>{activityDonutTotal}</span>
                                                <small className="text-[9px] uppercase tracking-wide text-slate-400 mt-0.5" style={{ display: 'block' }}>activities</small>
                                            </div>
                                        </div>
                                        <div id="activityDonutTable" className="w-full text-xs">
                                            <table className="w-full">
                                                <thead>
                                                    <tr>
                                                        <th>Status</th>
                                                        <th className="text-right">Count</th>
                                                        <th className="text-right">Share</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {activityDonutData.map((d, i) => (
                                                        <tr key={i}>
                                                            <td>
                                                                <span className="dot" style={{ backgroundColor: d.color, marginRight: '7px' }} />
                                                                {d.label}
                                                            </td>
                                                            <td className="text-right"><b>{fmt(d.value)}</b></td>
                                                            <td className="text-right"><b>{pct((d.value / activityDonutTotal) * 100)}</b></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Financial Accomplishment */}
                                <div className="flex flex-col items-center border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6">
                                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Financial Accomplishment</h3>
                                    <div className="donut-layout flex-col items-center gap-4 w-full">
                                        <div className="donut" style={financialDonutStyle}>
                                            <div className="donut-center">
                                                <span style={{ fontSize: '10px' }}>{peso(totals.budget)}</span>
                                                <small className="text-[9px] uppercase tracking-wide text-slate-400 mt-0.5" style={{ display: 'block' }}>budget</small>
                                            </div>
                                        </div>
                                        <div id="financialDonutTable" className="w-full text-xs">
                                            <table className="w-full">
                                                <thead>
                                                    <tr>
                                                        <th>Type</th>
                                                        <th className="text-right">Amount</th>
                                                        <th className="text-right">Share</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {financialDonutData.map((d, i) => (
                                                        <tr key={i}>
                                                            <td>
                                                                <span className="dot" style={{ backgroundColor: d.color, marginRight: '7px' }} />
                                                                {d.label}
                                                            </td>
                                                            <td className="text-right"><b>{peso(d.value)}</b></td>
                                                            <td className="text-right"><b>{pct((d.value / financialDonutTotal) * 100)}</b></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </article>
                    </div>
                </div>
            )}            {viewMode === 'grid' ? (
                sortedProjects.length === 0 ? (
                    <div className="card-outlined p-12 text-center flex flex-col items-center justify-center animate-slide-in">
                        <Folder size={48} className="text-slate-400 mb-3" />
                        <h3 className="text-lg font-bold text-slate-800 mb-1" style={{ color: 'var(--navy)' }}>No Projects Found</h3>
                        <p className="text-sm text-slate-500 font-semibold">We couldn't find any projects matching your search query or division criteria.</p>
                    </div>
                ) : (
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
                )
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
                                        <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
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
            {isCategoryModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fadeIn p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[85vh]">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100" style={{ color: 'var(--navy)' }}>
                                    Filter: {distributionMode === 'status' ? 'Activity Status' : distributionMode === 'budget' ? 'Budget' : 'Sources of Fund'}
                                </h3>
                                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                    Select which values to display across all charts
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsCategoryModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Toolbar */}
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center gap-2 flex-wrap">
                            <div className="flex gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const top5 = [...availableCategories].sort((a, b) => b.value - a.value).slice(0, 5).map(c => c.id);
                                        setSelectedCategories(top5);
                                    }}
                                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-805 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded cursor-pointer"
                                >
                                    Top 5
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategories(availableCategories.map(c => c.id));
                                    }}
                                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-805 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded cursor-pointer"
                                >
                                    Select All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategories([]);
                                    }}
                                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-805 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded cursor-pointer"
                                >
                                    Clear
                                </button>
                            </div>
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setCategorySortMode(prev => prev === 'value' ? 'alpha' : 'value')}
                                    className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded cursor-pointer"
                                >
                                    Sort: {categorySortMode === 'value' ? 'By Value' : 'A-Z'}
                                </button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                            <input
                                type="text"
                                value={categorySearchQuery}
                                onChange={(e) => setCategorySearchQuery(e.target.value)}
                                placeholder="Search values..."
                                className="w-full text-xs p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-850 dark:text-white focus:outline-hidden"
                            />
                        </div>

                        {/* Values List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[300px]">
                            {modalFilteredCategories.map(cat => {
                                const isChecked = activeCategoryIds.includes(cat.id);
                                return (
                                    <label 
                                        key={cat.id}
                                        className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                    let next = activeCategoryIds;
                                                    if (isChecked) {
                                                        next = next.filter(id => id !== cat.id);
                                                    } else {
                                                        next = [...next, cat.id];
                                                    }
                                                    setSelectedCategories(next);
                                                }}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                {cat.label}
                                            </span>
                                        </div>
                                        <span className="text-xs font-black text-slate-400">
                                            {unitMode === 'budget' ? peso(cat.value) : fmt(cat.count)}
                                        </span>
                                    </label>
                                );
                            })}
                            {modalFilteredCategories.length === 0 && (
                                <div className="text-center py-6 text-xs text-slate-400 font-medium">
                                    No matches found
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsCategoryModalOpen(false)}
                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                            >
                                Apply Filter
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Projects;
