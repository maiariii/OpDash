import React, { useEffect, useState, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { getEmployees, getProjects, getProjectTasks, getProjectFinancials, getDivisions, getAllCatchUps, getAllMilestones } from '../api';
import CalendarView from '../components/CalendarView';
import SpilloverTracker from '../components/SpilloverTracker';
import Loader from '../components/Loader';
import CreateTaskModal from '../components/CreateTaskModal';

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
            
            // Check if tasks sum to 0 budget
            const tasksBudgetSum = p.tasks ? p.tasks.reduce((sum, t) => sum + (Number(t.allocation || t.gms_allocation) || 0), 0) : 0;
            const projectTotalBudget = tasksBudgetSum > 0 ? tasksBudgetSum : (Number(p.sof_allocation || p.total_budget || 0));

            if (p.tasks && p.tasks.length > 0) {
                p.tasks.forEach((t, idx) => {
                    const daysAgo = (t.id.charCodeAt(t.id.length - 1) || 0) % 20;
                    const lastUpdateDate = new Date();
                    lastUpdateDate.setDate(lastUpdateDate.getDate() - daysAgo);

                    // If task allocations are 0, assign the fallback project budget to the first task
                    let taskBudget = Number(t.allocation || t.gms_allocation || 0);
                    if (tasksBudgetSum === 0 && idx === 0) {
                        taskBudget = projectTotalBudget;
                    }

                    list.push({
                        id: t.id,
                        name: t.title,
                        division: normalizeDivision(p.division),
                        project: p.name,
                        status: t.status === 'Accomplished' || t.status === 'Done' || t.status === 'Completed' ? 'Accomplished' : (t.status === 'Delayed' ? 'Delayed' : 'Pending'),
                        budget: taskBudget,
                        obligated: Number(t.obligated_amount || 0),
                        used: Number(t.obligated_amount || 0),
                        sourceOfFund: projectSourceOfFund,
                        lastUpdate: lastUpdateDate.toISOString().slice(0, 10),
                        due: t.due_date ? t.due_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
                        risk: t.priority === 'High' ? 'High' : (t.priority === 'Medium' ? 'Medium' : 'Low'),
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
                });
            }
        });
        return list;
    }, [rawData, loading]);

    // 2. Filter list by divisionFilter dropdown
    const scopedActivities = useMemo(() => {
        if (divisionFilter === 'all') return processedActivities;
        return processedActivities.filter(a => a.division === divisionFilter);
    }, [processedActivities, divisionFilter]);

    // 3. Drill down filter
    const activeActivities = useMemo(() => {
        if (selectedDivision) {
            return scopedActivities.filter(a => a.division === selectedDivision || a.project === selectedDivision);
        }
        return scopedActivities;
    }, [scopedActivities, selectedDivision]);

    // Grouping
    const groupKey = selectedDivision ? 'project' : 'division';
    const groupedActivities = useMemo(() => {
        const groups = {};
        activeActivities.forEach(a => {
            const key = a[groupKey];
            if (!groups[key]) groups[key] = [];
            groups[key].push(a);
        });
        return groups;
    }, [activeActivities, groupKey]);

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
        const total = metricValue(activeActivities) || 1;
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

    return (
        <div className="space-y-6">
            {/* Top Command Center Bar */}
            <section className="topbar" id="overview">
                <div>
                    <div className="eyebrow">Executive Activity Command Center</div>
                    <h1><span className="title-blue">Insight</span><span className="title-red">ED</span> Executive Activity Status & Budget Utilization Dashboard</h1>
                </div>
                <p className="top-note">One-page executive view: activity status, division performance, budget utilization, stale updates, risks, and action priorities without switching tabs.</p>
            </section>

            {/* Filter Panel */}
            <section className="card filters">
                <div className="filter-grid">
                    <label>
                        <span>Division</span>
                        <select 
                            value={divisionFilter} 
                            onChange={(e) => { setDivisionFilter(e.target.value); setSelectedDivision(null); }} 
                            className="select"
                        >
                            <option value="all">All divisions</option>
                            {Array.from(new Set(processedActivities.map(a => a.division))).sort().map(div => (
                                <option key={div} value={div}>{div}</option>
                            ))}
                        </select>
                    </label>
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
                    <p className="schema-note"><b>Executive intent:</b> the page now exposes all core status, budget, and source-of-fund answers in one continuous dashboard. The side links only jump to sections; they do not hide information behind tabs.</p>
                </div>
            </section>

            {/* Main Graphs Layout Grid */}
            <section className="flex flex-col gap-[10px]">
                {/* Distribution Main bar graph */}
                <article className="card wide" id="distributionGraph">
                    <div className="section-head">
                        <div>
                            <h2 className="section-title">
                                {selectedDivision ? `${selectedDivision} — Distribution by Project` : 'Distribution by Division'}
                            </h2>
                            <p className="subtext">
                                {selectedDivision ? 'Project-level distribution for the selected division.' : 'Primary comparison view. Click a division to view projects.'}
                            </p>
                        </div>
                        <div className="flex gap-2 items-center flex-wrap">
                            <button 
                                onClick={() => setDistributionView(prev => prev === 'bar' ? 'heatmap' : 'bar')}
                                className="mini-button hover:opacity-90"
                            >
                                {distributionView === 'bar' ? 'Heatmap' : 'Stacked bar'}
                            </button>
                            <span className={getBadgeStyle()}>{getBadgeText()}</span>
                            {selectedDivision && (
                                <button 
                                    onClick={() => setSelectedDivision(null)} 
                                    className="mini-button hover:opacity-90 bg-slate-500"
                                >
                                    Back to divisions
                                </button>
                            )}
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
                                        onClick={() => !selectedDivision && setSelectedDivision(d)}
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
                    )}
                </article>

                {/* Histogram Details */}
                <article className="card" id="distributionDetails">
                    <div className="section-head">
                        <div>
                            <h2 className="section-title">Distribution Details</h2>
                            <p className="subtext">Histogram showing active metrics for the current distribution mode.</p>
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
                <article className="card" id="distributionPanel">
                    <div className="section-head">
                        <div>
                            <h2 className="section-title">Distribution Snapshot</h2>
                            <p className="subtext">Overview breakdown and percentage shares.</p>
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

                {/* Compliance progress splits */}
                {distributionMode !== 'fund' && (
                    <article className="card wide" id="updates">
                        <div className="section-head">
                            <div>
                                <h2 className="section-title">
                                    {selectedDivision ? 'Update Compliance by Project' : 'Update Compliance by Division'}
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
                                            <div style={{ display: 'flex', width: `${lWidth}%`, height: '100%' }}>
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

            {/* Activity Calendar component */}
            <div className="card-outlined p-6 border border-slate-200">
                <CalendarView
                    activities={allCalendarEvents.filter(t => !t.is_milestone)}
                    title="Executive Activity Calendar"
                    onActivityClick={setEditingTask}
                />
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
        </div>
    );
};

export default Dashboard;
