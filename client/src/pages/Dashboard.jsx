import React, { useEffect, useState, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { getEmployees, getProjects, getProjectTasks, getProjectFinancials, getDivisions, getAllCatchUps, getAllMilestones, getBulkActivities } from '../api';
import CalendarView from '../components/CalendarView';
import SpilloverTracker from '../components/SpilloverTracker';
import Loader from '../components/Loader';
import CreateTaskModal from '../components/CreateTaskModal';
import { Settings, X, Activity } from 'lucide-react';
import clsx from 'clsx';

const getRateColorClass = (val) => {
    const v = Number(val || 0);
    if (v <= 25) return 'text-rose-500 dark:text-rose-400';
    if (v <= 50) return 'text-amber-500 dark:text-amber-400';
    if (v <= 75) return 'text-blue-500 dark:text-blue-400';
    if (v <= 90) return 'text-emerald-500 dark:text-emerald-400';
    return 'text-green-600 dark:text-green-400';
};

const getUtilColorClass = getRateColorClass;
const getAccomColorClass = getRateColorClass;

const ActivityBreakdownModal = ({ isOpen, onClose, title, activities = [], onEditActivity }) => {
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name_asc');

    // Column Filters & Header Sorts
    const [columnFilters, setColumnFilters] = useState({
        name: '',
        division: '',
        project: '',
        status: '',
        sourceOfFund: '',
        budget: '',
        obligated: ''
    });
    const [sortColumn, setSortColumn] = useState('name');
    const [sortDirection, setSortDirection] = useState('asc');

    // Reset selected activity and filters when modal closes or data changes
    useEffect(() => {
        setSelectedActivity(null);
        setSearchQuery('');
        setSortBy('name_asc');
        setColumnFilters({
            name: '',
            division: '',
            project: '',
            status: '',
            sourceOfFund: '',
            budget: '',
            obligated: ''
        });
        setSortColumn('name');
        setSortDirection('asc');
    }, [isOpen, activities]);

    const handleSort = (col) => {
        if (sortColumn === col) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(col);
            setSortDirection('asc');
        }
    };

    const filteredAndSortedActivities = React.useMemo(() => {
        let result = [...activities];

        // 1. General Search Query Filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(item => {
                const name = (item.name || '').toLowerCase();
                const project = (item.project || '').toLowerCase();
                const division = (item.division || '').toLowerCase();
                const status = (item.status || '').toLowerCase();
                const sourceOfFund = (item.sourceOfFund || '').toLowerCase();
                return name.includes(q) || project.includes(q) || division.includes(q) || status.includes(q) || sourceOfFund.includes(q);
            });
        }

        // 2. Column-specific filters
        Object.keys(columnFilters).forEach(key => {
            const val = columnFilters[key];
            if (val) {
                const q = val.toLowerCase();
                result = result.filter(item => {
                    let cellVal = '';
                    if (key === 'name') cellVal = item.name || '';
                    else if (key === 'division') cellVal = item.division || '';
                    else if (key === 'project') cellVal = item.project || '';
                    else if (key === 'status') cellVal = item.status || '';
                    else if (key === 'sourceOfFund') cellVal = item.sourceOfFund || '';
                    else if (key === 'budget') cellVal = String(Math.round(item.budget > 0 ? (item.obligated / item.budget) * 100 : 0)) + '%';
                    else if (key === 'obligated') cellVal = String((item.status === 'Completed' || item.status === 'Accomplished') ? 100 : 0) + '%';
                    return cellVal.toLowerCase().includes(q);
                });
            }
        });

        // 3. Header Sort or SortBy dropdown fallback
        result.sort((a, b) => {
            let valA, valB;
            if (sortColumn) {
                // Header sort takes precedence if sortColumn is active
                if (sortColumn === 'name') {
                    valA = a.name || '';
                    valB = b.name || '';
                } else if (sortColumn === 'division') {
                    valA = a.division || '';
                    valB = b.division || '';
                } else if (sortColumn === 'project') {
                    valA = a.project || '';
                    valB = b.project || '';
                } else if (sortColumn === 'status') {
                    valA = a.status || '';
                    valB = b.status || '';
                } else if (sortColumn === 'sourceOfFund') {
                    valA = a.sourceOfFund || '';
                    valB = b.sourceOfFund || '';
                } else if (sortColumn === 'budget') {
                    valA = a.budget > 0 ? (a.obligated / a.budget) * 100 : 0;
                    valB = b.budget > 0 ? (b.obligated / b.budget) * 100 : 0;
                } else if (sortColumn === 'obligated') {
                    valA = (a.status === 'Completed' || a.status === 'Accomplished') ? 100 : 0;
                    valB = (b.status === 'Completed' || b.status === 'Accomplished') ? 100 : 0;
                }

                if (typeof valA === 'number' && typeof valB === 'number') {
                    return sortDirection === 'asc' ? valA - valB : valB - valA;
                } else {
                    return sortDirection === 'asc'
                        ? String(valA).localeCompare(String(valB))
                        : String(valB).localeCompare(String(valA));
                }
            } else {
                // Fallback to SortBy dropdown
                if (sortBy === 'name_asc') {
                    return (a.name || '').localeCompare(b.name || '');
                } else if (sortBy === 'name_desc') {
                    return (b.name || '').localeCompare(a.name || '');
                } else if (sortBy === 'budget_desc') {
                    return Number(b.budget || 0) - Number(a.budget || 0);
                } else if (sortBy === 'budget_asc') {
                    return Number(a.budget || 0) - Number(b.budget || 0);
                } else if (sortBy === 'date_desc') {
                    const dA = new Date(a.due || a.lastUpdate || 0);
                    const dB = new Date(b.due || b.lastUpdate || 0);
                    return dB - dA;
                } else if (sortBy === 'date_asc') {
                    const dA = new Date(a.due || a.lastUpdate || 0);
                    const dB = new Date(b.due || b.lastUpdate || 0);
                    return dA - dB;
                }
            }
            return 0;
        });

        return result;
    }, [activities, searchQuery, columnFilters, sortColumn, sortDirection, sortBy]);

    if (!isOpen) return null;

    const fmt = v => Number(v || 0).toLocaleString("en-PH");
    const peso = v => "₱" + Number(v || 0).toLocaleString("en-PH");
    const pct = (v, dec = 0) => dec === 0 ? Math.round(v || 0) + "%" : Number(v || 0).toFixed(dec) + "%";

    if (selectedActivity) {
        let statusBadgeClass = 'bg-slate-100 text-slate-700';
        if (selectedActivity.status === 'Completed' || selectedActivity.status === 'Accomplished') {
            statusBadgeClass = 'bg-green-100 text-green-700';
        } else if (selectedActivity.status === 'In Progress') {
            statusBadgeClass = 'bg-blue-100 text-blue-700';
        } else if (selectedActivity.status === 'Delayed') {
            statusBadgeClass = 'bg-red-100 text-red-700';
        }

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-xs">
                <div className="bg-white rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
                        <h3 className="text-lg font-bold text-slate-800">Activity Details</h3>
                        <button onClick={() => setSelectedActivity(null)} className="text-slate-400 hover:text-slate-650 p-1 bg-white rounded-full border border-slate-200 shadow-xs transition-colors cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                        <div>
                            <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Activity Title</label>
                            <p className="text-lg font-bold text-slate-800 mt-1">{selectedActivity.name}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Division</label>
                                <p className="text-sm font-semibold text-slate-700 mt-1">{selectedActivity.division || 'Unassigned'}</p>
                            </div>
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Project</label>
                                <p className="text-sm font-semibold text-slate-700 mt-1">{selectedActivity.project}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Status</label>
                                <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-bold mt-1.5 inline-block", statusBadgeClass)}>
                                    {selectedActivity.status || 'Pending'}
                                </span>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Allocation</label>
                                <span className="text-sm font-mono font-bold text-slate-800 block mt-1.5">{peso(selectedActivity.budget)}</span>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Obligated</label>
                                <span className="text-sm font-mono font-bold text-slate-800 block mt-1.5">{peso(selectedActivity.obligated)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Last Updated</label>
                                <p className="text-xs text-slate-650 mt-1 font-semibold">
                                    {selectedActivity.lastUpdate ? new Date(selectedActivity.lastUpdate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Not available'}
                                </p>
                            </div>
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Due Date</label>
                                <p className="text-xs text-slate-650 mt-1 font-semibold">
                                    {selectedActivity.due ? new Date(selectedActivity.due).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Not specified'}
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Remarks / Description</label>
                            <p className="text-sm text-slate-600 mt-1 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap min-h-[60px]">
                                {selectedActivity.remarks || selectedActivity.description || "No remarks or description recorded."}
                            </p>
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
                        <button
                            onClick={() => setSelectedActivity(null)}
                            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                        >
                            Back to List
                        </button>
                        <button
                            onClick={() => {
                                onEditActivity(selectedActivity);
                                setSelectedActivity(null);
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                        >
                            Edit Activity
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-slate-100 bg-white shadow-xs z-10 gap-3">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600 flex-shrink-0">
                            <Activity size={20} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight truncate">{title}</h3>
                            <p className="text-xs text-slate-500">{filteredAndSortedActivities.length} of {activities.length} records found</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0">
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                            <button
                                onClick={() => setViewMode('list')}
                                className={clsx("p-1.5 rounded-md transition-all cursor-pointer", viewMode === 'list' ? "bg-white shadow text-blue-600" : "text-slate-400 hover:text-slate-650")}
                                title="List View"
                                type="button"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={clsx("p-1.5 rounded-md transition-all cursor-pointer", viewMode === 'grid' ? "bg-white shadow text-blue-600" : "text-slate-400 hover:text-slate-650")}
                                title="Grid View"
                                type="button"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                            </button>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-650 hover:bg-slate-100 p-2 rounded-full transition-colors ml-auto sm:ml-0 cursor-pointer">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4">
                    {filteredAndSortedActivities.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No records found matching the query.</div>
                    ) : viewMode === 'list' ? (
                        <div className="overflow-x-auto bg-white rounded-xl border border-slate-100 shadow-xs">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs sticky top-0 border-b border-slate-100">
                                    <tr className="border-b border-slate-150">
                                        <th onClick={() => handleSort('name')} className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100 transition-colors">
                                            Activity {sortColumn === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th onClick={() => handleSort('division')} className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100 transition-colors">
                                            Division {sortColumn === 'division' && (sortDirection === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th onClick={() => handleSort('project')} className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100 transition-colors">
                                            Project {sortColumn === 'project' && (sortDirection === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th onClick={() => handleSort('status')} className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100 transition-colors">
                                            Status {sortColumn === 'status' && (sortDirection === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th onClick={() => handleSort('sourceOfFund')} className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100 transition-colors">
                                            Fund {sortColumn === 'sourceOfFund' && (sortDirection === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th onClick={() => handleSort('budget')} className="px-4 py-3 text-right cursor-pointer select-none hover:bg-slate-100 transition-colors">
                                            Utilization Rate {sortColumn === 'budget' && (sortDirection === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th onClick={() => handleSort('obligated')} className="px-4 py-3 text-right cursor-pointer select-none hover:bg-slate-100 transition-colors">
                                            Accomplishment Rate {sortColumn === 'obligated' && (sortDirection === 'asc' ? '▲' : '▼')}
                                        </th>
                                    </tr>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-2 py-1">
                                            <input
                                                type="search"
                                                placeholder="Filter..."
                                                value={columnFilters.name}
                                                onChange={(e) => setColumnFilters(prev => ({ ...prev, name: e.target.value }))}
                                                className="column-filter w-full text-xs font-normal"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </th>
                                        <th className="px-2 py-1">
                                            <input
                                                type="search"
                                                placeholder="Filter..."
                                                value={columnFilters.division}
                                                onChange={(e) => setColumnFilters(prev => ({ ...prev, division: e.target.value }))}
                                                className="column-filter w-full text-xs font-normal"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </th>
                                        <th className="px-2 py-1">
                                            <input
                                                type="search"
                                                placeholder="Filter..."
                                                value={columnFilters.project}
                                                onChange={(e) => setColumnFilters(prev => ({ ...prev, project: e.target.value }))}
                                                className="column-filter w-full text-xs font-normal"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </th>
                                        <th className="px-2 py-1">
                                            <input
                                                type="search"
                                                placeholder="Filter..."
                                                value={columnFilters.status}
                                                onChange={(e) => setColumnFilters(prev => ({ ...prev, status: e.target.value }))}
                                                className="column-filter w-full text-xs font-normal"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </th>
                                        <th className="px-2 py-1">
                                            <input
                                                type="search"
                                                placeholder="Filter..."
                                                value={columnFilters.sourceOfFund}
                                                onChange={(e) => setColumnFilters(prev => ({ ...prev, sourceOfFund: e.target.value }))}
                                                className="column-filter w-full text-xs font-normal"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </th>
                                        <th className="px-2 py-1 text-right">
                                            <input
                                                type="search"
                                                placeholder="Filter..."
                                                value={columnFilters.budget}
                                                onChange={(e) => setColumnFilters(prev => ({ ...prev, budget: e.target.value }))}
                                                className="column-filter w-full text-xs font-normal text-right"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </th>
                                        <th className="px-2 py-1 text-right">
                                            <input
                                                type="search"
                                                placeholder="Filter..."
                                                value={columnFilters.obligated}
                                                onChange={(e) => setColumnFilters(prev => ({ ...prev, obligated: e.target.value }))}
                                                className="column-filter w-full text-xs font-normal text-right"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredAndSortedActivities.map((item, idx) => {
                                        let statusClass = 'bg-slate-100 text-slate-600';
                                        if (item.status === 'Completed' || item.status === 'Accomplished') statusClass = 'bg-green-100 text-green-700';
                                        else if (item.status === 'In Progress') statusClass = 'bg-blue-100 text-blue-700';
                                        else if (item.status === 'Delayed') statusClass = 'bg-red-100 text-red-700';

                                        return (
                                            <tr
                                                key={item.id || idx}
                                                onClick={() => setSelectedActivity(item)}
                                                className="transition-colors hover:bg-slate-50 cursor-pointer"
                                            >
                                                <td className="px-4 py-3 font-semibold text-slate-800 max-w-xs truncate" title={item.name}>
                                                    {item.name}
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 text-xs">{item.division}</td>
                                                <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[150px]" title={item.project}>{item.project}</td>
                                                <td className="px-4 py-3">
                                                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-bold inline-block", statusClass)}>
                                                        {item.status || 'Pending'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 text-xs">{item.sourceOfFund}</td>
                                                <td className={`px-4 py-3 text-right font-mono font-extrabold ${getUtilColorClass(item.budget > 0 ? (item.obligated / item.budget) * 100 : 0)}`}>{pct(item.budget > 0 ? (item.obligated / item.budget) * 100 : 0)}</td>
                                                <td className={`px-4 py-3 text-right font-mono font-extrabold ${getAccomColorClass((item.status === 'Completed' || item.status === 'Accomplished') ? 100 : 0)}`}>{pct((item.status === 'Completed' || item.status === 'Accomplished') ? 100 : 0)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredAndSortedActivities.map((item, idx) => {
                                let statusClass = 'bg-slate-100 text-slate-600';
                                if (item.status === 'Completed' || item.status === 'Accomplished') statusClass = 'bg-green-100 text-green-700';
                                else if (item.status === 'In Progress') statusClass = 'bg-blue-100 text-blue-700';
                                else if (item.status === 'Delayed') statusClass = 'bg-red-100 text-red-700';

                                return (
                                    <div 
                                        key={item.id || idx} 
                                        onClick={() => setSelectedActivity(item)}
                                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                                    >
                                        <div>
                                            <h4 className="font-bold text-slate-800 mb-2 truncate" title={item.name}>
                                                {item.name}
                                            </h4>
                                            <div className="text-xs text-slate-500 space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <span>Status:</span>
                                                    <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold", statusClass)}>{item.status || 'Pending'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Project:</span>
                                                    <span className="truncate max-w-[150px]" title={item.project}>{item.project}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Division:</span>
                                                    <span>{item.division}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Fund:</span>
                                                    <span>{item.sourceOfFund}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500 space-y-1 mt-3 pt-3 border-t border-slate-100">
                                            <div className="flex justify-between">
                                                <span>Utilization Rate:</span>
                                                <span className={`font-mono font-extrabold ${getUtilColorClass(item.budget > 0 ? (item.obligated / item.budget) * 100 : 0)}`}>{pct(item.budget > 0 ? (item.obligated / item.budget) * 100 : 0)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Accomplishment Rate:</span>
                                                <span className={`font-mono font-extrabold ${getAccomColorClass((item.status === 'Completed' || item.status === 'Accomplished') ? 100 : 0)}`}>{pct((item.status === 'Completed' || item.status === 'Accomplished') ? 100 : 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ActivityDetailsModal = ({ activity, onClose, onEdit }) => {
    if (!activity) return null;
    let statusBadgeClass = 'bg-slate-100 text-slate-700';
    if (activity.status === 'Completed' || activity.status === 'Accomplished') {
        statusBadgeClass = 'bg-green-100 text-green-700';
    } else if (activity.status === 'In Progress') {
        statusBadgeClass = 'bg-blue-100 text-blue-700';
    } else if (activity.status === 'Delayed') {
        statusBadgeClass = 'bg-red-100 text-red-700';
    }
    const peso = v => "₱" + Number(v || 0).toLocaleString("en-PH");

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
                    <h3 className="text-lg font-bold text-slate-800 font-sans">Activity Details</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 bg-white rounded-full border border-slate-200 shadow-xs transition-colors cursor-pointer">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                    <div>
                        <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Activity Title</label>
                        <p className="text-lg font-bold text-slate-800 mt-1">{activity.name}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Division</label>
                            <p className="text-sm font-semibold text-slate-700 mt-1">{activity.division || 'Unassigned'}</p>
                        </div>
                        <div>
                            <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Project</label>
                            <p className="text-sm font-semibold text-slate-700 mt-1">{activity.project}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Status</label>
                            <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-bold mt-1.5 inline-block", statusBadgeClass)}>
                                {activity.status || 'Pending'}
                            </span>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Allocation</label>
                            <span className="text-sm font-mono font-bold text-slate-800 block mt-1.5">{peso(activity.budget)}</span>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Obligated</label>
                            <span className="text-sm font-mono font-bold text-slate-800 block mt-1.5">{peso(activity.obligated)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Last Updated</label>
                            <p className="text-xs text-slate-600 mt-1 font-semibold">
                                {activity.lastUpdate ? new Date(activity.lastUpdate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Not available'}
                            </p>
                        </div>
                        <div>
                            <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Due Date</label>
                            <p className="text-xs text-slate-600 mt-1 font-semibold">
                                {activity.due ? new Date(activity.due).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Not specified'}
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs uppercase font-bold text-slate-400 tracking-wider">Remarks / Description</label>
                        <p className="text-sm text-slate-605 mt-1 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap min-h-[60px]">
                            {activity.remarks || activity.description || "No remarks or description recorded."}
                        </p>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => {
                            onEdit(activity);
                            onClose();
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                    >
                        Edit Activity
                    </button>
                </div>
            </div>
        </div>
    );
};

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
    const [detailModal, setDetailModal] = useState({
        isOpen: false,
        title: '',
        activities: []
    });

    // New dashboard filters
    const [selectedRegistryActivity, setSelectedRegistryActivity] = useState(null);
    const [fundFilter, setFundFilter] = useState('all');
    const [expenditureFilter, setExpenditureFilter] = useState('all');
    const [utilizationFilter, setUtilizationFilter] = useState('all');

    // Advanced Data Controls & Category Picker
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState(null);
    const [categorySearchQuery, setCategorySearchQuery] = useState('');
    const [categorySortMode, setCategorySortMode] = useState('value');
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [hoveredDonutIndex, setHoveredDonutIndex] = useState(null);
    const [hoveredActivityDonutIndex, setHoveredActivityDonutIndex] = useState(null);
    const [hoveredFinancialDonutIndex, setHoveredFinancialDonutIndex] = useState(null);
    const [tooltip, setTooltip] = useState({
        visible: false,
        x: 0,
        y: 0,
        content: null
    });

    const showTooltip = (e, label, value, share, color = null) => {
        setTooltip({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            color: color,
            content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        {color && (
                            <span 
                                style={{ 
                                    width: '8px', 
                                    height: '8px', 
                                    borderRadius: '50%', 
                                    backgroundColor: color,
                                    display: 'inline-block',
                                    boxShadow: `0 0 6px ${color}`
                                }} 
                            />
                        )}
                        <span style={{ fontWeight: '800', textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.08em', color: '#08315F' }}>
                            {label}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', fontSize: '11px' }}>
                        <span style={{ color: '#475569', fontWeight: '600' }}>Amount:</span>
                        <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: '#08315F' }}>{value}</span>
                    </div>
                    {share !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', fontSize: '11px' }}>
                            <span style={{ color: '#475569', fontWeight: '600' }}>Share:</span>
                            <span style={{ fontWeight: 'bold', color: '#16A34A' }}>{share}%</span>
                        </div>
                    )}
                </div>
            )
        });
    };

    const updateTooltipPosition = (e) => {
        setTooltip(prev => ({
            ...prev,
            x: e.clientX,
            y: e.clientY
        }));
    };

    const hideTooltip = () => {
        setTooltip(prev => ({
            ...prev,
            visible: false
        }));
    };

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
    const pct = (v, dec = 0) => dec === 0 ? Math.round(v || 0) + "%" : Number(v || 0).toFixed(dec) + "%";

    const getProjectSourceOfFund = (p) => {
        return p.source_of_fund || 'GAA-PS';
    };

    const normalizeDivision = (div) => {
        if (!div || div.trim().toLowerCase() === 'n/a') return 'Unassigned';
        return div;
    };

    const getFilteredActivities = (list, type, val) => {
        if (type === 'status') {
            return list.filter(a => a.status === val);
        }
        if (type === 'budget') {
            if (val === 'Utilized') return list.filter(a => a.obligated > 0 || a.used > 0);
            if (val === 'Unutilized') return list.filter(a => (a.budget - a.obligated) > 0 || (a.budget - a.used) > 0);
        }
        if (type === 'fund') {
            return list.filter(a => a.sourceOfFund === val);
        }
        return list;
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
                    const isDeferred = t.status === 'Deferred';
                    const isOverdue = t.due_date && new Date(t.due_date) < today;
                    let resolvedStatus = 'Pending';
                    if (isAccomplished) {
                        resolvedStatus = 'Accomplished';
                    } else if (isDeferred) {
                        resolvedStatus = 'Deferred';
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
                { id: 'Accomplished', label: 'Accomplished', count: activeActivities.filter(a => a.status === 'Accomplished').length, value: activeActivities.filter(a => a.status === 'Accomplished').reduce((s, a) => s + a.budget, 0) },
                { id: 'Pending', label: 'Pending', count: activeActivities.filter(a => a.status === 'Pending').length, value: activeActivities.filter(a => a.status === 'Pending').reduce((s, a) => s + a.budget, 0) },
                { id: 'Delayed', label: 'Delayed', count: activeActivities.filter(a => a.status === 'Delayed').length, value: activeActivities.filter(a => a.status === 'Delayed').reduce((s, a) => s + a.budget, 0) },
                { id: 'Deferred', label: 'Deferred', count: activeActivities.filter(a => a.status === 'Deferred').length, value: activeActivities.filter(a => a.status === 'Deferred').reduce((s, a) => s + a.budget, 0) },
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
        const deferred = activeActivities.filter(r => r.status === 'Deferred');

        return {
            budget: tBudget,
            obligated: tObligated,
            used: tUsed,
            accomplished: accomplishments,
            pending: pending,
            delayed: delayed,
            deferred: deferred
        };
    }, [activeActivities]);

    // Accomplishment Snapshot side-by-side donuts for division view
    const activityDonutData = useMemo(() => {
        return [
            { label: "Accomplished", value: totals.accomplished.length, color: colors.green },
            { label: "Pending", value: totals.pending.length, color: colors.gold },
            { label: "Delayed", value: totals.delayed.length, color: colors.red },
            { label: "Deferred", value: totals.deferred.length, color: colors.slate }
        ];
    }, [totals]);

    const activityDonutTotal = activityDonutData.reduce((s, r) => s + r.value, 0) || 1;

    const processedActivityDonutSlices = (() => {
        let currentStart = 0;
        return activityDonutData.map((r, idx) => {
            let p = activityDonutTotal > 0 ? (r.value / activityDonutTotal) * 100 : 0;
            // Visual boost for very small non-zero slices so they are visible on the ring
            if (r.value > 0 && p < 0.6) {
                p = 0.6;
            }
            const offset = 100 - currentStart;
            currentStart += p;
            return {
                ...r,
                originalIndex: idx,
                percent: p,
                offset: offset,
                share: Math.round(activityDonutTotal > 0 ? (r.value / activityDonutTotal) * 100 : 0)
            };
        });
    })();

    const financialDonutData = useMemo(() => {
        return [
            { label: "Utilized", value: totals.used, color: colors.blue },
            { label: "Unutilized", value: Math.max(totals.budget - totals.used, 0), color: colors.gold }
        ];
    }, [totals]);

    const financialDonutTotal = financialDonutData.reduce((s, r) => s + r.value, 0) || 1;

    const processedFinancialDonutSlices = (() => {
        let currentStart = 0;
        return financialDonutData.map((r, idx) => {
            let p = financialDonutTotal > 0 ? (r.value / financialDonutTotal) * 100 : 0;
            // Visual boost for very small non-zero slices so they are visible on the ring
            if (r.value > 0 && p < 0.6) {
                p = 0.6;
            }
            const offset = 100 - currentStart;
            currentStart += p;
            return {
                ...r,
                originalIndex: idx,
                percent: p,
                offset: offset,
                share: Math.round(financialDonutTotal > 0 ? (r.value / financialDonutTotal) * 100 : 0)
            };
        });
    })();

    const compactPeso = v => {
        if (v >= 1e9) return "₱" + (v / 1e9).toFixed(2) + "B";
        if (v >= 1e6) return "₱" + (v / 1e6).toFixed(2) + "M";
        if (v >= 1e3) return "₱" + (v / 1e3).toFixed(2) + "K";
        return "₱" + Number(v || 0).toLocaleString("en-PH");
    };

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
            if (key === 'budget') {
                return r.budget > 0 ? (r.obligated / r.budget) * 100 : 0;
            }
            if (key === 'obligated') {
                return (r.status === 'Completed' || r.status === 'Accomplished') ? 100 : 0;
            }
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
                    Math.round(getRowVal(r, 'budget')) + '%',
                    Math.round(getRowVal(r, 'obligated')) + '%'
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
    const renderStackedSegments = (values, scale, classes, labels, formatValue = fmt, onClickSegment = null, totalForShare = null) => {
        const totalSum = totalForShare || values.reduce((s, val) => s + val, 0) || 1;
        return values.map((v, i) => {
            const width = scale ? Math.max((v / scale) * 100, 0) : 0;
            if (v === 0) return null;
            const text = formatValue(v);
            const share = Math.round((v / totalSum) * 100);
            
            let segColor = null;
            if (classes[i]) {
                const name = classes[i].replace('seg-', '');
                segColor = colors[name] || null;
            }
            
            return (
                <div 
                    key={i}
                    className={`segment ${classes[i]}`} 
                    style={{ width: `${width}%`, cursor: onClickSegment ? 'pointer' : 'default' }} 
                    title={`${labels[i]}: ${text}`}
                    onClick={(e) => {
                        if (onClickSegment) {
                            e.stopPropagation();
                            onClickSegment(labels[i]);
                        }
                    }}
                    onPointerDown={(e) => showTooltip(e, labels[i], text, share, segColor)}
                    onPointerOver={(e) => showTooltip(e, labels[i], text, share, segColor)}
                    onPointerMove={updateTooltipPosition}
                    onPointerLeave={hideTooltip}
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
                { label: "Accomplished", value: metricValue(totals.accomplished), color: colors.green },
                { label: "Pending", value: metricValue(totals.pending), color: colors.gold },
                { label: "Delayed", value: metricValue(totals.delayed), color: colors.red },
                { label: "Deferred", value: metricValue(totals.deferred), color: colors.slate }
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

    let currentStart = 0;
    const processedDonutSlices = donutData.map(r => {
        const p = (r.value / donutTotal) * 100;
        const offset = 100 - currentStart;
        currentStart += p;
        return {
            ...r,
            percent: p,
            offset: offset,
            share: Math.round(p)
        };
    });


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
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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

            {/* KPI Grid */}
            <div className="flex flex-wrap gap-4 w-full mb-6">
                {/* Activities Completion Rate Card */}
                <div className="flex-grow w-full sm:w-[calc(50%-8px)] md:w-[calc(33.333%-11px)] lg:w-[calc(20%-13px)] bg-white dark:bg-slate-900 border-2 border-sky-100 dark:border-slate-850 p-5 rounded-2xl flex flex-col justify-between shadow-xs transition-transform hover:scale-[1.02] duration-200">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Activities Completion Rate</span>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold text-[var(--navy)] dark:text-slate-100 tracking-tight" style={{ fontSize: 'clamp(36px, 2.5vw, 43px)' }}>
                            {pct(activeActivities.length > 0 ? (totals.accomplished.length / activeActivities.length) * 100 : 0)}
                        </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-405 font-medium">
                        {totals.accomplished.length} of {activeActivities.length} accomplished
                    </div>
                </div>
                
                {/* Budget Utilization Rate Card */}
                <div className="flex-grow w-full sm:w-[calc(50%-8px)] md:w-[calc(33.333%-11px)] lg:w-[calc(20%-13px)] bg-white dark:bg-slate-900 border-2 border-sky-100 dark:border-slate-855 p-5 rounded-2xl flex flex-col justify-between shadow-xs transition-transform hover:scale-[1.02] duration-200">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Budget Utilization Rate</span>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold text-[var(--navy)] dark:text-slate-100 tracking-tight" style={{ fontSize: 'clamp(36px, 2.5vw, 43px)' }}>
                            {pct(totals.budget > 0 ? (totals.obligated / totals.budget) * 100 : 0, 2)}
                        </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-405 font-medium">
                        {peso(totals.obligated)} obligated of {peso(totals.budget)}
                    </div>
                </div>

                {/* Dynamic KPI Cards */}
                {availableCategories
                    .filter(cat => activeCategoryIds.includes(cat.id))
                    .map(cat => {
                        const displayValue = unitMode === 'budget' ? peso(cat.value) : fmt(cat.count);
                        const displayLabel = cat.label;
                        const subtitle = unitMode === 'budget' ? `${fmt(cat.count)} activities` : peso(cat.value);
                        return (
                            <div key={cat.id} className="flex-grow w-full sm:w-[calc(50%-8px)] md:w-[calc(33.333%-11px)] lg:w-[calc(20%-13px)] bg-white dark:bg-slate-900 border-2 border-sky-100 dark:border-slate-850 p-5 rounded-2xl flex flex-col justify-between shadow-xs transition-transform hover:scale-[1.02] duration-200">
                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{displayLabel}</span>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-4xl font-extrabold text-[var(--navy)] dark:text-slate-100 tracking-tight" style={{ fontSize: 'clamp(36px, 2.5vw, 43px)' }}>
                                        {displayValue}
                                    </span>
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-405 font-medium">
                                    {subtitle}
                                </div>
                            </div>
                        );
                    })
                }
            </div>

            {/* Main Graphs Layout Grid */}
            <section className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-stretch">
                    {/* Distribution Main bar graph */}
                    <article className="card wide h-full md:col-span-3 animate-slide-in" id="distributionGraph" style={{ marginBottom: 0 }}>
                    <div className="section-head">
                        <div>
                            <h2 className="section-title">
                                {effectiveDivision ? `${effectiveDivision} — Distribution by Project` : 'Distribution by Division'}
                            </h2>
                            <p className="subtext">
                                {effectiveDivision ? 'Project-level distribution for the selected division.' : 'Primary comparison view. Click a division to view projects.'}
                            </p>
                        </div>
                        <div className="flex gap-2 items-center flex-nowrap whitespace-nowrap">
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
                                {(!isAdvancedMode || distributionMode !== 'status' || activeCategoryIds.includes('Accomplished')) && (
                                    <span className="legend-item"><i className="dot bg-[#16A34A]" />Accomplished</span>
                                )}
                                {(!isAdvancedMode || distributionMode !== 'status' || activeCategoryIds.includes('Pending')) && (
                                    <span className="legend-item"><i className="dot bg-[#FBBF24]" />Pending</span>
                                )}
                                {(!isAdvancedMode || distributionMode !== 'status' || activeCategoryIds.includes('Delayed')) && (
                                    <span className="legend-item"><i className="dot bg-[#B91C1C]" />Delayed</span>
                                )}
                                {(!isAdvancedMode || distributionMode !== 'status' || activeCategoryIds.includes('Deferred')) && (
                                    <span className="legend-item"><i className="dot bg-[#475569]" />Deferred</span>
                                )}
                            </>
                        )}
                    </div>

                    {/* Bars or Heatmap View */}
                    {distributionView === 'bar' ? (
                        <div className="bars space-y-3">
                            {Object.entries(groupedActivities)
                                .sort((a, b) => {
                                    const aAcc = a[1].filter(act => act.status === 'Accomplished').length;
                                    const bAcc = b[1].filter(act => act.status === 'Accomplished').length;
                                    return bAcc - aAcc;
                                })
                                .map(([d, r]) => {
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
                                                    peso,
                                                    (label) => {
                                                        const filtered = getFilteredActivities(r, 'budget', label);
                                                        setDetailModal({ isOpen: true, title: `${d} — ${label} Activities (Budget)`, activities: filtered });
                                                    }
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
                                                    metricFormat,
                                                    (label) => {
                                                        const filtered = getFilteredActivities(r, 'fund', label);
                                                        setDetailModal({ isOpen: true, title: `${d} — Fund: ${label} Activities`, activities: filtered });
                                                    }
                                                );
                                            })()}
                                            {mainSplitBy === 'status' && (() => {
                                                const p = metricValue(r.filter(a => a.status === 'Pending'));
                                                const acc = metricValue(r.filter(a => a.status === 'Accomplished'));
                                                const del = metricValue(r.filter(a => a.status === 'Delayed'));
                                                const def = metricValue(r.filter(a => a.status === 'Deferred'));

                                                const isFilterActive = isAdvancedMode && distributionMode === 'status';
                                                const pVal = (!isFilterActive || activeCategoryIds.includes('Pending')) ? p : 0;
                                                const accVal = (!isFilterActive || activeCategoryIds.includes('Accomplished')) ? acc : 0;
                                                const delVal = (!isFilterActive || activeCategoryIds.includes('Delayed')) ? del : 0;
                                                const defVal = (!isFilterActive || activeCategoryIds.includes('Deferred')) ? def : 0;

                                                return renderStackedSegments(
                                                    [accVal, pVal, delVal, defVal],
                                                    maxTotal,
                                                    ["seg-green", "seg-gold", "seg-red", "seg-slate"],
                                                    ["Accomplished", "Pending", "Delayed", "Deferred"],
                                                    metricFormat,
                                                    (label) => {
                                                        const filtered = getFilteredActivities(r, 'status', label);
                                                        setDetailModal({ isOpen: true, title: `${d} — ${label} Activities (Status)`, activities: filtered });
                                                    }
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
                        const isStatusDeferredVisible = !isAdvancedMode || distributionMode !== 'status' || activeCategoryIds.includes('Deferred');

                        let colCount = 0;
                        if (isBudget) {
                            if (isBudgetUtilizedVisible) colCount++;
                            if (isBudgetUnutilizedVisible) colCount++;
                        } else if (isStatus) {
                            if (isStatusPendingVisible) colCount++;
                            if (isStatusAccomplishedVisible) colCount++;
                            if (isStatusDelayedVisible) colCount++;
                            if (isStatusDeferredVisible) colCount++;
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
                                        {isStatusAccomplishedVisible && <div className="heat-cell heat-head">Accomplished</div>}
                                        {isStatusPendingVisible && <div className="heat-cell heat-head">Pending</div>}
                                        {isStatusDelayedVisible && <div className="heat-cell heat-head">Delayed</div>}
                                        {isStatusDeferredVisible && <div className="heat-cell heat-head">Deferred</div>}
                                    </>
                                )}
                                <div className="heat-cell heat-head">Total</div>

                                {/* Group rows */}
                                {Object.entries(groupedActivities)
                                    .sort((a, b) => {
                                        const aAcc = a[1].filter(act => act.status === 'Accomplished').length;
                                        const bAcc = b[1].filter(act => act.status === 'Accomplished').length;
                                        return bAcc - aAcc;
                                    })
                                    .map(([d, r]) => {
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
                                            const share = Math.round(u / Math.max(b, 1) * 100);
                                            cells.push(
                                                <div key="u" onClick={() => {
                                                    const filtered = getFilteredActivities(r, 'budget', 'Utilized');
                                                    setDetailModal({ isOpen: true, title: `${d} — Utilized Budget Activities`, activities: filtered });
                                                }} 
                                                onPointerOver={(e) => showTooltip(e, 'Utilized', peso(u), share)}
                                                onPointerMove={updateTooltipPosition}
                                                onPointerLeave={hideTooltip}
                                                className={`heat-cell cursor-pointer hover:opacity-80 ${u === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.blue} ${Math.round(16 + uIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.blue} 48%, #DBEAFE)`, color: uIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{peso(u)}</div>
                                            );
                                        }
                                        if (isBudgetUnutilizedVisible) {
                                            const share = Math.round(un / Math.max(b, 1) * 100);
                                            cells.push(
                                                <div key="un" onClick={() => {
                                                    const filtered = getFilteredActivities(r, 'budget', 'Unutilized');
                                                    setDetailModal({ isOpen: true, title: `${d} — Unutilized Budget Activities`, activities: filtered });
                                                }} 
                                                onPointerOver={(e) => showTooltip(e, 'Unutilized', peso(un), share)}
                                                onPointerMove={updateTooltipPosition}
                                                onPointerLeave={hideTooltip}
                                                className={`heat-cell cursor-pointer hover:opacity-80 ${un === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.gold} ${Math.round(16 + unIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.gold} 48%, #DBEAFE)`, color: unIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{peso(un)}</div>
                                            );
                                        }
                                    } else if (isFund) {
                                        const maxVal = Math.max(...Object.values(groupedActivities).flatMap(g => 
                                            visibleFundSources.map(f => metricValue(g.filter(a => a.sourceOfFund === f.label)))
                                        ), 1);

                                        visibleFundSources.forEach(f => {
                                            const v = metricValue(r.filter(a => a.sourceOfFund === f.label));
                                            const intensity = v / maxVal;
                                            const share = Math.round(v / Math.max(totalVal, 1) * 100);
                                            cells.push(
                                                <div key={f.label} onClick={() => {
                                                    const filtered = getFilteredActivities(r, 'fund', f.label);
                                                    setDetailModal({ isOpen: true, title: `${d} — Fund: ${f.label} Activities`, activities: filtered });
                                                }} 
                                                onPointerOver={(e) => showTooltip(e, f.label, metricFormat(v), share)}
                                                onPointerMove={updateTooltipPosition}
                                                onPointerLeave={hideTooltip}
                                                className={`heat-cell cursor-pointer hover:opacity-80 ${v === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${f.color} ${Math.round(16 + intensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${f.color} 48%, #DBEAFE)`, color: intensity > 0.58 ? 'white' : 'var(--navy)' }}>{metricFormat(v)}</div>
                                            );
                                        });
                                    } else {
                                        const p = metricValue(r.filter(a => a.status === 'Pending'));
                                        const acc = metricValue(r.filter(a => a.status === 'Accomplished'));
                                        const del = metricValue(r.filter(a => a.status === 'Delayed'));
                                        const def = metricValue(r.filter(a => a.status === 'Deferred'));

                                        const maxVal = Math.max(...Object.values(groupedActivities).flatMap(g => {
                                            const gp = metricValue(g.filter(a => a.status === 'Pending'));
                                            const gacc = metricValue(g.filter(a => a.status === 'Accomplished'));
                                            const gdel = metricValue(g.filter(a => a.status === 'Delayed'));
                                            const gdef = metricValue(g.filter(a => a.status === 'Deferred'));
                                            return [gp, gacc, gdel, gdef];
                                        }), 1);

                                        const pIntensity = p / maxVal;
                                        const accIntensity = acc / maxVal;
                                        const delIntensity = del / maxVal;
                                        const defIntensity = def / maxVal;

                                        if (isStatusAccomplishedVisible) {
                                            const share = Math.round(acc / Math.max(totalVal, 1) * 100);
                                            cells.push(
                                                <div key="acc" onClick={() => {
                                                    const filtered = getFilteredActivities(r, 'status', 'Accomplished');
                                                    setDetailModal({ isOpen: true, title: `${d} — Accomplished Activities`, activities: filtered });
                                                }} 
                                                onPointerOver={(e) => showTooltip(e, 'Accomplished', metricFormat(acc), share)}
                                                onPointerMove={updateTooltipPosition}
                                                onPointerLeave={hideTooltip}
                                                className={`heat-cell cursor-pointer hover:opacity-80 ${acc === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.green} ${Math.round(16 + accIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.green} 48%, #DBEAFE)`, color: accIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{metricFormat(acc)}</div>
                                            );
                                        }
                                        if (isStatusPendingVisible) {
                                            const share = Math.round(p / Math.max(totalVal, 1) * 100);
                                            cells.push(
                                                <div key="p" onClick={() => {
                                                    const filtered = getFilteredActivities(r, 'status', 'Pending');
                                                    setDetailModal({ isOpen: true, title: `${d} — Pending Activities`, activities: filtered });
                                                }} 
                                                onPointerOver={(e) => showTooltip(e, 'Pending', metricFormat(p), share)}
                                                onPointerMove={updateTooltipPosition}
                                                onPointerLeave={hideTooltip}
                                                className={`heat-cell cursor-pointer hover:opacity-80 ${p === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.gold} ${Math.round(16 + pIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.gold} 48%, #DBEAFE)`, color: pIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{metricFormat(p)}</div>
                                            );
                                        }
                                        if (isStatusDelayedVisible) {
                                            const share = Math.round(del / Math.max(totalVal, 1) * 100);
                                            cells.push(
                                                <div key="del" onClick={() => {
                                                    const filtered = getFilteredActivities(r, 'status', 'Delayed');
                                                    setDetailModal({ isOpen: true, title: `${d} — Delayed Activities`, activities: filtered });
                                                }} 
                                                onPointerOver={(e) => showTooltip(e, 'Delayed', metricFormat(del), share)}
                                                onPointerMove={updateTooltipPosition}
                                                onPointerLeave={hideTooltip}
                                                className={`heat-cell cursor-pointer hover:opacity-80 ${del === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.red} ${Math.round(16 + delIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.red} 48%, #DBEAFE)`, color: delIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{metricFormat(del)}</div>
                                            );
                                        }
                                        if (isStatusDeferredVisible) {
                                            const share = Math.round(def / Math.max(totalVal, 1) * 100);
                                            cells.push(
                                                <div key="def" onClick={() => {
                                                    const filtered = getFilteredActivities(r, 'status', 'Deferred');
                                                    setDetailModal({ isOpen: true, title: `${d} — Deferred Activities`, activities: filtered });
                                                }} 
                                                onPointerOver={(e) => showTooltip(e, 'Deferred', metricFormat(def), share)}
                                                onPointerMove={updateTooltipPosition}
                                                onPointerLeave={hideTooltip}
                                                className={`heat-cell cursor-pointer hover:opacity-80 ${def === 0 ? 'heat-zero' : ''}`} style={{ background: `color-mix(in srgb, ${colors.slate} ${Math.round(16 + defIntensity * 72)}%, white)`, borderColor: `color-mix(in srgb, ${colors.slate} 48%, #DBEAFE)`, color: defIntensity > 0.58 ? 'white' : 'var(--navy)' }}>{metricFormat(def)}</div>
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
                                            <div onClick={() => {
                                                setDetailModal({ isOpen: true, title: `${d} — All Activities`, activities: r });
                                            }} 
                                            onPointerOver={(e) => showTooltip(e, 'Total', metricFormat(totalVal))}
                                            onPointerMove={updateTooltipPosition}
                                            onPointerLeave={hideTooltip}
                                            className="heat-cell heat-total font-bold cursor-pointer hover:opacity-80">{metricFormat(totalVal)}</div>
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
                                        { label: "Accomplished", value: metricValue(totals.accomplished), color: colors.green },
                                        { label: "Pending", value: metricValue(totals.pending), color: colors.gold },
                                        { label: "Delayed", value: metricValue(totals.delayed), color: colors.red },
                                        { label: "Deferred", value: metricValue(totals.deferred), color: colors.slate }
                                    ];
                                }
                                if (detailsSplitBy === distributionMode && isAdvancedMode) {
                                    segments = segments.filter(d => activeCategoryIds.includes(d.label));
                                }
                                return segments;
                            })();

                            const detailsFormat = (val) => detailsData.some(r => r.format === 'peso') ? peso(val) : metricFormat(val);
                            const maxVal = Math.max(...detailsData.map(x => x.value), 1);

                            const totalSum = detailsData.reduce((s, x) => s + x.value, 0) || 1;

                            return (
                                <div className="histogram" style={{ '--cols': detailsData.length }}>
                                    {detailsData.map((d, i) => {
                                        const hPct = Math.max((d.value / maxVal) * 100, 8);
                                        const share = Math.round(d.value / totalSum * 100);
                                        return (
                                            <div 
                                                key={i} 
                                                className="hist-col cursor-pointer hover:opacity-90"
                                                onClick={() => {
                                                    const filtered = getFilteredActivities(activeActivities, detailsSplitBy, d.label);
                                                    setDetailModal({ isOpen: true, title: `${d.label} Activities (${detailsSplitBy})`, activities: filtered });
                                                }}
                                                onPointerOver={(e) => showTooltip(e, d.label, detailsFormat(d.value), share, d.color)}
                                                onPointerMove={updateTooltipPosition}
                                                onPointerLeave={hideTooltip}
                                            >
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
                                <div className="donut-layout flex flex-col items-center gap-4 w-full">
                                    <div className="relative w-40 h-40 flex items-center justify-center">
                                        <svg viewBox="0 0 42 42" className="w-full h-full transform -rotate-90">
                                            {[...processedActivityDonutSlices].sort((a, b) => b.value - a.value).map((slice) => {
                                                const isHovered = hoveredActivityDonutIndex === slice.originalIndex;
                                                const baseWidth = isHovered ? 6.5 : 5.0;
                                                const maskWidth = baseWidth + 1.2;
                                                return (
                                                    <React.Fragment key={slice.originalIndex}>
                                                        <circle
                                                            cx="21"
                                                            cy="21"
                                                            r="15.91549430918954"
                                                            fill="transparent"
                                                            stroke="white"
                                                            strokeWidth={maskWidth}
                                                            strokeDasharray={`${slice.percent} ${100 - slice.percent}`}
                                                            strokeDashoffset={slice.offset}
                                                        />
                                                        <circle
                                                            cx="21"
                                                            cy="21"
                                                            r="15.91549430918954"
                                                            fill="transparent"
                                                            stroke={slice.color}
                                                            strokeWidth={baseWidth}
                                                            strokeDasharray={`${slice.percent} ${100 - slice.percent}`}
                                                            strokeDashoffset={slice.offset}
                                                            style={{
                                                                cursor: 'pointer',
                                                                transition: 'stroke-width 0.15s ease',
                                                            }}
                                                            onPointerOver={(e) => {
                                                                setHoveredActivityDonutIndex(slice.originalIndex);
                                                                showTooltip(e, slice.label, fmt(slice.value), slice.share, slice.color);
                                                            }}
                                                            onPointerMove={updateTooltipPosition}
                                                            onPointerLeave={() => {
                                                                setHoveredActivityDonutIndex(null);
                                                                hideTooltip();
                                                            }}
                                                        />
                                                    </React.Fragment>
                                                );
                                            })}
                                        </svg>
                                        <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                                            <span className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">
                                                {hoveredActivityDonutIndex !== null ? fmt(processedActivityDonutSlices[hoveredActivityDonutIndex].value) : fmt(activityDonutTotal)}
                                            </span>
                                            <span className="text-[9px] uppercase font-extrabold text-slate-400 dark:text-slate-500 tracking-wider">
                                                {hoveredActivityDonutIndex !== null ? `${processedActivityDonutSlices[hoveredActivityDonutIndex].label} (${processedActivityDonutSlices[hoveredActivityDonutIndex].share}%)` : "activities"}
                                            </span>
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
                                                {processedActivityDonutSlices.map((d, i) => {
                                                    const share = d.share;
                                                    return (
                                                        <tr
                                                            key={i}
                                                            className="transition-colors hover:bg-slate-50 cursor-pointer"
                                                            onPointerOver={(e) => {
                                                                setHoveredActivityDonutIndex(i);
                                                                showTooltip(e, d.label, fmt(d.value), share, d.color);
                                                            }}
                                                            onPointerMove={updateTooltipPosition}
                                                            onPointerLeave={() => {
                                                                setHoveredActivityDonutIndex(null);
                                                                hideTooltip();
                                                            }}
                                                        >
                                                            <td>
                                                                <span className="dot" style={{ backgroundColor: d.color, marginRight: '7px' }} />
                                                                {d.label}
                                                            </td>
                                                            <td className="text-right"><b>{fmt(d.value)}</b></td>
                                                            <td className="text-right"><b>{pct(share)}</b></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Financial Accomplishment */}
                            <div className="flex flex-col items-center border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6">
                                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Financial Accomplishment</h3>
                                <div className="donut-layout flex flex-col items-center gap-4 w-full">
                                    <div className="relative w-40 h-40 flex items-center justify-center">
                                        <svg viewBox="0 0 42 42" className="w-full h-full transform -rotate-90">
                                            {[...processedFinancialDonutSlices].sort((a, b) => b.value - a.value).map((slice) => {
                                                const isHovered = hoveredFinancialDonutIndex === slice.originalIndex;
                                                const baseWidth = isHovered ? 6.5 : 5.0;
                                                const maskWidth = baseWidth + 1.2;
                                                return (
                                                    <React.Fragment key={slice.originalIndex}>
                                                        <circle
                                                            cx="21"
                                                            cy="21"
                                                            r="15.91549430918954"
                                                            fill="transparent"
                                                            stroke="white"
                                                            strokeWidth={maskWidth}
                                                            strokeDasharray={`${slice.percent} ${100 - slice.percent}`}
                                                            strokeDashoffset={slice.offset}
                                                        />
                                                        <circle
                                                            cx="21"
                                                            cy="21"
                                                            r="15.91549430918954"
                                                            fill="transparent"
                                                            stroke={slice.color}
                                                            strokeWidth={baseWidth}
                                                            strokeDasharray={`${slice.percent} ${100 - slice.percent}`}
                                                            strokeDashoffset={slice.offset}
                                                            style={{
                                                                cursor: 'pointer',
                                                                transition: 'stroke-width 0.15s ease',
                                                            }}
                                                            onPointerOver={(e) => {
                                                                setHoveredFinancialDonutIndex(slice.originalIndex);
                                                                showTooltip(e, slice.label, peso(slice.value), slice.share, slice.color);
                                                            }}
                                                            onPointerMove={updateTooltipPosition}
                                                            onPointerLeave={() => {
                                                                setHoveredFinancialDonutIndex(null);
                                                                hideTooltip();
                                                            }}
                                                        />
                                                    </React.Fragment>
                                                );
                                            })}
                                        </svg>
                                        <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                                            <span className="text-[10px] md:text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight">
                                                {hoveredFinancialDonutIndex !== null ? peso(processedFinancialDonutSlices[hoveredFinancialDonutIndex].value) : peso(financialDonutTotal)}
                                            </span>
                                            <span className="text-[9px] uppercase font-extrabold text-slate-400 dark:text-slate-500 tracking-wider">
                                                {hoveredFinancialDonutIndex !== null ? `${processedFinancialDonutSlices[hoveredFinancialDonutIndex].label} (${processedFinancialDonutSlices[hoveredFinancialDonutIndex].share}%)` : "budget"}
                                            </span>
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
                                                {processedFinancialDonutSlices.map((d, i) => {
                                                    const share = d.share;
                                                    return (
                                                        <tr
                                                            key={i}
                                                            className="transition-colors hover:bg-slate-50 cursor-pointer"
                                                            onPointerOver={(e) => {
                                                                setHoveredFinancialDonutIndex(i);
                                                                showTooltip(e, d.label, peso(d.value), share, d.color);
                                                            }}
                                                            onPointerMove={updateTooltipPosition}
                                                            onPointerLeave={() => {
                                                                setHoveredFinancialDonutIndex(null);
                                                                hideTooltip();
                                                            }}
                                                        >
                                                            <td>
                                                                <span className="dot" style={{ backgroundColor: d.color, marginRight: '7px' }} />
                                                                {d.label}
                                                            </td>
                                                            <td className="text-right"><b>{peso(d.value)}</b></td>
                                                            <td className="text-right"><b>{pct(share)}</b></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </article>
                </div>
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
                                <div className="flex gap-4 items-center mt-3 flex-wrap text-xs text-slate-500 font-bold dark:text-slate-400">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FBBF24' }} />
                                        {distributionMode === 'budget' ? 'Unutilized (Left)' : 'Pending (Left)'}
                                    </span>
                                    {distributionMode !== 'budget' && (
                                        <>
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#B91C1C' }} />
                                                Delayed (Left)
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#475569' }} />
                                                Deferred (Left)
                                            </span>
                                        </>
                                    )}
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: distributionMode === 'budget' ? '#0284C7' : '#16A34A' }} />
                                        {distributionMode === 'budget' ? 'Utilized (Right)' : 'Accomplished (Right)'}
                                    </span>
                                </div>
                            </div>
                            <span className="badge purple">Compliance Analysis</span>
                        </div>

                        <div className="bars space-y-4 mt-4">
                            {Object.entries(groupedActivities)
                                .sort((a, b) => {
                                    const aAcc = a[1].filter(act => act.status === 'Accomplished').length;
                                    const bAcc = b[1].filter(act => act.status === 'Accomplished').length;
                                    return bAcc - aAcc;
                                })
                                .map(([d, r]) => {
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
                                    const def = metricValue(r.filter(a => a.status === 'Deferred'));

                                    leftVals = [p, del, def];
                                    rightVals = [acc];
                                    leftClasses = ["seg-gold", "seg-red", "seg-slate"];
                                    rightClasses = ["seg-green"];
                                    leftLabels = ["Pending", "Delayed", "Deferred"];
                                    rightLabels = ["Accomplished"];
                                    summaryText = `${fmt(acc)} done`;
                                }

                                const leftTotal = leftVals.reduce((s, v) => s + v, 0);
                                const rightTotal = rightVals.reduce((s, v) => s + v, 0);
                                const globalMaxScale = distributionMode === 'budget' ? maxBudgetTotal : maxTotal;
                                const lWidth = (leftTotal / globalMaxScale) * 100;
                                const rWidth = (rightTotal / globalMaxScale) * 100;

                                return (
                                    <div key={d} className="split-row">
                                        <span title={d}>{d}</span>
                                        
                                        {/* Left Stacked Bar */}
                                        <div className="left" title={leftLabels.join(" + ")}>
                                            <div style={{ display: 'flex', flexDirection: 'row-reverse', width: `${lWidth}%`, height: '100%', marginLeft: 'auto' }}>
                                                {renderStackedSegments(leftVals, leftTotal || 1, leftClasses, leftLabels, distributionMode === 'budget' ? peso : fmt, (label) => {
                                                    const filtered = getFilteredActivities(r, distributionMode, label);
                                                    setDetailModal({ isOpen: true, title: `${d} — ${label} Activities (${distributionMode})`, activities: filtered });
                                                }, null, totalVal)}
                                            </div>
                                        </div>

                                        <div className="axis" />

                                        {/* Right Stacked Bar */}
                                        <div className="right" title={rightLabels.join(" + ")}>
                                            <div style={{ display: 'flex', width: `${rWidth}%`, height: '100%' }}>
                                                {renderStackedSegments(rightVals, rightTotal || 1, rightClasses, rightLabels, distributionMode === 'budget' ? peso : fmt, (label) => {
                                                    const filtered = getFilteredActivities(r, distributionMode, label);
                                                    setDetailModal({ isOpen: true, title: `${d} — ${label} Activities (${distributionMode})`, activities: filtered });
                                                }, null, totalVal)}
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
                                        Utilization Rate <span className="sort-icon">{tableSortKey === 'budget' ? (tableSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
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
                                        Accomplishment Rate <span className="sort-icon">{tableSortKey === 'obligated' ? (tableSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
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
                                                setSelectedRegistryActivity(r);
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
                                            <td className={`font-mono font-extrabold text-right w-[150px] ${getUtilColorClass(r.budget > 0 ? (r.obligated / r.budget) * 100 : 0)}`}>{pct(r.budget > 0 ? (r.obligated / r.budget) * 100 : 0)}</td>
                                            <td className={`font-mono font-extrabold text-right w-[150px] ${getAccomColorClass((r.status === 'Completed' || r.status === 'Accomplished') ? 100 : 0)}`}>{pct((r.status === 'Completed' || r.status === 'Accomplished') ? 100 : 0)}</td>
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
            {detailModal.isOpen && (
                <ActivityBreakdownModal
                    isOpen={detailModal.isOpen}
                    onClose={() => setDetailModal(prev => ({ ...prev, isOpen: false }))}
                    title={detailModal.title}
                    activities={detailModal.activities}
                    onEditActivity={(r) => {
                        setDetailModal(prev => ({ ...prev, isOpen: false }));
                        setEditingTask({
                            ...r,
                            title: r.name,
                            project_id: r.id
                        });
                    }}
                />
            )}
            {selectedRegistryActivity && (
                <ActivityDetailsModal
                    activity={selectedRegistryActivity}
                    onClose={() => setSelectedRegistryActivity(null)}
                    onEdit={(act) => {
                        setEditingTask({
                            ...act,
                            title: act.name,
                            project_id: act.id
                        });
                    }}
                />
            )}
            {tooltip.visible && (
                <div 
                    className="bar-hover-tooltip"
                    style={{
                        position: 'fixed',
                        left: tooltip.x + 15,
                        top: tooltip.y + 15,
                        backgroundColor: '#FFFFFF', // Card style background
                        color: '#08315F', // Navy text
                        padding: '10px 14px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        boxShadow: '0 10px 18px -3px rgba(8, 49, 95, 0.12), 0 4px 6px -2px rgba(8, 49, 95, 0.08)',
                        zIndex: 9999,
                        pointerEvents: 'none',
                        transition: 'opacity 0.1s ease',
                        border: '2px solid #DBEAFE', // Card style border matching dashboard
                        fontFamily: 'var(--font)'
                    }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
