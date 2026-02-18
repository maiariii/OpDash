import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, ArrowRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import clsx from 'clsx';
import { getAllCatchUps } from '../api';

const SpilloverTracker = ({ tasks = [] }) => {
    const [catchUps, setCatchUps] = useState({});
    const [loadingCatchUps, setLoadingCatchUps] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'title', direction: 'asc' });

    // Filter for Deferred tasks from all divisions/projects
    const deferredTasks = tasks.filter(t => t.status === 'Deferred');

    // Fetch catch-ups on mount
    useEffect(() => {
        setLoadingCatchUps(true);
        getAllCatchUps()
            .then(data => {
                // Map catchups by activity_id -> ARRAY
                const mapping = {};
                data.forEach(c => {
                    if (!mapping[c.activity_id]) {
                        mapping[c.activity_id] = [];
                    }
                    mapping[c.activity_id].push(c);
                });
                setCatchUps(mapping);
            })
            .catch(err => console.error("Failed to load catch-ups:", err))
            .finally(() => setLoadingCatchUps(false));
    }, []);

    const getStatusColor = (status) => {
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'; // Specific for Deferred
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="ml-1 text-slate-400" />;
        return sortConfig.direction === 'asc' ?
            <ArrowUp size={14} className="ml-1 text-blue-600" /> :
            <ArrowDown size={14} className="ml-1 text-blue-600" />;
    };

    const sortedTasks = [...deferredTasks].sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        const aCatchups = catchUps[a.id] || [];
        const bCatchups = catchUps[b.id] || [];

        // Custom Sort Logic
        if (sortConfig.key === 'catchup_target_date') {
            const dateA = aCatchups[0]?.target_date ? new Date(aCatchups[0].target_date).getTime() : 0;
            const dateB = bCatchups[0]?.target_date ? new Date(bCatchups[0].target_date).getTime() : 0;
            aValue = dateA;
            bValue = dateB;
        } else if (sortConfig.key === 'catchup_title') {
            aValue = aCatchups[0]?.title || '';
            bValue = bCatchups[0]?.title || '';
        } else if (sortConfig.key === 'project') {
            aValue = a.project_name || '';
            bValue = b.project_name || '';
        }

        // Generic String/Number handling
        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    if (deferredTasks.length === 0) {
        return (
            <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-400 mb-2">
                    <AlertCircle size={20} />
                </div>
                <h3 className="text-sm font-medium text-slate-800">No Spillovers</h3>
                <p className="text-xs text-slate-500">No deferred activities found.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-yellow-50">
                <h3 className="font-bold text-yellow-800 uppercase tracking-wide text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    Spillover Tracker
                </h3>
                <span className="bg-white px-2 py-1 rounded-full text-xs font-bold text-yellow-700 shadow-sm">
                    {deferredTasks.length} Deferred
                </span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-bold sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-slate-600 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('title')}>
                                <div className="flex items-center">Activity {getSortIcon('title')}</div>
                            </th>
                            <th className="px-6 py-3 text-slate-600 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('project')}>
                                <div className="flex items-center">Project {getSortIcon('project')}</div>
                            </th>
                            <th className="px-6 py-3 text-blue-700 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('catchup_title')}>
                                <div className="flex items-center">Catch-up Plan {getSortIcon('catchup_title')}</div>
                            </th>
                            <th className="px-6 py-3 text-blue-700 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('catchup_target_date')}>
                                <div className="flex items-center">Target Date {getSortIcon('catchup_target_date')}</div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedTasks.map(task => {
                            const taskCatchUps = catchUps[task.id] || [];
                            return (
                                <tr key={task.id} className="hover:bg-yellow-50 transition-colors">
                                    {/* Activity Context */}
                                    <td className="px-6 py-4 align-top">
                                        <div className="font-bold text-slate-800 text-sm">{task.title}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={clsx("px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider", getStatusColor(task.status))}>
                                                {task.status}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Project Context */}
                                    <td className="px-6 py-4 align-top">
                                        <div className="text-sm text-slate-600 font-medium">{task.project_name}</div>
                                        <div className="text-xs text-slate-400">{task.division_name || 'No Division'}</div>
                                    </td>

                                    {/* Catch-up Plan */}
                                    <td className="px-6 py-4 align-top">
                                        {taskCatchUps.length > 0 ? (
                                            <div className="space-y-2">
                                                {taskCatchUps.map((cu, idx) => (
                                                    <div key={cu.id || idx} className="flex items-start gap-2 text-blue-700 border-l-2 border-blue-200 pl-2">
                                                        <div>
                                                            <div className="font-semibold text-xs">{cu.title}</div>
                                                            {cu.description && (
                                                                <div className="text-[10px] text-blue-600/80 line-clamp-1">{cu.description}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 italic text-xs">No catch-up plan invoked</span>
                                        )}
                                    </td>

                                    {/* Target Date */}
                                    <td className="px-6 py-4 align-top">
                                        {taskCatchUps.length > 0 ? (
                                            <div className="space-y-2">
                                                {taskCatchUps.map((cu, idx) => (
                                                    <div key={cu.id || idx} className="h-[32px] flex items-center">
                                                        {cu.target_date ? (
                                                            <div className="flex items-center gap-1.5 text-slate-700 font-medium font-mono text-xs bg-slate-100 px-2 py-1 rounded inline-flex">
                                                                <Calendar size={12} className="text-slate-400" />
                                                                {formatDate(cu.target_date)}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs">-</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-xs">-</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SpilloverTracker;
