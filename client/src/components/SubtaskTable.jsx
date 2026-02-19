import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CheckCircle2, Circle, ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { deleteSubtask } from '../api';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const AccordionGroup = ({ title, count, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-6 py-4 flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-100"
            >
                <div className="flex items-center gap-3">
                    <div className={clsx("transition-transform duration-200", isOpen ? "rotate-180" : "")}>
                        <ArrowDown size={16} className="text-slate-400" />
                    </div>
                    <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                        {title}
                    </h3>
                </div>
                <span className="bg-white px-2.5 py-0.5 rounded-full text-xs font-bold text-slate-600 border border-slate-200 shadow-sm">
                    {count}
                </span>
            </button>
            {isOpen && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};

const SubtaskTable = ({ activities = [], employees = [], onSubtaskClick, onToggleStatus, onSubtaskDeleted }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'due_date', direction: 'asc' });
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [subtaskToDelete, setSubtaskToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const allSubtasks = useMemo(() => {
        if (!activities) return [];
        const flattened = [];
        activities.forEach(activity => {
            if (activity.subtasks && activity.subtasks.length > 0) {
                activity.subtasks.forEach(st => {
                    flattened.push({
                        ...st,
                        parentActivity: activity.title,
                        parentId: activity.id,
                        parentTask: activity // Passed for context if needed
                    });
                });
            }
        });
        return flattened;
    }, [activities]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleDeleteClick = (e, subtask) => {
        e.stopPropagation();
        setSubtaskToDelete(subtask);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!subtaskToDelete) return;
        setIsDeleting(true);
        try {
            await deleteSubtask(subtaskToDelete.id);
            if (onSubtaskDeleted) onSubtaskDeleted(subtaskToDelete.id);
            setDeleteModalOpen(false);
            setSubtaskToDelete(null);
        } catch (err) {
            console.error("Failed to delete subtask", err);
            alert("Failed to delete subtask");
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

    const getAssigneeName = (id) => {
        if (!id) return 'Unassigned';
        const emp = employees.find(e => e.id === id);
        return emp ? (emp.name || `${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`.trim()) : 'Unknown';
    };

    const sortData = (data) => {
        if (!data) return [];
        return [...data].sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            // Handle date sorting
            if (sortConfig.key === 'due_date') {
                aValue = aValue ? new Date(aValue).getTime() : 0;
                bValue = bValue ? new Date(bValue).getTime() : 0;
            }
            // Handle assignee sorting (by ID for now, could map to name)
            else if (sortConfig.key === 'assignee_id') {
                aValue = getAssigneeName(aValue) || '';
                bValue = getAssigneeName(bValue) || '';
            }
            // Handle string sorting
            else if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    // Split and Sort
    const activeTasks = sortData(allSubtasks.filter(t => t.status !== 'Accomplished'));
    const accomplishedTasks = sortData(allSubtasks.filter(t => t.status === 'Accomplished'));


    // Group tasks by assignee
    const tasksByAssignee = useMemo(() => {
        const groups = {};
        activeTasks.forEach(task => {
            const assigneeName = getAssigneeName(task.assignee_id);
            if (!groups[assigneeName]) {
                groups[assigneeName] = [];
            }
            groups[assigneeName].push(task);
        });
        return groups;
    }, [activeTasks, employees]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Accomplished': return 'bg-green-100 text-green-700 border-green-200';
            case 'In Progress': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Continuing': return 'bg-sky-100 text-sky-700 border-sky-200';
            case 'Waitlisted': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'Deferred': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'Cancelled': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    if (allSubtasks.length === 0) {
        return (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-500">No tasks found for this project.</p>
            </div>
        );
    }

    const renderTable = (tasks, isAccomplished = false) => (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-bold">
                    <tr>
                        <th className="px-6 py-3 w-10"></th>
                        <th className="px-6 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('title')}>
                            <div className="flex items-center">Task {getSortIcon('title')}</div>
                        </th>
                        <th className="px-6 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('parentActivity')}>
                            <div className="flex items-center">Activity {getSortIcon('parentActivity')}</div>
                        </th>
                        {!isAccomplished && (
                            <th className="px-6 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                                <div className="flex items-center">Status {getSortIcon('status')}</div>
                            </th>
                        )}
                        <th className="px-6 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('due_date')}>
                            <div className="flex items-center">Due {getSortIcon('due_date')}</div>
                        </th>
                        <th className="px-6 py-3 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {tasks.map(task => (
                        <tr
                            key={`${task.parentId}-${task.id}`}
                            className={clsx(
                                "transition-colors",
                                isAccomplished ? "bg-slate-50 text-slate-400" : "hover:bg-blue-50 cursor-pointer"
                            )}
                        >
                            <td className="px-6 py-3">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleStatus && onToggleStatus(task);
                                    }}
                                    className={clsx(
                                        "flex items-center justify-center transition-colors",
                                        isAccomplished ? "text-green-500 hover:text-green-600" : "text-slate-300 hover:text-blue-500"
                                    )}
                                >
                                    {isAccomplished ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                </button>
                            </td>
                            <td
                                className="px-6 py-3 font-medium"
                                onClick={() => !isAccomplished && onSubtaskClick && onSubtaskClick(task)}
                            >
                                <span className={clsx(isAccomplished && "line-through decoration-slate-300")}>
                                    {task.title}
                                </span>
                            </td>
                            <td className="px-6 py-3" onClick={() => !isAccomplished && onSubtaskClick && onSubtaskClick(task)}>
                                {task.parentActivity}
                            </td>
                            {!isAccomplished && (
                                <td className="px-6 py-3" onClick={() => !isAccomplished && onSubtaskClick && onSubtaskClick(task)}>
                                    <span className={clsx(
                                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                                        isAccomplished ? "bg-slate-100 text-slate-500 border-slate-200" : getStatusColor(task.status)
                                    )}>
                                        {task.status}
                                    </span>
                                </td>
                            )}
                            <td className="px-6 py-3 font-mono text-xs" onClick={() => !isAccomplished && onSubtaskClick && onSubtaskClick(task)}>
                                {formatDate(task.due_date)}
                            </td>
                            <td className="px-6 py-3 text-center">
                                <button
                                    onClick={(e) => handleDeleteClick(e, task)}
                                    className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete Task"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Pending Tasks Grouped by Assignee */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">Pending Tasks</h3>
                {Object.keys(tasksByAssignee).length === 0 && (
                    <p className="px-2 text-slate-400 italic text-sm">No pending tasks.</p>
                )}
                {Object.entries(tasksByAssignee).map(([assignee, tasks]) => (
                    <AccordionGroup key={assignee} title={assignee} count={tasks.length} defaultOpen={true}>
                        {renderTable(tasks, false)}
                    </AccordionGroup>
                ))}
            </div>

            {/* Accomplished Tasks Grouped (Single Group) */}
            {accomplishedTasks.length > 0 && (
                <div className="mt-8 pt-8 border-t border-slate-200">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider px-2 mb-4">Completed History</h3>
                    <AccordionGroup title="Accomplished Tasks" count={accomplishedTasks.length} defaultOpen={false}>
                        {renderTable(accomplishedTasks, true)}
                    </AccordionGroup>
                </div>
            )}

            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Task"
                itemName={subtaskToDelete?.title}
                message="Are you sure you want to delete this task? This action cannot be undone."
                isDeleting={isDeleting}
            />
        </div>
    );
};

export default SubtaskTable;
