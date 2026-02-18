import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, PlusCircle, ArrowRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import clsx from 'clsx';
import CatchUpModal from './CatchUpModal';
import { getProjectCatchUps } from '../api';

const SpilloversTab = ({ tasks = [], onTaskClick }) => {
    const [isCatchUpModalOpen, setIsCatchUpModalOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [catchUps, setCatchUps] = useState({});
    const [loadingCatchUps, setLoadingCatchUps] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'title', direction: 'asc' });

    // Filter for Deferred tasks
    const deferredTasks = tasks.filter(t => t.status === 'Deferred');

    // Fetch catch-ups when deferred tasks change (or on mount/update)
    useEffect(() => {
        if (deferredTasks.length > 0) {
            // Assume all deferred tasks belong to the same project for now (ProjectDetails context)
            const projectId = deferredTasks[0].project_id;
            if (projectId) {
                setLoadingCatchUps(true);
                getProjectCatchUps(projectId)
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
            }
        }
    }, [deferredTasks.length]); // Re-fetch if list size changes (e.g. status change)

    const handleCatchUpClick = (e, task) => {
        e.stopPropagation(); // Prevent row click
        setSelectedActivity(task);
        setIsCatchUpModalOpen(true);
    };

    const handleCatchUpCreated = () => {
        // Refresh catch-ups
        const projectId = deferredTasks[0]?.project_id;
        if (projectId) {
            getProjectCatchUps(projectId).then(data => {
                const mapping = {};
                data.forEach(c => {
                    if (!mapping[c.activity_id]) {
                        mapping[c.activity_id] = [];
                    }
                    mapping[c.activity_id].push(c);
                });
                setCatchUps(mapping);
            });
        }
    };

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

        // Specific handling for 'catchup_date' or 'catchup_title' which aren't direct props
        // Logic check: Sorting by catchup properties when there are multiple catchups is ambiguous.
        // We'll sort by the *latest* catchup's property or simply the first one. Let's use first one for stability.
        const aCatchups = catchUps[a.id] || [];
        const bCatchups = catchUps[b.id] || [];

        if (sortConfig.key === 'catchup_target_date') {
            aValue = aCatchups[0]?.target_date ? new Date(aCatchups[0].target_date).getTime() : 0;
            bValue = bCatchups[0]?.target_date ? new Date(bCatchups[0].target_date).getTime() : 0;
        } else if (sortConfig.key === 'catchup_title') {
            aValue = aCatchups[0]?.title || '';
            bValue = bCatchups[0]?.title || '';
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
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
                    <AlertCircle size={24} />
                </div>
                <h3 className="text-lg font-medium text-slate-800">No Spillovers</h3>
                <p className="text-slate-500">There are no deferred activities for this project.</p>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-yellow-50">
                    <h3 className="font-bold text-yellow-800 uppercase tracking-wide text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        Deferred Activities (Spillovers)
                    </h3>
                    <span className="bg-white px-2 py-1 rounded-full text-xs font-bold text-yellow-700 shadow-sm">
                        {deferredTasks.length}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-bold">
                            <tr>
                                <th className="px-6 py-4 text-slate-600 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('title')}>
                                    <div className="flex items-center">Activity & Context {getSortIcon('title')}</div>
                                </th>
                                <th className="px-6 py-4 text-slate-600 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                                    <div className="flex items-center">Status {getSortIcon('status')}</div>
                                </th>
                                <th className="px-6 py-4 text-blue-700 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('catchup_title')}>
                                    <div className="flex items-center">Catch-up Activity {getSortIcon('catchup_title')}</div>
                                </th>
                                <th className="px-6 py-4 text-blue-700 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('catchup_target_date')}>
                                    <div className="flex items-center">Target Date {getSortIcon('catchup_target_date')}</div>
                                </th>
                                <th className="px-6 py-4 text-slate-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedTasks.map(task => {
                                const taskCatchUps = catchUps[task.id] || [];
                                return (
                                    <tr
                                        key={task.id}
                                        onClick={() => onTaskClick && onTaskClick(task)}
                                        className="hover:bg-yellow-50 cursor-pointer transition-colors"
                                    >
                                        {/* Activity & Context - unchanged */}
                                        <td className="px-6 py-4 align-top">
                                            <div className="font-bold text-slate-800 text-base">{task.title}</div>
                                            {task.objective && (
                                                <div className="text-xs text-slate-500 mt-1 line-clamp-2">{task.objective}</div>
                                            )}
                                        </td>

                                        {/* Status - unchanged */}
                                        <td className="px-6 py-4 align-top">
                                            <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium border", getStatusColor(task.status))}>
                                                {task.status}
                                            </span>
                                        </td>

                                        {/* Catch-up Activity - Map multiple */}
                                        <td className="px-6 py-4 align-top">
                                            {taskCatchUps.length > 0 ? (
                                                <div className="space-y-3">
                                                    {taskCatchUps.map((cu, idx) => (
                                                        <div key={cu.id || idx} className="flex items-start gap-2 text-blue-700 border-l-2 border-blue-200 pl-2">
                                                            {/* <ArrowRight size={14} className="mt-0.5 shrink-0 opacity-50" /> */}
                                                            <div>
                                                                <div className="font-semibold text-sm">{cu.title}</div>
                                                                {cu.description && (
                                                                    <div className="text-xs text-blue-600/80 mt-0.5 line-clamp-1">{cu.description}</div>
                                                                )}
                                                                {cu.reason && (
                                                                    <div className="text-xs text-slate-500 mt-0.5 italic">Reason: {cu.reason}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic text-xs">No catch-up plan invoked</span>
                                            )}
                                        </td>

                                        {/* Target Date - Map multiple */}
                                        <td className="px-6 py-4 align-top">
                                            {taskCatchUps.length > 0 ? (
                                                <div className="space-y-3">
                                                    {taskCatchUps.map((cu, idx) => (
                                                        <div key={cu.id || idx} className="h-[42px] flex items-center"> {/* Height matching rows somewhat or just flex */}
                                                            {cu.target_date ? (
                                                                <div className="flex items-center gap-1.5 text-slate-700 font-medium font-mono text-xs bg-slate-100 px-2 py-1 rounded inline-flex">
                                                                    <Calendar size={13} className="text-slate-400" />
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

                                        {/* Actions */}
                                        <td className="px-6 py-4 align-top text-right">
                                            <button
                                                onClick={(e) => handleCatchUpClick(e, task)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-400 hover:text-blue-600 rounded-md text-xs font-medium transition-all shadow-sm ml-auto"
                                            >
                                                <PlusCircle size={14} />
                                                Manage Plans ({taskCatchUps.length})
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedActivity && (
                <CatchUpModal
                    isOpen={isCatchUpModalOpen}
                    onClose={() => setIsCatchUpModalOpen(false)}
                    activityId={selectedActivity.id}
                    activityTitle={selectedActivity.title}
                    onCatchUpCreated={handleCatchUpCreated}
                    // Pass existing plans for this activity
                    existingPlans={catchUps[selectedActivity.id] || []}
                />
            )}
        </>
    );
};

export default SpilloversTab;
