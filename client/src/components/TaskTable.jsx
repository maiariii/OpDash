import React, { useState } from 'react';
import { Calendar, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Paperclip } from 'lucide-react';
import clsx from 'clsx';
import { deleteTask } from '../api';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const TaskTable = ({ tasks = [], milestones = [], employees = [], onTaskClick, onTaskDeleted }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'due_date', direction: 'asc' });
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Accomplished': return 'bg-green-100 text-green-700 border-green-200';
            case 'In Progress': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Continuing': return 'bg-sky-100 text-sky-700 border-sky-200';
            case 'Waitlisted': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'Deferred': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'Cancelled': return 'bg-red-100 text-red-700 border-red-200';
            case 'Delayed': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
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

    const handleDeleteClick = (e, task) => {
        e.stopPropagation();
        setTaskToDelete(task);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!taskToDelete) return;
        setIsDeleting(true);
        try {
            await deleteTask(taskToDelete.id);
            if (onTaskDeleted) onTaskDeleted(taskToDelete.id);
            setDeleteModalOpen(false);
            setTaskToDelete(null);
        } catch (err) {
            console.error("Failed to delete task", err);
            alert("Failed to delete task");
        } finally {
            setIsDeleting(false);
        }
    };

    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="ml-1 text-slate-400" />;
        return sortConfig.direction === 'asc' ?
            <ArrowUp size={14} className="ml-1 text-blue-600" /> :
            <ArrowDown size={14} className="ml-1 text-blue-600" />;
    };

    const sortData = (data) => {
        return [...data].sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            // Handle date sorting
            if (['start_date', 'due_date'].includes(sortConfig.key)) {
                aValue = aValue ? new Date(aValue).getTime() : 0;
                bValue = bValue ? new Date(bValue).getTime() : 0;
            }
            // Handle milestone sorting
            else if (sortConfig.key === 'milestone_id') {
                const getMilestoneTitle = (t) => {
                    const m = (milestones || []).find(ms => ms.id === t.milestone_id);
                    return m ? m.title.toLowerCase() : '';
                };
                aValue = getMilestoneTitle(a);
                bValue = getMilestoneTitle(b);
            }
            // Handle numeric sorting (Budget/Actual)
            else if (['budget', 'cost'].includes(sortConfig.key)) {
                // Calculate actual cost dynamically if sorting by actual
                if (sortConfig.key === 'cost') {
                    const getExpensive = (t) => (t.expenses || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || (t.cost || 0);
                    aValue = getExpensive(a);
                    bValue = getExpensive(b);
                } else {
                    aValue = Number(aValue || 0);
                    bValue = Number(bValue || 0);
                }
            }
            // Handle string sorting (including status)
            else if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    // Filter Tasks using manual status
    const accomplished = tasks.filter(t => t.status === 'Accomplished');
    const pending = tasks.filter(t => t.status !== 'Accomplished');

    const sortedPending = sortData(pending);
    const sortedAccomplished = sortData(accomplished);

    const isOverdue = (dateStr) => {
        if (!dateStr) return false;
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return new Date(dateStr) < todayStart;
    };

    if (tasks.length === 0) {
        return (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-500">No activities found for this project.</p>
            </div>
        );
    }

    const renderTable = (title, data, isPending = false) => (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8 last:mb-0">
            <div className={`px-6 py-3 border-b border-slate-200 font-bold text-sm uppercase tracking-wide bg-slate-50 text-slate-700`}>
                {title} ({data.length})
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-bold">
                        <tr>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('title')}>
                                <div className="flex items-center">Activity Name {getSortIcon('title')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                                <div className="flex items-center">Status {getSortIcon('status')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('milestone_id')}>
                                <div className="flex items-center">Milestone {getSortIcon('milestone_id')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('budget')}>
                                <div className="flex items-center">Budget {getSortIcon('budget')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('cost')}>
                                <div className="flex items-center">Actual {getSortIcon('cost')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('start_date')}>
                                <div className="flex items-center">Start Date {getSortIcon('start_date')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('due_date')}>
                                <div className="flex items-center">Due Date {getSortIcon('due_date')}</div>
                            </th>
                            <th className="px-6 py-4 w-12 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.map(task => {
                            const overdue = isPending && isOverdue(task.due_date);

                            return (
                                <tr
                                    key={task.id}
                                    onClick={() => onTaskClick && onTaskClick(task)}
                                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <div className={clsx("font-medium", overdue ? "text-red-700" : "text-slate-800")}>
                                            {task.title}
                                            {overdue && <AlertCircle size={14} className="inline ml-2 text-red-600 mb-0.5" />}
                                            {task.file_attachments && JSON.parse(task.file_attachments).length > 0 && (
                                                <Paperclip size={12} className="inline ml-2 text-slate-400" title={`${JSON.parse(task.file_attachments).length} attachment(s)`} />
                                            )}
                                        </div>
                                        {task.objective && (
                                            <div className="text-xs text-slate-400 truncate max-w-[200px]">{task.objective}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {(() => {
                                            const displayStatus = overdue ? 'Delayed' : (task.status === 'Todo' ? 'Pending' : task.status);
                                            return (
                                                <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium border", getStatusColor(displayStatus))}>
                                                    {displayStatus}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 text-slate-700 font-medium text-xs">
                                        {(() => {
                                            const m = (milestones || []).find(ms => ms.id === task.milestone_id);
                                            return m ? m.title : '-';
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 text-slate-800 font-mono text-xs">
                                        {task.budget ? `₱${Number(task.budget).toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-800 font-mono text-xs">
                                        {(() => {
                                            const expenses = task.expenses || [];
                                            const total = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
                                            const displayCost = total > 0 ? total : (task.cost || 0);
                                            return displayCost ? `₱${Number(displayCost).toLocaleString()}` : '-';
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                                        {formatDate(task.start_date)}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                                        <span className={clsx(overdue && "text-red-600 font-bold")}>
                                            {formatDate(task.due_date)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={(e) => handleDeleteClick(e, task)}
                                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Activity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            {sortedPending.length > 0 && renderTable('Pending Activities', sortedPending, true)}
            {sortedAccomplished.length > 0 && renderTable('Accomplished Activities', sortedAccomplished, false)}

            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Activity"
                itemName={taskToDelete?.title}
                message="Are you sure you want to delete this activity? This will also delete all subtasks, expenses, and catch-up plans associated with it."
                isDeleting={isDeleting}
            />
        </div>
    );
};

export default TaskTable;
