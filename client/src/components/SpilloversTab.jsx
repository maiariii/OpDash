import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, PlusCircle, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import CatchUpModal from './CatchUpModal';
import { getProjectCatchUps } from '../api';

const SpilloversTab = ({ tasks = [], onTaskClick }) => {
    const [isCatchUpModalOpen, setIsCatchUpModalOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [catchUps, setCatchUps] = useState({});
    const [loadingCatchUps, setLoadingCatchUps] = useState(false);

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
                        // Map catchups by activity_id
                        const mapping = {};
                        data.forEach(c => {
                            // If multiple, maybe take the latest? For now just assign
                            mapping[c.activity_id] = c;
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
                data.forEach(c => mapping[c.activity_id] = c);
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
                                <th className="px-6 py-4 text-slate-600">Activity & Context</th>
                                <th className="px-6 py-4 text-slate-600">Status</th>
                                <th className="px-6 py-4 text-blue-700">Catch-up Activity</th>
                                <th className="px-6 py-4 text-blue-700">Target Date</th>
                                <th className="px-6 py-4 text-slate-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {deferredTasks.map(task => {
                                const catchUp = catchUps[task.id];
                                return (
                                    <tr
                                        key={task.id}
                                        onClick={() => onTaskClick && onTaskClick(task)}
                                        className="hover:bg-yellow-50 cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4 align-top">
                                            {/* Removed Control ID as requested */}
                                            <div className="font-bold text-slate-800 text-base">{task.title}</div>
                                            {task.objective && (
                                                <div className="text-xs text-slate-500 mt-1 line-clamp-2">{task.objective}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium border", getStatusColor(task.status))}>
                                                {task.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            {catchUp ? (
                                                <div className="flex items-start gap-2 text-blue-700">
                                                    <ArrowRight size={16} className="mt-0.5 shrink-0" />
                                                    <div>
                                                        <div className="font-semibold">{catchUp.title}</div>
                                                        {catchUp.description && (
                                                            <div className="text-xs text-blue-600/80 mt-0.5 line-clamp-1">{catchUp.description}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic text-xs">No catch-up plan invoked</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            {catchUp && catchUp.target_date ? (
                                                <div className="flex items-center gap-1.5 text-slate-700 font-medium font-mono text-xs bg-slate-100 px-2 py-1 rounded inline-flex">
                                                    <Calendar size={13} className="text-slate-400" />
                                                    {formatDate(catchUp.target_date)}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 align-top text-right">
                                            <button
                                                onClick={(e) => handleCatchUpClick(e, task)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-400 hover:text-blue-600 rounded-md text-xs font-medium transition-all shadow-sm ml-auto"
                                            >
                                                <PlusCircle size={14} />
                                                {catchUp ? 'Edit Plan' : 'Catch-up Activity'}
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
                />
            )}
        </>
    );
};

export default SpilloversTab;
