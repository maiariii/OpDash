import React, { useState, useEffect } from 'react';
import { PieChart, BarChart3, Users, DollarSign, Activity, CheckCircle2, Clock, AlertTriangle, X, LayoutGrid, List } from 'lucide-react';
import clsx from 'clsx';

const COLORS = {
    'Pending': '#f59e0b', // Amber
    'Accomplished': '#10b981', // Emerald
    'Delayed': '#ef4444', // Red
    'Budget': '#3b82f6', // Blue
    'Spent': '#8b5cf6'  // Violet
};

const BreakdownModal = ({ isOpen, onClose, title, data = [], type }) => {
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
    const [selectedItem, setSelectedItem] = useState(null);

    // Reset selected item when modal closes or opens with new data
    useEffect(() => {
        setSelectedItem(null);
    }, [isOpen, data]);

    if (!isOpen) return null;

    // Sort milestones by importance desc
    // For milestones, filter to show ONLY Completed/Done/Accomplished and sort by importance
    const displayData = type === 'milestone'
        ? [...data]
            .filter(item => ['Completed', 'Done', 'Accomplished'].includes(item.status))
            .sort((a, b) => (Number(b.importance) || 0) - (Number(a.importance) || 0))
        : data;

    if (selectedItem) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="text-lg font-bold text-slate-800">Milestone Details</h3>
                        <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-slate-600 p-1 bg-white rounded-full border border-slate-200 shadow-sm transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="text-xs uppercase font-bold text-slate-400">Title</label>
                            <p className="text-lg font-semibold text-slate-800">{selectedItem.title}</p>
                        </div>
                        <div>
                            <label className="text-xs uppercase font-bold text-slate-400">Description</label>
                            <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedItem.description || "No description provided."}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-400">Status</label>
                                <span className={clsx("inline-block px-2 py-0.5 rounded-full text-xs font-bold mt-1",
                                    ['Completed', 'Done', 'Accomplished'].includes(selectedItem.status) ? 'bg-green-100 text-green-700' :
                                        selectedItem.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                )}>{selectedItem.status}</span>
                            </div>
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-400">Target Date</label>
                                <p className="text-sm font-medium text-slate-700 mt-1">{selectedItem.target_date ? new Date(selectedItem.target_date).toLocaleDateString() : '-'}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-400">Project</label>
                                <p className="text-sm font-medium text-slate-700 mt-1">{selectedItem.project_name || '-'}</p>
                            </div>
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-400">Division</label>
                                <p className="text-sm font-medium text-slate-700 mt-1">{selectedItem.division_name || '-'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        if (displayData.length === 0) {
            return <div className="p-8 text-center text-slate-500">No records found.</div>;
        }

        if (viewMode === 'list') {
            return (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-4 py-3">Name/Title</th>
                                {type === 'task' && <th className="px-4 py-3">Status</th>}
                                {type === 'task' && <th className="px-4 py-3">Start Date</th>}
                                {type === 'task' && <th className="px-4 py-3">Due Date</th>}
                                {type === 'task' && <th className="px-4 py-3">Project</th>}
                                {type === 'employee' && <th className="px-4 py-3">Position</th>}
                                {type === 'employee' && <th className="px-4 py-3">Division</th>}
                                {type === 'financial' && <th className="px-4 py-3">Budget</th>}
                                {type === 'financial' && <th className="px-4 py-3">Spent</th>}
                                {type === 'milestone' && (
                                    <>
                                        <th className="px-4 py-3">Imp.</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Target Date</th>
                                        <th className="px-4 py-3">Project</th>
                                        <th className="px-4 py-3">Division</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {displayData.map((item, idx) => {
                                const getRowColor = () => {
                                    if (type !== 'milestone') return "hover:bg-slate-50";
                                    switch (Number(item.importance)) {
                                        case 5: return 'bg-amber-50/70 hover:bg-amber-100/80';
                                        case 4: return 'bg-orange-50/70 hover:bg-orange-100/80';
                                        case 3: return 'bg-green-50/70 hover:bg-green-100/80';
                                        case 2: return 'bg-blue-50/70 hover:bg-blue-100/80';
                                        default: return 'hover:bg-slate-50';
                                    }
                                };
                                return (
                                    <tr
                                        key={item.id || idx}
                                        onClick={() => type === 'milestone' && setSelectedItem(item)}
                                        className={clsx(
                                            "transition-colors border-b last:border-0 border-slate-100",
                                            getRowColor(),
                                            type === 'milestone' && "cursor-pointer active:scale-[0.99] transform transition-transform"
                                        )}
                                    >
                                        <td className="px-4 py-3 font-medium text-slate-800">
                                            {item.name || item.title || item.first_name + ' ' + item.last_name}
                                        </td>
                                        {type === 'task' && (
                                            <>
                                                <td className="px-4 py-3">
                                                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-bold",
                                                        item.status === 'Done' ? 'bg-green-100 text-green-700' :
                                                            item.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                                    )}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 text-xs">
                                                    {item.start_date ? new Date(item.start_date).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 text-xs">
                                                    {item.due_date ? new Date(item.due_date).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">{item.project_name || '-'}</td>
                                            </>
                                        )}
                                        {type === 'employee' && (
                                            <>
                                                <td className="px-4 py-3 text-slate-500">{item.position || '-'}</td>
                                                <td className="px-4 py-3 text-slate-500">{item.division_name || 'Unassigned'}</td>
                                            </>
                                        )}
                                        {type === 'financial' && (
                                            <>
                                                <td className="px-4 py-3 font-mono">₱{Number(item.total_budget || 0).toLocaleString()}</td>
                                                <td className="px-4 py-3 font-mono">₱{Number(item.actual_cost || item.cost || 0).toLocaleString()}</td>
                                            </>
                                        )}
                                        {type === 'milestone' && (
                                            <>
                                                <td className="px-4 py-3">
                                                    <div className="flex gap-0.5">
                                                        {[...Array(Number(item.importance) || 0)].map((_, i) => (
                                                            <Activity key={i} size={12} className={clsx("fill-current", Number(item.importance) === 4 ? "text-orange-500" : "text-amber-500")} />
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-bold",
                                                        ['Completed', 'Done', 'Accomplished'].includes(item.status) ? 'bg-green-100 text-green-700' :
                                                            item.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                                    )}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 text-xs">
                                                    {item.target_date ? new Date(item.target_date).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">{item.project_name || '-'}</td>
                                                <td className="px-4 py-3 text-slate-500">{item.division_name || '-'}</td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            );
        } else {
            // Grid View
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-slate-50">
                    {displayData.map((item, idx) => (
                        <div key={item.id || idx} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                            <div>
                                <h4 className="font-bold text-slate-800 mb-2 truncate" title={item.name || item.title || item.first_name + ' ' + item.last_name}>
                                    {item.name || item.title || item.first_name + ' ' + item.last_name}
                                </h4>

                                {type === 'task' && (
                                    <div className="text-xs text-slate-500 space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span>Status:</span>
                                            <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold",
                                                item.status === 'Done' ? 'bg-green-100 text-green-700' :
                                                    item.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                            )}>{item.status}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Project:</span>
                                            <span className="truncate max-w-[120px]" title={item.project_name}>{item.project_name}</span>
                                        </div>
                                        {item.start_date && (
                                            <div className="flex justify-between">
                                                <span>Start:</span>
                                                <span className="font-medium text-slate-700">{new Date(item.start_date).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                        {item.due_date && (
                                            <div className="flex justify-between">
                                                <span>Due:</span>
                                                <span className="font-medium text-slate-700">{new Date(item.due_date).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {type === 'employee' && (
                                    <div className="text-xs text-slate-500 space-y-2">
                                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                            <span className="block text-[10px] uppercase text-slate-400 font-bold mb-0.5">Position</span>
                                            <span className="font-medium text-slate-800">{item.position}</span>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                            <span className="block text-[10px] uppercase text-slate-400 font-bold mb-0.5">Division</span>
                                            <span className="font-medium text-slate-800">{item.division_name || 'Unassigned'}</span>
                                        </div>
                                    </div>
                                )}

                                {type === 'financial' && (
                                    <div className="text-xs text-slate-500 space-y-1 mt-2 pt-2 border-t border-slate-100">
                                        <div className="flex justify-between">
                                            <span>Budget:</span>
                                            <span className="font-mono font-bold text-slate-700">₱{Number(item.total_budget || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Spent:</span>
                                            <span className="font-mono font-bold text-slate-700">₱{Number(item.actual_cost || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}

                                {type === 'milestone' && (
                                    <div className="text-xs text-slate-500 space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span>Status:</span>
                                            <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold",
                                                item.status === 'Completed' || item.status === 'Done' ? 'bg-green-100 text-green-700' :
                                                    item.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                            )}>{item.status}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Project:</span>
                                            <span className="truncate max-w-[120px]" title={item.project_name}>{item.project_name}</span>
                                        </div>
                                        {item.target_date && (
                                            <div className="flex justify-between">
                                                <span>Target:</span>
                                                <span className="font-medium text-slate-700">{new Date(item.target_date).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-white shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                            {type === 'task' ? <Activity size={20} /> : type === 'employee' ? <Users size={20} /> : <DollarSign size={20} />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 leading-tight">{title}</h3>
                            <p className="text-xs text-slate-500">{data.length} records found</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button
                                onClick={() => setViewMode('list')}
                                className={clsx("p-1.5 rounded-md transition-all", viewMode === 'list' ? "bg-white shadow text-blue-600" : "text-slate-400 hover:text-slate-600")}
                                title="List View"
                            >
                                <List size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={clsx("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-white shadow text-blue-600" : "text-slate-400 hover:text-slate-600")}
                                title="Grid View"
                            >
                                <LayoutGrid size={18} />
                            </button>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto bg-slate-50/50">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ title, value, subtext, icon: Icon, color, onClick, clickable = false }) => (
    <div
        onClick={clickable ? onClick : undefined}
        className={clsx(
            "bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between relative overflow-hidden group",
            clickable && "cursor-pointer hover:shadow-md hover:border-blue-200 transition-all active:scale-[0.99]"
        )}
    >
        <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
            {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
        </div>
        <div className={clsx("p-3 rounded-lg transition-transform group-hover:scale-110", color)}>
            <Icon size={20} className="text-white" />
        </div>
        {clickable && (
            <div className="absolute inset-0 bg-blue-50/0 group-hover:bg-blue-50/5 transition-colors pointer-events-none" />
        )}
    </div>
);

const SimplePieChart = ({ data, onSliceClick }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const [hoveredIndex, setHoveredIndex] = useState(null);

    if (total === 0) return <div className="text-center text-slate-400 py-10">No activities found</div>;

    let cumulativePercent = 0;
    const slices = data.map((item, index) => {
        const startPercent = cumulativePercent;
        const slicePercent = item.value / total;
        cumulativePercent += slicePercent;
        const endPercent = cumulativePercent;

        const getCoordinatesForPercent = (percent) => {
            const x = Math.cos(2 * Math.PI * percent);
            const y = Math.sin(2 * Math.PI * percent);
            return [x, y];
        };

        const [startX, startY] = getCoordinatesForPercent(startPercent);
        const [endX, endY] = getCoordinatesForPercent(endPercent);

        const largeArcFlag = slicePercent > 0.5 ? 1 : 0;
        const pathData = slicePercent === 1
            ? `M 1 0 A 1 1 0 1 1 -1 0 A 1 1 0 1 1 1 0 Z`
            : `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L 0 0`;

        return { ...item, path: pathData, percent: Math.round(slicePercent * 100) };
    });

    return (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <div className="relative w-48 h-48">
                <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full transform -rotate-90">
                    {slices.map((slice, i) => (
                        <path
                            key={i}
                            d={slice.path}
                            fill={slice.color}
                            stroke="white"
                            strokeWidth="0.02"
                            className={clsx("transition-opacity cursor-pointer", hoveredIndex === i ? "opacity-100" : (hoveredIndex !== null ? "opacity-50" : "opacity-100"))}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            onClick={() => onSliceClick && onSliceClick(slice)}
                        />
                    ))}
                </svg>
            </div>
            <div className="space-y-2">
                {data.map((item, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => onSliceClick && onSliceClick(item)}
                    >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-medium text-slate-700">{item.label}</span>
                        <span className="text-slate-500">({item.value})</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const FinancialBar = ({ label, value, max, color }) => {
    const percent = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-slate-700">{label}</span>
                <span className="font-bold text-slate-900">₱{value.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
};

const DashboardCharts = ({ metrics }) => {
    const {
        totalProjects,
        totalEmployees,
        totalActivities,
        pendingActivities,
        accomplishedActivities,
        delayedActivities,
        totalBudget,
        totalSpent,
        // Detailed Data Arrays
        allProjects = [],
        allEmployees = [],
        allTasks = [],
        pendingTasks = [],
        accomplishedTasks = [],
        delayedTasks = []
    } = metrics;

    const [modalState, setModalState] = useState({
        isOpen: false,
        title: '',
        data: [],
        type: 'task' // 'task' | 'employee' | 'financial'
    });

    const openModal = (title, data, type = 'task') => {
        setModalState({ isOpen: true, title, data, type });
    };

    const closeModal = () => {
        setModalState(prev => ({ ...prev, isOpen: false }));
    };

    const activityData = [
        { label: 'Pending', value: pendingActivities, color: COLORS.Pending, data: pendingTasks },
        { label: 'Accomplished', value: accomplishedActivities, color: COLORS.Accomplished, data: accomplishedTasks },
        { label: 'Delayed', value: delayedActivities, color: COLORS.Delayed, data: delayedTasks }
    ];

    const handleSliceClick = (slice) => {
        const titleMap = {
            'Pending': 'Pending Activities',
            'Accomplished': 'Accomplished Activities',
            'Delayed': 'Delayed Activities'
        };
        // Use slice.data if available (from activityData), or switch based on label
        let data = slice.data;
        if (!data) {
            if (slice.label === 'Pending') data = pendingTasks;
            else if (slice.label === 'Accomplished') data = accomplishedTasks;
            else if (slice.label === 'Delayed') data = delayedTasks;
        }

        openModal(titleMap[slice.label] || `${slice.label} Activities`, data, 'task');
    };

    return (
        <div className="space-y-6">
            {/* Metric Cards Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Activities"
                    value={totalActivities}
                    icon={Activity}
                    color="bg-blue-500"
                    clickable
                    onClick={() => openModal('All Activities', allTasks, 'task')}
                />
                <MetricCard
                    title="Pending"
                    value={pendingActivities}
                    icon={Clock}
                    color="bg-amber-500"
                    clickable
                    onClick={() => openModal('Pending Activities', pendingTasks, 'task')}
                />
                <MetricCard
                    title="Accomplished"
                    value={accomplishedActivities}
                    icon={CheckCircle2}
                    color="bg-emerald-500"
                    clickable
                    onClick={() => openModal('Accomplished Activities', accomplishedTasks, 'task')}
                />
                <MetricCard
                    title="Delayed"
                    value={delayedActivities}
                    icon={AlertTriangle}
                    color="bg-red-500"
                    clickable
                    onClick={() => openModal('Delayed Activities', delayedTasks, 'task')}
                />
            </div>

            {/* Metric Cards Row 2 (Financials & People) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                    title="Milestones Reached"
                    value={metrics.milestonesReached || 0}
                    icon={CheckCircle2}
                    color="bg-emerald-600"
                    clickable
                    onClick={() => openModal('Milestones Reached', metrics.allMilestones || [], 'milestone')}
                />
                <MetricCard
                    title="Total Budget"
                    value={`₱${totalBudget.toLocaleString()}`}
                    icon={DollarSign}
                    color="bg-blue-600"
                    clickable
                    onClick={() => openModal('Project Budgets', allProjects, 'financial')}
                />
                <MetricCard
                    title="Amount Spent"
                    value={`₱${totalSpent.toLocaleString()}`}
                    icon={BarChart3}
                    color="bg-violet-600"
                    clickable
                    onClick={() => openModal('Project Expenses', allProjects, 'financial')}
                />
            </div>

            {/* Graphs Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Activity Status Pie Chart */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Activity Status</h3>
                    <SimplePieChart data={activityData} onSliceClick={handleSliceClick} />
                </div>

                {/* Financials Bar Chart */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Financial Overview</h3>
                    <div className="space-y-6 py-4">
                        <FinancialBar
                            label="Total Budget"
                            value={totalBudget}
                            max={Math.max(totalBudget, totalSpent) * 1.1} // Scale relative to max
                            color={COLORS.Budget}
                        />
                        <FinancialBar
                            label="Amount Spent"
                            value={totalSpent}
                            max={Math.max(totalBudget, totalSpent) * 1.1}
                            color={COLORS.Spent}
                        />
                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-slate-500">Utilization Rate</span>
                                <span className={clsx("text-lg font-bold", totalSpent > totalBudget ? "text-red-500" : "text-emerald-600")}>
                                    {totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Breakdown Modal */}
            <BreakdownModal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                title={modalState.title}
                data={modalState.data}
                type={modalState.type}
            />
        </div>
    );
};

export default DashboardCharts;
