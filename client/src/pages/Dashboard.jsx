import React, { useEffect, useState, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { getEmployees, getProjects, getProjectTasks, getProjectFinancials, getDivisions, getAllCatchUps, getAllMilestones, getBulkActivities } from '../api';
import CalendarView from '../components/CalendarView';
import SpilloverTracker from '../components/SpilloverTracker';
import Loader from '../components/Loader';
import CreateTaskModal from '../components/CreateTaskModal';
import { Settings, X, Activity } from 'lucide-react';
import clsx from 'clsx';

const Dashboard = () => {
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const socketRef = useRef(null);

    const [rawData, setRawData] = useState({
        projects: [],
        employees: [],
        divisions: [],
        projectDetails: [],
        catchups: [],
        milestones: []
    });

    // Prototype State Variables
    const [divisionFilter, setDivisionFilter] = useState('all');
    const [distributionMode, setDistributionMode] = useState('status');
    const [unitMode, setUnitMode] = useState('count');
    const [selectedDivision, setSelectedDivision] = useState(null);
    const [distributionView, setDistributionView] = useState('bar');
    const [editingTask, setEditingTask] = useState(null);

    // New dashboard filters
    const [fundFilter, setFundFilter] = useState('all');
    const [expenditureFilter, setExpenditureFilter] = useState('all');
    const [utilizationFilter, setUtilizationFilter] = useState('all');

    // Advanced Data Controls & Category Picker
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState(null);
    const [categorySearchQuery, setCategorySearchQuery] = useState('');
    const [categorySortMode, setCategorySortMode] = useState('value');
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

    // Per-card split states
    const [mainSplitBy, setMainSplitBy] = useState('status');
    const [detailsSplitBy, setDetailsSplitBy] = useState('status');
    const [snapshotSplitBy, setSnapshotSplitBy] = useState('status');

    // Sync per-card split states with global distributionMode
    useEffect(() => {
        setMainSplitBy(distributionMode);
        setDetailsSplitBy(distributionMode);
        setSnapshotSplitBy(distributionMode);
    }, [distributionMode]);

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

    const fundSources = useMemo(() => [
        { label: "GAA-PS", full: "GAA - Personal Services", color: colors.purple, seg: "seg-purple" },
        { label: "GAA-MOOE", full: "GAA - Maintenance and Other Operating Expenses", color: colors.green, seg: "seg-green" },
        { label: "GMS", full: "GMS Allocation", color: colors.orange, seg: "seg-orange" },
        { label: "APB", full: "Additional Targeted Budget (APB)", color: colors.red, seg: "seg-red" },
        { label: "HRD", full: "Human Resource Development", color: colors.gold, seg: "seg-gold" },
        { label: "HRDP", full: "Human Resource Development Program", color: colors.teal, seg: "seg-teal" },
        { label: "Basic Education Inputs Program", full: "Basic Education Inputs Program", shortLabel: "BEIP", color: colors.slate, seg: "seg-slate" }
    ], [colors]);

    const fmt = v => Number(v || 0).toLocaleString("en-PH");
    const peso = v => "₱" + Number(v || 0).toLocaleString("en-PH");
    const pct = v => Math.round(v || 0) + "%";

    const getProjectSourceOfFund = (p) => {
        return p.source_of_fund || 'GAA-PS';
    };

    const normalizeDivision = (div) => {
        if (!div || div.trim().toLowerCase() === 'n/a') return 'Unassigned';
        return div;
    };

    // Load API Data
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

                const employeesWithDivision = fetchedEmployees.map(emp => ({
                    ...emp,
                    division_name: fetchedDivisions.find(d => d.id === emp.division_id)?.name || 'Unassigned'
                }));

                const bulkData = await getBulkActivities();
                const allActivities = bulkData?.activities || [];

                const projectDetails = fetchedProjects.map(project => {
                    const tasks = allActivities.filter(a => a.project_id === project.id);
                    return { ...project, tasks };
                });

                setRawData({
                    projects: fetchedProjects,
                    employees: employeesWithDivision,
                    divisions: fetchedDivisions,
                    projectDetails: projectDetails,
                    catchups: fetchedCatchUps,
                    milestones: fetchedMilestones
                });

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

    // Socket Setup
    useEffect(() => {
        socketRef.current = io({ path: '/opdash/socket.io' });
        socketRef.current.on('task_updated', () => {
            setRefreshTrigger(prev => prev + 1);
        });
        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    // 1. Process all activities from raw data
    const processedActivities = useMemo(() => {
        if (loading) return [];
        const { projectDetails } = rawData;
        const list = [];
 
        projectDetails.forEach(p => {
            const projectSourceOfFund = getProjectSourceOfFund(p);
            const expenditureFramework = p.expenditure_framework || 'Not Specified';
            
            // Prioritize overall project budget (sof_allocation or total_budget)
            const projectSofAllocation = Number(p.sof_allocation || p.total_budget || 0);
            const tasksBudgetSum = p.tasks ? p.tasks.reduce((sum, t) => sum + (Number(t.allocation || t.gms_allocation) || 0), 0) : 0;
            const projectTotalBudget = projectSofAllocation > 0 ? projectSofAllocation : tasksBudgetSum;

            const projectObligated = p.tasks ? p.tasks.reduce((sum, t) => sum + Number(t.obligated_amount || 0), 0) : 0;
            const projectUtilizationPct = projectTotalBudget > 0 ? (projectObligated / projectTotalBudget) * 100 : 0;

            if (p.tasks && p.tasks.length > 0) {
                p.tasks.forEach((t, idx) => {
                    const daysAgo = (t.id.charCodeAt(t.id.length - 1) || 0) % 20;
                    const lastUpdateDate = new Date();
                    lastUpdateDate.setDate(lastUpdateDate.getDate() - daysAgo);

                    // Use individual task allocation, adding any unallocated project budget to the first activity
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
                        division: normalizeDivision(p.division),
                        project: p.name,
                        status: resolvedStatus,
                        budget: taskBudget,
                        obligated: Number(t.obligated_amount || 0),
                        used: Number(t.obligated_amount || 0),
                        sourceOfFund: projectSourceOfFund,
                        lastUpdate: lastUpdateDate.toISOString().slice(0, 10),
                        due: t.due_date ? t.due_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
                        risk: t.priority === 'High' ? 'High' : (t.priority === 'Medium' ? 'Medium' : 'Low'),
                        expenditureFramework,
                        projectUtilizationPct,
                    });
                });
            } else {
                // If project has no activities, push a placeholder so it still displays in dashboard metrics
                list.push({
                    id: `${p.id}-placeholder`,
                    name: 'Project Initialization',
                    division: normalizeDivision(p.division),
                    project: p.name,
                    status: 'Pending',
                    budget: projectTotalBudget,
                    obligated: 0,
                    used: 0,
                    sourceOfFund: projectSourceOfFund,
                    lastUpdate: p.created_at || new Date().toISOString(),
                    due: new Date().toISOString().slice(0, 10),
                    risk: 'Low',
                    expenditureFramework,
                    projectUtilizationPct,
                });
            }
        });
        return list;
    }, [rawData, loading]);

    // 2. Filter list by dropdown filters
    const scopedActivities = useMemo(() => {
        let list = processedActivities;

        // division
        if (divisionFilter !== 'all') {
            list = list.filter(a => a.division === divisionFilter);
        }

        // source of fund
        if (fundFilter !== 'all') {
            list = list.filter(a => a.sourceOfFund === fundFilter);
        }

        // expenditure framework
        if (expenditureFilter !== 'all') {
            list = list.filter(a => a.expenditureFramework === expenditureFilter);
        }

        // budget utilization
        if (utilizationFilter !== 'all') {
            list = list.filter(a => {
                const pctVal = a.projectUtilizationPct;
                if (utilizationFilter === 'unutilized') {
                    return pctVal === 0;
                }
                if (utilizationFilter === 'utilized') {
                    return pctVal > 0;
                }
                return true;
            });
        }

        return list;
    }, [processedActivities, divisionFilter, fundFilter, expenditureFilter, utilizationFilter]);

    // 3. Drill down filter
    const effectiveDivision = selectedDivision || (divisionFilter !== 'all' ? divisionFilter : null);

    const activeActivities = useMemo(() => {
        if (effectiveDivision) {
            return scopedActivities.filter(a => a.division === effectiveDivision || a.project === effectiveDivision);
        }
        return scopedActivities;
    }, [scopedActivities, effectiveDivision]);

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

    // Grouping
    const groupKey = effectiveDivision ? 'project' : 'division';
    const groupedActivities = useMemo(() => {
        const groups = {};
        if (!effectiveDivision) {
            rawData.divisions.forEach(d => {
                groups[d.name] = [];
            });
        }
        activeActivities.forEach(a => {
            const key = a[groupKey];
            if (!groups[key]) groups[key] = [];
            groups[key].push(a);
        });
        return groups;
    }, [activeActivities, groupKey, effectiveDivision, rawData.divisions]);

    const metricValue = (rows) => {
        return unitMode === 'budget' ? rows.reduce((s, r) => s + r.budget, 0) : rows.length;
    };

    const metricFormat = (val) => {
        return unitMode === 'budget' ? peso(val) : fmt(val);
    };

    const metricLabel = () => {
        return unitMode === 'budget' ? "budget" : "activities";
    };

    // Calculate overall KPIs/Totals
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

    const allEmployees = rawData.employees;

    const allCalendarEvents = useMemo(() => {
        if (loading) return [];
        const events = [];
        const activityProjectMap = {};

        rawData.projectDetails.forEach(p => {
            if (p.tasks) {
                p.tasks.forEach(t => {
                    events.push({
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

        rawData.catchups.forEach(c => {
            const projectInfo = activityProjectMap[c.activity_id];
            if (projectInfo) {
                events.push({
                    ...c,
                    id: `catchup-${c.id}`,
                    title: `Catch-up: ${c.title}`,
                    status: c.status,
                    target_date: c.target_date,
                    project_name: projectInfo.project_name,
                    is_catchup: true
                });
            }
        });

        rawData.milestones.forEach(m => {
            const project = rawData.projectDetails.find(p => p.id == m.project_id);
            events.push({
                ...m,
                id: `milestone-${m.id}`,
                title: m.title,
                status: m.status,
                target_date: m.target_date,
                project_name: project?.name || 'Unknown Project',
                division_name: project?.division || 'Unassigned',
                is_milestone: true
            });
        });

        return events;
    }, [rawData, loading]);

    // Table States for Calendar Events
    // Table States for Activities
    const [tableSearch, setTableSearch] = useState('');
    const [tableSortKey, setTableSortKey] = useState('division');
    const [tableSortDir, setTableSortDir] = useState('asc');
    const [tablePage, setTablePage] = useState(1);
    const [tablePageSize, setTablePageSize] = useState(10);
    const [tableFilters, setTableFilters] = useState({
        division: '',
        project: '',
        name: '',
        status: '',
        sourceOfFund: '',
        budget: '',
        obligated: ''
    });

    const processedTableData = useMemo(() => {
        if (!processedActivities || processedActivities.length === 0) {
            return { paginatedRows: [], totalRows: 0, totalPages: 1, start: 0 };
        }

        const getRowVal = (r, key) => {
            return r[key] || '';
        };

        let rows = processedActivities.filter(r => {
            if (tableSearch) {
                const searchLower = tableSearch.toLowerCase();
                const matchGlobal = [
                    r.division,
                    r.project,
                    r.name,
                    r.status,
                    r.sourceOfFund,
                    r.budget,
                    r.obligated
                ].some(val => String(val || '').toLowerCase().includes(searchLower));
                if (!matchGlobal) return false;
            }

            return Object.entries(tableFilters).every(([key, filterVal]) => {
                if (!filterVal) return true;
                const cellVal = getRowVal(r, key);
                return String(cellVal).toLowerCase().includes(filterVal.toLowerCase());
            });
        });

        const totalRows = rows.length;

        const TABLE_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
        rows.sort((a, b) => {
            const av = getRowVal(a, tableSortKey);
            const bv = getRowVal(b, tableSortKey);
            const dir = tableSortDir === 'desc' ? -1 : 1;
            
            if (['budget', 'obligated'].includes(tableSortKey)) {
                return (Number(av) - Number(bv)) * dir;
            }
            
            const comp = TABLE_COLLATOR.compare(String(av), String(bv)) * dir;
            if (comp !== 0) return comp;
            return TABLE_COLLATOR.compare(String(a.id), String(b.id));
        });

        const totalPages = Math.max(1, Math.ceil(totalRows / tablePageSize));
        const adjustedPage = Math.min(Math.max(1, tablePage), totalPages);
        const start = (adjustedPage - 1) * tablePageSize;
        const paginatedRows = rows.slice(start, start + tablePageSize);

        return { paginatedRows, totalRows, totalPages, start };
    }, [processedActivities, tableSearch, tableSortKey, tableSortDir, tablePage, tablePageSize, tableFilters]);

    if (loading) {
        return <div className="p-8 flex justify-center"><Loader text="Loading dashboard data..." /></div>;
    }

    // Stacked segments helper
    const renderStackedSegments = (values, scale, classes, labels, formatValue = fmt) => {
        return values.map((v, i) => {
            const width = scale ? Math.max((v / scale) * 100, 0) : 0;
            if (v === 0) return null;
            const text = formatValue(v);
            // Hide text if the segment width is too small to display the text length neatly
            const showText = width * 4.5 > text.length * 6;
            return (
                <div 
                    key={i}
                    className={`segment ${classes[i]}`} 
                    style={{ width: `${width}%` }} 
                    title={`${labels[i]}: ${text}`}
                >
                    <span>{text}</span>
                </div>
            );
        });
    };

    // Donut logic
    const donutData = (() => {
        let segments = [];
        // Note: For snapshot donut, we want to segment by snapshotSplitBy
        if (snapshotSplitBy === 'budget') {
            segments = [
                { label: "Utilized", value: totals.used, color: colors.blue, format: "peso" },
                { label: "Unutilized", value: Math.max(totals.budget - totals.used, 0), color: colors.gold, format: "peso" }
            ];
        } else if (snapshotSplitBy === 'fund') {
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

        // Only filter by category picker if this card's split mode matches the global active distributionMode
        if (snapshotSplitBy === distributionMode) {
            segments = segments.filter(d => activeCategoryIds.includes(d.label));
        }
        return segments;
    })();

    const donutTotal = donutData.reduce((s, r) => s + r.value, 0) || 1;
    const donutFormat = (val) => donutData.some(r => r.format === 'peso') ? peso(val) : metricFormat(val);

    let start = 0;
    const stops = donutData.map(r => {
        const p = (r.value / donutTotal) * 100;
        const s = `${r.color} ${start.toFixed(2)}% ${(start + p).toFixed(2)}%`;
        start += p;
        return s;
    });

    const donutStyle = {
        background: `conic-gradient(${stops.join(",")})`
    };

    // Max limits for bar charts
    const maxTotal = Math.max(...Object.values(groupedActivities).map(r => metricValue(r)), 1);
    const maxBudgetTotal = Math.max(...Object.values(groupedActivities).map(r => r.reduce((s, a) => s + a.budget, 0)), 1);

    // Dynamic classes
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

    const resetFilters = () => {
        setDivisionFilter('all');
        setFundFilter('all');
        setExpenditureFilter('all');
        setUtilizationFilter('all');
        setDistributionMode('status');
        setUnitMode('count');
        setSelectedDivision(null);
        setSelectedCategories(null);
    };

    return (
        <div className="space-y-6">
            {/* Data Controls Card */}
            <section className="card filters mb-6">
                <div className="card-inner">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <h2 className="section-title mb-0 flex items-center gap-2" style={{ marginBottom: 0 }}>
                                <Activity className="text-blue-600 w-5 h-5" /> Data Controls
                            </h2>
                            <p className="subtext text-xs text-slate-500 font-bold">
                                Filter records, change distribution breakdown, switch unit aggregation, and reset the view.
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
                        {/* First Row: Hierarchy filter (occupies full width) */}
                        <div className="grid grid-cols-1 gap-4 mb-4">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Division</span>
                                <select
                                    value={divisionFilter}
                                    onChange={(e) => { setDivisionFilter(e.target.value); setSelectedDivision(null); }}
                                    className="select w-full"
                                    style={{ margin: 0 }}
                                >
                                    <option value="all">All divisions</option>
                                    {rawData.divisions.map(d => d.name).sort().map(div => (
                                        <option key={div} value={div}>{div}</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        {/* Second Row: Non-location filters */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Source of Fund</span>
                                <select
                                    value={fundFilter}
                                    onChange={(e) => setFundFilter(e.target.value)}
                                    className="select w-full"
                                    style={{ margin: 0 }}
                                >
                                    <option value="all">All Funds</option>
                                    <option value="GAA-PS">GAA-PS</option>
                                    <option value="GAA-MOOE">GAA-MOOE</option>
                                    <option value="GMS">GMS</option>
                                    <option value="APB">APB</option>
                                    <option value="HRD">HRD</option>
                                    <option value="HRDP">HRDP</option>
                                    <option value="Basic Education Inputs Program">Basic Education Inputs Program</option>
                                </select>
                            </label>

                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Expenditure Framework</span>
                                <select
                                    value={expenditureFilter}
                                    onChange={(e) => setExpenditureFilter(e.target.value)}
                                    className="select w-full"
                                    style={{ margin: 0 }}
                                >
                                    <option value="all">All Frameworks</option>
                                    <option value="PREXC">PREXC</option>
                                    <option value="WFP">WFP</option>
                                </select>
                            </label>

                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Budget Utilization</span>
                                <select
                                    value={utilizationFilter}
                                    onChange={(e) => setUtilizationFilter(e.target.value)}
                                    className="select w-full"
                                    style={{ margin: 0 }}
                                >
                                    <option value="all">All</option>
                                    <option value="utilized">Utilized</option>
                                    <option value="unutilized">Unutilized</option>
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
                                            className="p-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-350 rounded-lg cursor-pointer flex items-center justify-center"
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
            {/* Main Graphs Layout Grid */}
            <section className="flex flex-col gap-6">
                {/* Distribution Main bar graph */}
                <article className="card animate-slide-in" id="distributionGraph">
                    <div className="section-head">
                        <div>
                            <h2 className="section-title">
                                {effectiveDivision ? `${effectiveDivision} — Distribution by Project` : 'Distribution by Division'}
                            </h2>
                            <p className="subtext">
                                {effectiveDivision ? 'Project-level distribution for the selected division.' : 'Primary comparison view. Click a division to view projects.'}
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
                                className="mini-button hover:opacity-90"
                            >
                                {distributionView === 'bar' ? 'Heatmap' : 'Stacked bar'}
                            </button>
                            <span className={getBadgeStyle(mainSplitBy)}>{getBadgeText(mainSplitBy)}</span>
                            {effectiveDivision && (
                                <button 
                                    onClick={() => {
                                        setSelectedDivision(null);
                                        setDivisionFilter('all');
                                    }} 
                                    className="mini-button hover:opacity-90 bg-slate-500"
                                >
                                    Back to divisions
                                </button>
                            )}
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
                                        onClick={() => !selectedDivision && setSelectedDivision(d)}
                                        className="bar-row"
                                        style={!selectedDivision ? { cursor: 'pointer' } : {}}
                                        title={!selectedDivision ? "Click to view projects" : ""}
                                    >
                                        <span>{d}</span>
                                        <div className="track flex">
                                            {mainSplitBy === 'budget' && (() => {
                                                const u = r.reduce((s, a) => s + a.used, 0);
                                                const b = r.reduce((s, a) => s + a.used + (a.budget - a.used), 0);
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
                                                onClick={() => !selectedDivision && setSelectedDivision(d)}
                                                className="heat-cell heat-division font-bold hover:bg-slate-50 cursor-pointer"
                                                title={!selectedDivision ? "Click to view projects" : ""}
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

                {/* Sub-Graphs Layout Grid (Two Columns Below) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Histogram Details */}
                    <article className="card animate-slide-in" id="distributionDetails">
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
                    <article className="card animate-slide-in" id="distributionPanel">
                        <div className="section-head">
                            <div>
                                <h2 className="section-title">Distribution Snapshot</h2>
                                <p className="subtext text-xs text-slate-500 font-bold">Overview breakdown and percentage shares.</p>
                            </div>
                            <div className="flex gap-2 items-center flex-wrap">
                                <select
                                    value={snapshotSplitBy}
                                    onChange={(e) => setSnapshotSplitBy(e.target.value)}
                                    className="select py-1 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                                    style={{ width: 'auto', minWidth: '120px', margin: 0 }}
                                >
                                    <option value="status">Split by Status</option>
                                    <option value="budget">Split by Budget</option>
                                    <option value="fund">Split by Fund</option>
                                </select>
                                <span className={getBadgeStyle(snapshotSplitBy)}>{getBadgeText(snapshotSplitBy)}</span>
                            </div>
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

                {/* Compliance progress splits */}
                {distributionMode !== 'fund' && (
                    <article className="card wide" id="updates">
                        <div className="section-head">
                            <div>
                                <h2 className="section-title">
                                    {effectiveDivision ? 'Update Compliance by Project' : 'Update Compliance by Division'}
                                </h2>
                                <p className="subtext">
                                    Accomplished metrics (Obligated/Accomplished) are aligned right, while Pending/Delayed obligations are aligned left.
                                </p>
                            </div>
                            <span className="badge purple">Compliance Analysis</span>
                        </div>

                        <div className="bars space-y-4 mt-4">
                            {Object.entries(groupedActivities).map(([d, r]) => {
                                const totalVal = metricValue(r) || 1;
                                let leftVals, rightVals, leftClasses, rightClasses, leftLabels, rightLabels, summaryText;

                                if (distributionMode === 'budget') {
                                    const u = r.reduce((s, a) => s + a.used, 0);
                                    const b = r.reduce((s, a) => s + a.budget, 0);
                                    const unutilized = Math.max(b - u, 0);

                                    leftVals = [unutilized];
                                    rightVals = [u];
                                    leftClasses = ["seg-gold"];
                                    rightClasses = ["seg-blue"];
                                    leftLabels = ["Unutilized"];
                                    rightLabels = ["Utilized"];
                                    summaryText = `${peso(u)} utilized`;
                                } else {
                                    const p = metricValue(r.filter(a => a.status === 'Pending'));
                                    const acc = metricValue(r.filter(a => a.status === 'Accomplished'));
                                    const del = metricValue(r.filter(a => a.status === 'Delayed'));

                                    leftVals = [p, del];
                                    rightVals = [acc];
                                    leftClasses = ["seg-gold", "seg-red"];
                                    rightClasses = ["seg-green"];
                                    leftLabels = ["Pending", "Delayed"];
                                    rightLabels = ["Accomplished"];
                                    summaryText = `${fmt(acc)} done`;
                                }

                                const leftTotal = leftVals.reduce((s, v) => s + v, 0);
                                const rightTotal = rightVals.reduce((s, v) => s + v, 0);
                                const safeVal = Math.max(totalVal, leftTotal + rightTotal, 1);
                                const lWidth = (leftTotal / safeVal) * 100;
                                const rWidth = (rightTotal / safeVal) * 100;

                                return (
                                    <div key={d} className="split-row">
                                        <span title={d}>{d}</span>
                                        
                                        {/* Left Stacked Bar */}
                                        <div className="left" title={leftLabels.join(" + ")}>
                                            <div style={{ display: 'flex', flexDirection: 'row-reverse', width: `${lWidth}%`, height: '100%', marginLeft: 'auto' }}>
                                                {renderStackedSegments(leftVals, leftTotal || 1, leftClasses, leftLabels, distributionMode === 'budget' ? peso : fmt)}
                                            </div>
                                        </div>

                                        <div className="axis" />

                                        {/* Right Stacked Bar */}
                                        <div className="right" title={rightLabels.join(" + ")}>
                                            <div style={{ display: 'flex', width: `${rWidth}%`, height: '100%' }}>
                                                {renderStackedSegments(rightVals, rightTotal || 1, rightClasses, rightLabels, distributionMode === 'budget' ? peso : fmt)}
                                            </div>
                                        </div>

                                        <b>{summaryText}</b>
                                    </div>
                                );
                            })}
                        </div>
                    </article>
                )}
            </section>

            {/* Spillover Tracker component */}
            <div className="card-outlined p-6 border border-slate-200">
                <SpilloverTracker tasks={allCalendarEvents} />
            </div>

            {/* Executive Activity Registry Table */}
            <div className="card-outlined p-6 border border-slate-200">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100" style={{ color: 'var(--navy)' }}>
                        Executive Activity Registry
                    </h2>
                    <div className="flex items-center gap-3">
                        <input 
                            type="search" 
                            placeholder="Search records..." 
                            className="column-filter" 
                            style={{ width: '220px', height: '36px' }}
                            value={tableSearch}
                            onChange={(e) => {
                                setTableSearch(e.target.value);
                                setTablePage(1);
                            }}
                        />
                        <button 
                            className="button secondary"
                            style={{ height: '36px', padding: '0 16px', background: 'var(--blue)', color: 'white', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}
                            onClick={() => {
                                setTableSearch('');
                                setTableFilters({
                                    division: '',
                                    project: '',
                                    name: '',
                                    status: '',
                                    sourceOfFund: '',
                                    budget: '',
                                    obligated: ''
                                });
                                setTablePage(1);
                            }}
                        >
                            Reset Table
                        </button>
                    </div>
                </div>

                {/* Top Controls */}
                <div className="table-controls">
                    <span className="table-page-label">
                        {processedTableData.totalRows > 0 ? (
                            `Rows ${processedTableData.start + 1}–${processedTableData.start + processedTableData.paginatedRows.length} of ${processedTableData.totalRows} · Page ${tablePage} of ${processedTableData.totalPages}`
                        ) : (
                            'No records found'
                        )}
                    </span>
                    <div className="flex gap-2 items-center flex-wrap">
                        <select 
                            className="select" 
                            value={tablePageSize}
                            onChange={(e) => {
                                setTablePageSize(Number(e.target.value));
                                setTablePage(1);
                            }}
                        >
                            <option value={10}>10 rows</option>
                            <option value={25}>25 rows</option>
                            <option value={50}>50 rows</option>
                            <option value={100}>100 rows</option>
                        </select>
                        <button 
                            className="button secondary" 
                            disabled={tablePage <= 1}
                            onClick={() => setTablePage(prev => Math.max(1, prev - 1))}
                        >
                            Prev
                        </button>
                        <button 
                            className="button secondary" 
                            disabled={tablePage >= processedTableData.totalPages}
                            onClick={() => setTablePage(prev => Math.min(processedTableData.totalPages, prev + 1))}
                        >
                            Next
                        </button>
                    </div>
                </div>

                {/* Table Wrapper */}
                <div className="table-wrap">
                    <table id="recordsTable">
                        <thead>
                            <tr>
                                <th className="col-freeze col-freeze-1" style={{ width: '150px' }}>
                                    <button 
                                        className="sort-button"
                                        onClick={() => {
                                            const nextDir = (tableSortKey === 'division' && tableSortDir === 'asc') ? 'desc' : 'asc';
                                            setTableSortKey('division');
                                            setTableSortDir(nextDir);
                                        }}
                                    >
                                        Division <span className="sort-icon">{tableSortKey === 'division' ? (tableSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </button>
                                </th>
                                <th className="col-freeze col-freeze-2" style={{ width: '220px' }}>
                                    <button 
                                        className="sort-button"
                                        onClick={() => {
                                            const nextDir = (tableSortKey === 'project' && tableSortDir === 'asc') ? 'desc' : 'asc';
                                            setTableSortKey('project');
                                            setTableSortDir(nextDir);
                                        }}
                                    >
                                        Project <span className="sort-icon">{tableSortKey === 'project' ? (tableSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </button>
                                </th>
                                <th className="col-freeze col-freeze-3" style={{ width: '250px' }}>
                                    <button 
                                        className="sort-button"
                                        onClick={() => {
                                            const nextDir = (tableSortKey === 'name' && tableSortDir === 'asc') ? 'desc' : 'asc';
                                            setTableSortKey('name');
                                            setTableSortDir(nextDir);
                                        }}
                                    >
                                        Activity <span className="sort-icon">{tableSortKey === 'name' ? (tableSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </button>
                                </th>
                                <th style={{ width: '150px' }}>
                                    <button 
                                        className="sort-button"
                                        onClick={() => {
                                            const nextDir = (tableSortKey === 'status' && tableSortDir === 'asc') ? 'desc' : 'asc';
                                            setTableSortKey('status');
                                            setTableSortDir(nextDir);
                                        }}
                                    >
                                        Status of Activity <span className="sort-icon">{tableSortKey === 'status' ? (tableSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </button>
                                </th>
                                <th style={{ width: '150px' }}>
                                    <button 
                                        className="sort-button"
                                        onClick={() => {
                                            const nextDir = (tableSortKey === 'sourceOfFund' && tableSortDir === 'asc') ? 'desc' : 'asc';
                                            setTableSortKey('sourceOfFund');
                                            setTableSortDir(nextDir);
                                        }}
                                    >
                                        Source of fund <span className="sort-icon">{tableSortKey === 'sourceOfFund' ? (tableSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </button>
                                </th>
                                <th style={{ width: '150px' }}>
                                    <button 
                                        className="sort-button"
                                        onClick={() => {
                                            const nextDir = (tableSortKey === 'budget' && tableSortDir === 'asc') ? 'desc' : 'asc';
                                            setTableSortKey('budget');
                                            setTableSortDir(nextDir);
                                        }}
                                    >
                                        Allocation <span className="sort-icon">{tableSortKey === 'budget' ? (tableSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </button>
                                </th>
                                <th style={{ width: '150px' }}>
                                    <button 
                                        className="sort-button"
                                        onClick={() => {
                                            const nextDir = (tableSortKey === 'obligated' && tableSortDir === 'asc') ? 'desc' : 'asc';
                                            setTableSortKey('obligated');
                                            setTableSortDir(nextDir);
                                        }}
                                    >
                                        Obligated <span className="sort-icon">{tableSortKey === 'obligated' ? (tableSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                                    </button>
                                </th>
                            </tr>
                            <tr>
                                <th className="col-freeze col-freeze-1">
                                    <input 
                                        className="column-filter" 
                                        type="search" 
                                        placeholder="Filter..." 
                                        value={tableFilters.division}
                                        onChange={(e) => {
                                            setTableFilters(prev => ({ ...prev, division: e.target.value }));
                                            setTablePage(1);
                                        }}
                                    />
                                </th>
                                <th className="col-freeze col-freeze-2">
                                    <input 
                                        className="column-filter" 
                                        type="search" 
                                        placeholder="Filter..." 
                                        value={tableFilters.project}
                                        onChange={(e) => {
                                            setTableFilters(prev => ({ ...prev, project: e.target.value }));
                                            setTablePage(1);
                                        }}
                                    />
                                </th>
                                <th className="col-freeze col-freeze-3">
                                    <input 
                                        className="column-filter" 
                                        type="search" 
                                        placeholder="Filter..." 
                                        value={tableFilters.name}
                                        onChange={(e) => {
                                            setTableFilters(prev => ({ ...prev, name: e.target.value }));
                                            setTablePage(1);
                                        }}
                                    />
                                </th>
                                <th>
                                    <input 
                                        className="column-filter" 
                                        type="search" 
                                        placeholder="Filter..." 
                                        value={tableFilters.status}
                                        onChange={(e) => {
                                            setTableFilters(prev => ({ ...prev, status: e.target.value }));
                                            setTablePage(1);
                                        }}
                                    />
                                </th>
                                <th>
                                    <input 
                                        className="column-filter" 
                                        type="search" 
                                        placeholder="Filter..." 
                                        value={tableFilters.sourceOfFund}
                                        onChange={(e) => {
                                            setTableFilters(prev => ({ ...prev, sourceOfFund: e.target.value }));
                                            setTablePage(1);
                                        }}
                                    />
                                </th>
                                <th>
                                    <input 
                                        className="column-filter" 
                                        type="search" 
                                        placeholder="Filter..." 
                                        value={tableFilters.budget}
                                        onChange={(e) => {
                                            setTableFilters(prev => ({ ...prev, budget: e.target.value }));
                                            setTablePage(1);
                                        }}
                                    />
                                </th>
                                <th>
                                    <input 
                                        className="column-filter" 
                                        type="search" 
                                        placeholder="Filter..." 
                                        value={tableFilters.obligated}
                                        onChange={(e) => {
                                            setTableFilters(prev => ({ ...prev, obligated: e.target.value }));
                                            setTablePage(1);
                                        }}
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedTableData.paginatedRows.length > 0 ? (
                                processedTableData.paginatedRows.map((r, i) => {
                                    let statusClass = 'neutral';
                                    if (r.status === 'Completed' || r.status === 'Accomplished') statusClass = 'ok';
                                    else if (r.status === 'In Progress') statusClass = 'warn';
                                    else if (r.status === 'Delayed') statusClass = 'risk';

                                    return (
                                        <tr 
                                            key={r.id || i}
                                            className="record-row hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                                            onClick={() => {
                                                setEditingTask({
                                                    ...r,
                                                    title: r.name,
                                                    project_id: r.id
                                                });
                                            }}
                                        >
                                            <td className="col-freeze col-freeze-1 font-semibold text-slate-900 dark:text-slate-100">{r.division || 'Unassigned'}</td>
                                            <td className="col-freeze col-freeze-2 font-semibold text-slate-900 dark:text-slate-100">{r.project}</td>
                                            <td className="col-freeze col-freeze-3 font-semibold text-slate-900 dark:text-slate-100">{r.name}</td>
                                            <td>
                                                <span className={`update-age ${statusClass}`}>
                                                    {r.status || 'Not Started'}
                                                </span>
                                            </td>
                                            <td>{r.sourceOfFund || 'Not Specified'}</td>
                                            <td className="font-semibold">{peso(r.budget)}</td>
                                            <td className="font-semibold">{peso(r.obligated)}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-slate-400 font-semibold">
                                        No matching activities found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Bottom Controls */}
                <div className="table-controls mt-4">
                    <span className="table-page-label">
                        {processedTableData.totalRows > 0 ? (
                            `Rows ${processedTableData.start + 1}–${processedTableData.start + processedTableData.paginatedRows.length} of ${processedTableData.totalRows}`
                        ) : (
                            ''
                        )}
                    </span>
                    <div className="flex gap-2 items-center">
                        <button 
                            className="button secondary" 
                            disabled={tablePage <= 1}
                            onClick={() => setTablePage(prev => Math.max(1, prev - 1))}
                        >
                            Prev
                        </button>
                        <button 
                            className="button secondary" 
                            disabled={tablePage >= processedTableData.totalPages}
                            onClick={() => setTablePage(prev => Math.min(processedTableData.totalPages, prev + 1))}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {editingTask && (
                <CreateTaskModal
                    projectId={editingTask.project_id}
                    task={editingTask}
                    members={allEmployees}
                    onClose={() => setEditingTask(null)}
                    onCreated={() => {
                        setEditingTask(null);
                        setRefreshTrigger(prev => prev + 1);
                    }}
                />
            )}
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
                                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded cursor-pointer"
                                >
                                    Top 5
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategories(availableCategories.map(c => c.id));
                                    }}
                                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded cursor-pointer"
                                >
                                    Select All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategories([]);
                                    }}
                                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded cursor-pointer"
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
        </div>
    );
};

export default Dashboard;
