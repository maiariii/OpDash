import React, { useState } from 'react';
import { Calendar, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import clsx from 'clsx';

const TaskTable = ({ tasks = [], employees = [], onTaskClick }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'due_date', direction: 'asc' });

    const getStatusColor = (status) => {
        switch (status) {
            case 'Done': return 'bg-green-100 text-green-700 border-green-200';
            case 'In Progress': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'High': return 'text-red-600 bg-red-50';
            case 'Medium': return 'text-orange-600 bg-orange-50';
            case 'Low': return 'text-blue-600 bg-blue-50';
            default: return 'text-slate-500';
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

    // Filter Tasks
    const accomplished = tasks.filter(t => t.status === 'Done');
    const pending = tasks.filter(t => t.status !== 'Done');

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
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('budget')}>
                                <div className="flex items-center">Budget {getSortIcon('budget')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('cost')}>
                                <div className="flex items-center">Actual {getSortIcon('cost')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('division_name')}>
                                <div className="flex items-center">Division {getSortIcon('division_name')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('start_date')}>
                                <div className="flex items-center">Start Date {getSortIcon('start_date')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('due_date')}>
                                <div className="flex items-center">Due Date {getSortIcon('due_date')}</div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('priority')}>
                                <div className="flex items-center">Priority {getSortIcon('priority')}</div>
                            </th>
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
                                        </div>
                                        {task.objective && (
                                            <div className="text-xs text-slate-400 truncate max-w-[200px]">{task.objective}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium border", getStatusColor(task.status))}>
                                            {task.status}
                                        </span>
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

                                    <td className="px-6 py-4 text-slate-600">
                                        {task.division_name || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                                        {formatDate(task.start_date)}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                                        <span className={clsx(overdue && "text-red-600 font-bold")}>
                                            {formatDate(task.due_date)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={clsx("px-2 py-1 rounded text-xs font-medium", getPriorityColor(task.priority))}>
                                            {task.priority || 'Normal'}
                                        </span>
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
        </div>
    );
};

export default TaskTable;
