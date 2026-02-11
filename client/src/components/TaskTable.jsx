import React from 'react';
import { Calendar, User, Flag, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import clsx from 'clsx';

const TaskTable = ({ tasks = [], employees = [], onTaskClick }) => {

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

    const getAssigneeName = (id) => {
        if (!id) return 'Unassigned';
        const emp = employees.find(e => e.id === id);
        return emp ? (emp.name || `${emp.first_name} ${emp.last_name}`) : 'Unknown';
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    // Filter Tasks
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const accomplished = tasks.filter(t => t.status === 'Done');
    const pending = tasks.filter(t => t.status !== 'Done');

    // Sort logic can remain, usually by due date? let's keep original order or default sort
    const overdue = pending.filter(t => {
        if (!t.due_date) return false;
        // Parse "YYYY-MM-DD"
        const due = new Date(t.due_date);
        return due < todayStart;
    });

    const active = pending.filter(t => {
        if (!t.due_date) return true;
        const due = new Date(t.due_date);
        return due >= todayStart;
    });

    if (tasks.length === 0) {
        return (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-500">No activities found for this project.</p>
            </div>
        );
    }

    const renderTable = (title, data, headerClass) => (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8 last:mb-0">
            <div className={`px-6 py-3 border-b border-slate-200 font-bold text-sm uppercase tracking-wide ${headerClass}`}>
                {title} ({data.length})
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-bold">
                        <tr>
                            <th className="px-6 py-4">Activity Name</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Budget</th>
                            <th className="px-6 py-4">Actual</th>
                            <th className="px-6 py-4">Division</th>
                            <th className="px-6 py-4">Start Date</th>
                            <th className="px-6 py-4">Due Date</th>
                            <th className="px-6 py-4">Priority</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.map(task => (
                            <tr
                                key={task.id}
                                onClick={() => onTaskClick && onTaskClick(task)}
                                className="hover:bg-blue-50 cursor-pointer transition-colors"
                            >
                                <td className="px-6 py-4">
                                    <div className="font-medium text-slate-800">{task.title}</div>
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
                                    {task.budget ? `$${Number(task.budget).toLocaleString()}` : '-'}
                                </td>
                                <td className="px-6 py-4 text-slate-800 font-mono text-xs">
                                    {(() => {
                                        const expenses = task.expenses || [];
                                        const total = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
                                        const displayCost = total > 0 ? total : (task.cost || 0);
                                        return displayCost ? `$${Number(displayCost).toLocaleString()}` : '-';
                                    })()}
                                </td>

                                <td className="px-6 py-4 text-slate-600">
                                    {task.division_name || '-'}
                                </td>
                                <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                                    {formatDate(task.start_date)}
                                </td>
                                <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                                    {formatDate(task.due_date)}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={clsx("px-2 py-1 rounded text-xs font-medium", getPriorityColor(task.priority))}>
                                        {task.priority || 'Normal'}
                                    </span>
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
            {overdue.length > 0 && renderTable('Critical / Overdue Activities', overdue, 'bg-red-50 text-red-700')}
            {active.length > 0 && renderTable('Active Activities', active, 'bg-blue-50 text-blue-700')}
            {accomplished.length > 0 && renderTable('Accomplished Activities', accomplished, 'bg-green-50 text-green-700')}

            {/* Fallback if all filtering fails but tasks existed (shouldn't occur with above logic covering all cases) */}
        </div>
    );
};

export default TaskTable;
