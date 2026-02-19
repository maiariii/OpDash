import React, { useState, useMemo } from 'react';
import { Calendar, Search, Filter, ArrowUpDown, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

const WorkloadTable = ({ tasks = [], employees = [], onSubtaskClick }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'due_date', direction: 'asc' });
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        assignee: ''
    });

    // Flatten tasks into subtasks
    const subtasks = useMemo(() => {
        const flattened = [];
        tasks.forEach(task => {
            (task.subtasks || []).forEach(subtask => {
                flattened.push({
                    ...subtask,
                    parentTitle: task.title,
                    parentId: task.id,
                    parentTask: task,
                    // Ensure we have a valid date object for sorting if exists
                    dateObj: subtask.due_date ? new Date(subtask.due_date) : null
                });
            });
        });
        return flattened;
    }, [tasks]);

    // Helpers
    const getAssignee = (id) => employees.find(e => e.id === id);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Accomplished': return 'bg-green-100 text-green-700 border-green-200';
            case 'In Progress': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Filter and Sort
    const processedSubtasks = useMemo(() => {
        let result = [...subtasks];

        // Filter
        if (filters.search) {
            const q = filters.search.toLowerCase();
            result = result.filter(s =>
                s.title.toLowerCase().includes(q) ||
                s.parentTitle.toLowerCase().includes(q)
            );
        }
        if (filters.status) {
            result = result.filter(s => s.status === filters.status);
        }
        if (filters.assignee) {
            result = result.filter(s => {
                const assignee = getAssignee(s.assignee_id);
                const name = assignee ? (assignee.name || `${assignee.first_name} ${assignee.last_name}`) : '';
                return name === filters.assignee;
            });
        }

        // Sort
        result.sort((a, b) => {
            let valA, valB;

            switch (sortConfig.key) {
                case 'due_date':
                    valA = a.dateObj ? a.dateObj.getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
                    valB = b.dateObj ? b.dateObj.getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
                    break;
                case 'status':
                    valA = a.status || '';
                    valB = b.status || '';
                    break;
                case 'title':
                    valA = a.title.toLowerCase();
                    valB = b.title.toLowerCase();
                    break;
                case 'assignee':
                    const assignA = getAssignee(a.assignee_id);
                    const assignB = getAssignee(b.assignee_id);
                    valA = assignA ? (assignA.name || assignA.first_name) : 'zz'; // Put unassigned last
                    valB = assignB ? (assignB.name || assignB.first_name) : 'zz';
                    break;
                default:
                    return 0;
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [subtasks, filters, sortConfig, employees]);

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <ArrowUpDown size={14} className="opacity-30" />;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
    };

    // Extract unique values for filters
    const uniqueStatuses = [...new Set(subtasks.map(s => s.status || 'Todo'))];
    const uniqueAssignees = [...new Set(subtasks.map(s => {
        const a = getAssignee(s.assignee_id);
        return a ? (a.name || `${a.first_name} ${a.last_name}`) : null;
    }).filter(Boolean))];

    // Split tasks
    const activeTasks = processedSubtasks.filter(t => t.status !== 'Accomplished');
    const completedTasks = processedSubtasks.filter(t => t.status === 'Accomplished');

    const renderTable = (data, title, emptyMessage) => (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    {title}
                    <span className="text-xs font-normal bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                        {data.length}
                    </span>
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                        <tr>
                            <th onClick={() => handleSort('title')} className="px-6 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none">
                                <div className="flex items-center gap-2">Task <SortIcon column="title" /></div>
                            </th>
                            <th onClick={() => handleSort('assignee')} className="px-6 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none">
                                <div className="flex items-center gap-2">Assignee <SortIcon column="assignee" /></div>
                            </th>
                            <th onClick={() => handleSort('status')} className="px-6 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none">
                                <div className="flex items-center gap-2">Status <SortIcon column="status" /></div>
                            </th>
                            <th onClick={() => handleSort('due_date')} className="px-6 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none">
                                <div className="flex items-center gap-2">Due Date <SortIcon column="due_date" /></div>
                            </th>
                            <th className="px-6 py-3">Parent Activity</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            data.map((item, idx) => {
                                const assignee = getAssignee(item.assignee_id);
                                return (
                                    <tr
                                        key={`${item.id}-${idx}`}
                                        onClick={() => onSubtaskClick && onSubtaskClick(item)}
                                        className="hover:bg-blue-50 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-6 py-3">
                                            <div className="font-medium text-slate-800">{item.title}</div>
                                        </td>
                                        <td className="px-6 py-3">
                                            {assignee ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                                                        {assignee.first_name[0]}{assignee.last_name[0]}
                                                    </div>
                                                    <span className="text-slate-600 font-medium">
                                                        {assignee.first_name} {assignee.last_name}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={clsx("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border", getStatusColor(item.status))}>
                                                {item.status || 'Todo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            {item.due_date ? (
                                                <div className="flex items-center gap-1.5 text-slate-600 font-mono text-xs">
                                                    <Calendar size={14} className="text-slate-400" />
                                                    {new Date(item.due_date).toLocaleDateString()}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-slate-500 text-xs">
                                            {item.parentTitle}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-10 transition-all">
                <div className="flex-1 relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        value={filters.search}
                        onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="flex gap-4">
                    <select
                        value={filters.status}
                        onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none cursor-pointer"
                    >
                        <option value="">All Statuses</option>
                        {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select
                        value={filters.assignee}
                        onChange={e => setFilters(prev => ({ ...prev, assignee: e.target.value }))}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none cursor-pointer"
                    >
                        <option value="">All Assignees</option>
                        {uniqueAssignees.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
            </div>

            {/* Tables */}
            <div>
                {renderTable(activeTasks, "Active Tasks", "No active tasks found.")}

                {completedTasks.length > 0 && (
                    <div className="opacity-75 hover:opacity-100 transition-opacity">
                        {renderTable(completedTasks, "Completed Tasks", "No completed tasks.")}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkloadTable;
