import React, { useState, useEffect } from 'react';
import { PieChart, BarChart3, Users, DollarSign, Activity, CheckCircle2, Clock, AlertTriangle, X, LayoutGrid, List } from 'lucide-react';
import clsx from 'clsx';

const COLORS = {
    'Pending': '#f59e0b', // Amber
    'Accomplished': '#10b981', // Emerald
    'Delayed': '#ef4444', // Red
    'Waitlisted': '#a855f7', // Purple
    'Budget': '#3b82f6', // Blue
    'Spent': '#8b5cf6'  // Violet
};

const PesoIcon = ({ size = 20, className }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        {/* The vertical stem of P */}
        <path d="M9 4v16" />
        {/* The loop of P */}
        <path d="M9 4h5.5a4.5 4.5 0 0 1 0 9H9" />
        {/* First horizontal bar crossing stem and loop completely */}
        <path d="M6 7h10.5" />
        {/* Second horizontal bar crossing stem and loop completely */}
        <path d="M6 10h10.5" />
    </svg>
);

const BreakdownModal = ({ isOpen, onClose, title, data = [], type }) => {
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
    const [selectedItem, setSelectedItem] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name_asc');

    // Reset selected item and filters when modal closes or opens with new data
    useEffect(() => {
        setSelectedItem(null);
        setSearchQuery('');
        setSortBy('name_asc');
    }, [isOpen, data]);

    const filteredAndSortedData = React.useMemo(() => {
        let result = [...data];

        // 1. Filter by search query (match name, title, project, division, status, etc.)
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(item => {
                const name = (item.name || item.title || `${item.first_name || ''} ${item.last_name || ''}`).toLowerCase();
                const project = (item.project_name || '').toLowerCase();
                const division = (item.division_name || item.division || '').toLowerCase();
                const status = (item.status || '').toLowerCase();
                const position = (item.position || '').toLowerCase();
                const fund = (item.fund || item.sourceOfFund || '').toLowerCase();
                return name.includes(q) || project.includes(q) || division.includes(q) || status.includes(q) || position.includes(q) || fund.includes(q);
            });
        }

        // 2. Sort by active sort key
        result.sort((a, b) => {
            const nameA = (a.name || a.title || `${a.first_name || ''} ${a.last_name || ''}`).toLowerCase();
            const nameB = (b.name || b.title || `${b.first_name || ''} ${b.last_name || ''}`).toLowerCase();

            if (sortBy === 'name_asc') {
                return nameA.localeCompare(nameB);
            } else if (sortBy === 'name_desc') {
                return nameB.localeCompare(nameA);
            } else if (sortBy === 'budget_desc') {
                const bA = Number(a.total_budget || a.allocation || a.gms_allocation || a.cost || a.actual_cost || 0);
                const bB = Number(b.total_budget || b.allocation || b.gms_allocation || b.cost || b.actual_cost || 0);
                return bB - bA;
            } else if (sortBy === 'budget_asc') {
                const bA = Number(a.total_budget || a.allocation || a.gms_allocation || a.cost || a.actual_cost || 0);
                const bB = Number(b.total_budget || b.allocation || b.gms_allocation || b.cost || b.actual_cost || 0);
                return bA - bB;
            } else if (sortBy === 'date_desc') {
                const dA = new Date(a.due_date || a.target_date || a.start_date || 0);
                const dB = new Date(b.due_date || b.target_date || b.start_date || 0);
                return dB - dA;
            } else if (sortBy === 'date_asc') {
                const dA = new Date(a.due_date || a.target_date || a.start_date || 0);
                const dB = new Date(b.due_date || b.target_date || b.start_date || 0);
                return dA - dB;
            }
            return 0;
        });

        return result;
    }, [data, searchQuery, sortBy]);

    if (!isOpen) return null;

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
        if (filteredAndSortedData.length === 0) {
            return <div className="p-8 text-center text-slate-500">No records found matching the query.</div>;
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
                                        <th className="px-4 py-3">Target Date</th>
                                        <th className="px-4 py-3">Project</th>
                                        <th className="px-4 py-3">Division</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredAndSortedData.map((item, idx) => {
                                const getRowColor = () => {
                                    return "hover:bg-slate-50";
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
                                                        item.status === 'Accomplished' ? 'bg-green-100 text-green-700' :
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
                    {filteredAndSortedData.map((item, idx) => (
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
                                                item.status === 'Accomplished' ? 'bg-green-100 text-green-700' :
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
                                    <div className="text-xs text-slate-550 space-y-1 mt-2 pt-2 border-t border-slate-100">
                                        <div className="flex justify-between">
                                            <span>Allocation:</span>
                                            <span className="font-mono font-bold text-slate-700">₱{Number(item.total_budget || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Obligated:</span>
                                            <span className="font-mono font-bold text-slate-700">₱{Number(item.actual_cost || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                )}

                                {type === 'milestone' && (
                                    <div className="text-xs text-slate-500 space-y-1.5">

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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-slate-100 bg-white shadow-sm z-10 gap-3">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600 flex-shrink-0">
                            {type === 'task' ? <Activity size={20} /> : type === 'employee' ? <Users size={20} /> : <DollarSign size={20} />}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight truncate">{title}</h3>
                            <p className="text-xs text-slate-500">{filteredAndSortedData.length} of {data.length} records found</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0">
                        {/* Search Input */}
                        <input
                            type="search"
                            placeholder="Search records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-normal bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                            style={{ width: '160px', height: '34px', margin: 0 }}
                        />

                        {/* Sort Dropdown */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="select text-xs"
                            style={{ width: '160px', height: '34px', padding: '0 8px', margin: 0 }}
                        >
                            <option value="name_asc">Name (A - Z)</option>
                            <option value="name_desc">Name (Z - A)</option>
                            {(type === 'financial' || type === 'task') && (
                                <>
                                    <option value="budget_desc">Budget (High - Low)</option>
                                    <option value="budget_asc">Budget (Low - High)</option>
                                </>
                            )}
                            {(type === 'task' || type === 'milestone') && (
                                <>
                                    <option value="date_desc">Date (Newest - Oldest)</option>
                                    <option value="date_asc">Date (Oldest - Newest)</option>
                                </>
                            )}
                        </select>

                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                            <button
                                onClick={() => setViewMode('list')}
                                className={clsx("p-1.5 rounded-md transition-all", viewMode === 'list' ? "bg-white shadow text-blue-600" : "text-slate-400 hover:text-slate-600")}
                                title="List View"
                                type="button"
                            >
                                <List size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={clsx("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-white shadow text-blue-600" : "text-slate-400 hover:text-slate-600")}
                                title="Grid View"
                                type="button"
                            >
                                <LayoutGrid size={18} />
                            </button>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors ml-auto sm:ml-0">
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

const MetricCard = ({ title, value, subtext, icon: Icon, color, onClick, clickable = false, isWarning = false, isFeatured = false, borderColor }) => (
    <div
        onClick={clickable ? onClick : undefined}
        className={clsx(
            "bg-white p-5 rounded-xl border shadow-sm flex items-start justify-between relative overflow-hidden group transition-all duration-200",
            isFeatured 
                ? "moving-blue-border"
                : (isWarning ? "border-red-500 bg-red-50/10 ring-1 ring-red-500" : (borderColor || "border-slate-200")),
            clickable && "cursor-pointer hover:shadow-md transition-all active:scale-[0.99]",
            clickable && (borderColor ? "" : "hover:border-blue-200")
        )}
    >
        <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1 flex items-center gap-1.5">
                {title}
                {isWarning && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">Exceeded</span>}
            </p>
            <h3 className={clsx("text-3xl md:text-4xl font-extrabold tracking-tight", isWarning ? "text-red-600" : "text-slate-800 dark:text-slate-100")}>{value}</h3>
            {subtext && <p className={clsx("text-xs mt-1", isWarning ? "text-red-500 font-medium" : "text-slate-400")}>{subtext}</p>}
        </div>
        <div className={clsx("p-3 rounded-lg transition-transform group-hover:scale-110", isWarning ? "bg-red-500" : color)}>
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
    const [tooltip, setTooltip] = useState({
        visible: false,
        x: 0,
        y: 0,
        label: '',
        value: '',
        share: 0,
        color: ''
    });

    if (total === 0) return <div className="text-center text-slate-400 py-10">No activities found</div>;

    const radius = 15.91549430918954;
    let currentStart = 0;

    const slices = data.map((item, index) => {
        const p = (item.value / total) * 100;
        const offset = 100 - currentStart;
        currentStart += p;

        return {
            ...item,
            percent: p,
            offset: offset,
            share: Math.round(p)
        };
    });

    const formatVal = (val, isCurrency) => isCurrency ? `₱${Number(val).toLocaleString()}` : val;

    return (
        <div className="flex flex-col items-center justify-center gap-6 relative w-full">
            <div className="relative w-48 h-48 flex items-center justify-center">
                <svg viewBox="0 0 42 42" className="w-full h-full transform -rotate-90">
                    {slices.map((slice, i) => (
                        <circle
                            key={i}
                            cx="21"
                            cy="21"
                            r={radius}
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth={hoveredIndex === i ? 6.5 : 5.5}
                            strokeDasharray={`${slice.percent} ${100 - slice.percent}`}
                            strokeDashoffset={slice.offset}
                            style={{
                                cursor: 'pointer',
                                transition: 'stroke-width 0.15s ease',
                            }}
                            onPointerOver={(e) => {
                                setHoveredIndex(i);
                                setTooltip({
                                    visible: true,
                                    x: e.clientX,
                                    y: e.clientY,
                                    label: slice.label,
                                    value: formatVal(slice.value, slice.isCurrency),
                                    share: slice.share,
                                    color: slice.color
                                });
                            }}
                            onPointerMove={(e) => {
                                setTooltip(prev => ({
                                    ...prev,
                                    x: e.clientX,
                                    y: e.clientY
                                }));
                            }}
                            onPointerLeave={() => {
                                setHoveredIndex(null);
                                setTooltip(prev => ({ ...prev, visible: false }));
                            }}
                            onClick={() => onSliceClick && onSliceClick(slice)}
                        />
                    ))}
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-xl font-bold text-slate-800">
                        {hoveredIndex !== null ? formatVal(slices[hoveredIndex].value, slices[hoveredIndex].isCurrency) : formatVal(total, slices[0]?.isCurrency)}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {hoveredIndex !== null ? slices[hoveredIndex].label : "Total"}
                    </span>
                </div>
            </div>
            
            <div className="flex-1 w-full min-w-[200px]">
                <table className="w-full text-sm">
                    <tbody>
                        {slices.map((item, i) => (
                            <tr 
                                key={i} 
                                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 cursor-pointer"
                                onClick={() => onSliceClick && onSliceClick(item)}
                                onPointerOver={(e) => {
                                    setHoveredIndex(i);
                                    setTooltip({
                                        visible: true,
                                        x: e.clientX,
                                        y: e.clientY,
                                        label: item.label,
                                        value: formatVal(item.value, item.isCurrency),
                                        share: item.share,
                                        color: item.color
                                    });
                                }}
                                onPointerMove={(e) => {
                                    setTooltip(prev => ({
                                        ...prev,
                                        x: e.clientX,
                                        y: e.clientY
                                    }));
                                }}
                                onPointerLeave={() => {
                                    setHoveredIndex(null);
                                    setTooltip(prev => ({ ...prev, visible: false }));
                                }}
                            >
                                <td className="py-2 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-slate-600 font-medium">{item.label}</span>
                                </td>
                                <td className="py-2 text-right font-bold text-slate-800">
                                    {formatVal(item.value, item.isCurrency)}
                                </td>
                                <td className="py-2 text-right font-black text-slate-400 w-12">
                                    {item.share}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {tooltip.visible && (
                <div 
                    className="bar-hover-tooltip"
                    style={{
                        position: 'fixed',
                        left: tooltip.x + 15,
                        top: tooltip.y + 15,
                        backgroundColor: '#FFFFFF',
                        color: '#08315F',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        boxShadow: '0 10px 18px -3px rgba(8, 49, 95, 0.12), 0 4px 6px -2px rgba(8, 49, 95, 0.08)',
                        zIndex: 9999,
                        pointerEvents: 'none',
                        transition: 'opacity 0.1s ease',
                        border: '2px solid #DBEAFE',
                        fontFamily: 'var(--font)'
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <span 
                                style={{ 
                                    width: '8px', 
                                    height: '8px', 
                                    borderRadius: '50%', 
                                    backgroundColor: tooltip.color,
                                    display: 'inline-block',
                                    boxShadow: `0 0 6px ${tooltip.color}`
                                }} 
                            />
                            <span style={{ fontWeight: '800', textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.08em', color: '#08315F' }}>
                                {tooltip.label}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', fontSize: '11px' }}>
                            <span style={{ color: '#475569', fontWeight: '600' }}>Amount:</span>
                            <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: '#08315F' }}>{tooltip.value}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', fontSize: '11px' }}>
                            <span style={{ color: '#475569', fontWeight: '600' }}>Share:</span>
                            <span style={{ fontWeight: 'bold', color: '#16A34A' }}>{tooltip.share}%</span>
                        </div>
                    </div>
                </div>
            )}
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
        waitlistedActivities = 0,
        totalBudget,
        totalSpent,
        totalGaaPs,
        totalGaaMooe,
        // Detailed Data Arrays
        allProjects = [],
        allEmployees = [],
        allTasks = [],
        pendingTasks = [],
        accomplishedTasks = [],
        delayedTasks = [],
        waitlistedTasks = []
    } = metrics;

    // Add missing fallback for detailed arrays to avoid crashes
    const totalGaaPsVal = totalGaaPs || 0;
    const totalGaaMooeVal = totalGaaMooe || 0;

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

    const remainingBudget = Math.max(0, totalBudget - totalSpent);
    const financialPieData = [
        { label: 'Obligated Funds', value: totalSpent, color: COLORS.Spent, isCurrency: true },
        { label: 'Remaining Budget', value: remainingBudget, color: COLORS.Accomplished, isCurrency: true }
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
            else if (slice.label === 'Waitlisted') data = waitlistedTasks;
            else if (slice.label === 'Delayed') data = delayedTasks;
        }

        openModal(titleMap[slice.label] || `${slice.label} Activities`, data, 'task');
    };

    const accomplishmentRate = totalActivities > 0 ? (accomplishedActivities / totalActivities) * 100 : 0;
    const utilizationRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return (
        <div className="space-y-6">
            {/* Metric Cards Row (Activities & Milestones) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MetricCard
                    title="Activity Accomplishment Rate"
                    value={`${accomplishmentRate.toFixed(1)}%`}
                    subtext={`${accomplishedActivities} of ${totalActivities} activities accomplished`}
                    icon={Activity}
                    color="bg-blue-500"
                    clickable
                    isFeatured
                    onClick={() => openModal('Accomplished Activities', accomplishedTasks, 'task')}
                />
                <MetricCard
                    title="Utilization Rate"
                    value={`${utilizationRate.toFixed(1)}%`}
                    subtext={`₱${totalSpent.toLocaleString()} obligated of ₱${totalBudget.toLocaleString()}`}
                    icon={DollarSign}
                    color="bg-emerald-600"
                    clickable
                    borderColor="moving-green-border"
                    onClick={() => openModal('Project Financial Breakdown', allProjects, 'financial')}
                />
            </div>

            {/* Graphs Row - Side-by-side separated donut charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Activity Status */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="mb-6 border-b border-slate-100 pb-4">
                        <h3 className="text-lg font-bold text-slate-800">Activity Status</h3>
                    </div>
                    <div className="space-y-6 flex-1 flex flex-col justify-between">
                        <SimplePieChart data={activityData} onSliceClick={handleSliceClick} />
                        <div className="h-[76px] mt-6 bg-transparent pointer-events-none" />
                    </div>
                </div>

                {/* Financial Overview */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="mb-6 border-b border-slate-100 pb-4">
                        <h3 className="text-lg font-bold text-slate-800">Financial Overview</h3>
                    </div>
                    <div className="space-y-6 flex-1 flex flex-col justify-between">
                        <SimplePieChart data={financialPieData} onSliceClick={() => openModal('Project Financial Breakdown', allProjects, 'financial')} />
                        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-100 bg-slate-50/50 p-4 rounded-xl">
                            <div className="flex flex-col">
                                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Allocation</span>
                                <span className="text-base font-black text-slate-800">₱{totalBudget.toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Utilization Rate</span>
                                <span className={clsx("text-base font-black", totalSpent > totalBudget ? "text-red-500" : "text-emerald-600")}>
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
