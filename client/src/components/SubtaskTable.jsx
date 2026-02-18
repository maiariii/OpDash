import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CheckCircle2, Circle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const SubtaskTable = ({ activities = [], employees = [], onSubtaskClick, onToggleStatus }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'due_date', direction: 'asc' });

    const allSubtasks = useMemo(() => {
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
    const activeTasks = sortData(allSubtasks.filter(t => t.status !== 'Done'));
    const accomplishedTasks = sortData(allSubtasks.filter(t => t.status === 'Done'));


    const getStatusColor = (status) => {
        switch (status) {
            case 'Done': return 'bg-green-100 text-green-700 border-green-200';
            case 'In Progress': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const getAssigneeName = (id) => {
        if (!id) return '-';
        const emp = employees.find(e => e.id === id);
        return emp ? (emp.name || `${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`.trim()) : 'Unknown';
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

    const renderTable = (title, tasks, isAccomplished = false) => (
        <div className={clsx("bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8", isAccomplished && "opacity-80")}>
            <div className={clsx(
                "px-6 py-3 border-b border-slate-200 font-bold text-sm uppercase tracking-wide",
                isAccomplished ? "bg-slate-100 text-slate-500" : "bg-slate-50 text-slate-600"
            )}>
                {title} ({tasks.length})
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-bold">
                        <tr>
                            <th className="px-6 py-4 w-10"></th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('title')}>
                                <div className="flex items-center">Task Title {getSortIcon('title')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('parentActivity')}>
                                <div className="flex items-center">Activity (Parent) {getSortIcon('parentActivity')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('assignee_id')}>
                                <div className="flex items-center">Assigned To {getSortIcon('assignee_id')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                                <div className="flex items-center">Status {getSortIcon('status')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('due_date')}>
                                <div className="flex items-center">Due Date {getSortIcon('due_date')}</div>
                            </th>
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
                                <td className="px-6 py-4">
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
                                        {isAccomplished ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                    </button>
                                </td>
                                <td
                                    className="px-6 py-4 font-medium"
                                    onClick={() => !isAccomplished && onSubtaskClick && onSubtaskClick(task)}
                                >
                                    <span className={clsx(isAccomplished && "line-through decoration-slate-300")}>
                                        {task.title}
                                    </span>
                                </td>
                                <td className="px-6 py-4" onClick={() => !isAccomplished && onSubtaskClick && onSubtaskClick(task)}>
                                    {task.parentActivity}
                                </td>
                                <td className="px-6 py-4" onClick={() => !isAccomplished && onSubtaskClick && onSubtaskClick(task)}>
                                    {task.assignee_id ? (
                                        <div className="flex items-center gap-2">
                                            <div className={clsx(
                                                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border",
                                                isAccomplished ? "bg-slate-200 text-slate-500 border-slate-300" : "bg-blue-100 text-blue-600 border-blue-200"
                                            )}>
                                                {getAssigneeName(task.assignee_id).charAt(0)}
                                            </div>
                                            <span>{getAssigneeName(task.assignee_id)}</span>
                                        </div>
                                    ) : (
                                        <span className="italic opacity-70">Unassigned</span>
                                    )}
                                </td>
                                <td className="px-6 py-4" onClick={() => !isAccomplished && onSubtaskClick && onSubtaskClick(task)}>
                                    <span className={clsx(
                                        "px-2.5 py-1 rounded-full text-xs font-medium border",
                                        isAccomplished ? "bg-slate-100 text-slate-500 border-slate-200" : getStatusColor(task.status)
                                    )}>
                                        {task.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs" onClick={() => !isAccomplished && onSubtaskClick && onSubtaskClick(task)}>
                                    {formatDate(task.due_date)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            {activeTasks.length > 0 && renderTable('Pending Tasks', activeTasks, false)}
            {accomplishedTasks.length > 0 && renderTable('Accomplished Tasks', accomplishedTasks, true)}
        </div>
    );
};

export default SubtaskTable;
