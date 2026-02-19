import React, { useState, useMemo } from 'react';
import { List, BarChart3, Users } from 'lucide-react';
import { startOfWeek, endOfWeek, isWithinInterval, startOfDay } from 'date-fns';
import clsx from 'clsx';
import WorkloadTable from './WorkloadTable';
import WorkloadChart from './WorkloadChart';

const WorkloadView = ({ tasks = [], employees = [], onSubtaskClick }) => {
    const [activeTab, setActiveTab] = useState('list'); // 'list' | 'graph'

    // Flatten tasks calculation hoisted here to share with chart
    const subtasks = useMemo(() => {
        const flattened = [];
        tasks.forEach(task => {
            (task.subtasks || []).forEach(subtask => {
                flattened.push({
                    ...subtask,
                    parentTitle: task.title,
                    parentId: task.id,
                    parentTask: task,
                    dateObj: subtask.due_date ? new Date(subtask.due_date) : null
                });
            });
        });
        return flattened;
    }, [tasks]);

    // Weekly Summary Calculation
    const weeklySummary = useMemo(() => {
        const today = new Date();
        const start = startOfWeek(today, { weekStartsOn: 1 });
        const end = endOfWeek(today, { weekStartsOn: 1 });

        return employees.map(emp => {
            const count = subtasks.filter(t => {
                if (t.assignee_id !== emp.id) return false;
                if (t.status === 'Accomplished') return false;
                if (!t.due_date) return false;
                const dueDate = startOfDay(new Date(t.due_date));
                return isWithinInterval(dueDate, { start, end });
            }).length;
            return { ...emp, weeklyCount: count };
        });
    }, [subtasks, employees]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 px-1">Team Workload</h2>
                <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                            activeTab === 'list' ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <List size={16} />
                        List View
                    </button>
                    <button
                        onClick={() => setActiveTab('graph')}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                            activeTab === 'graph' ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <BarChart3 size={16} />
                        Weekly Graph
                    </button>
                </div>
            </div>

            {activeTab === 'list' ? (
                <WorkloadTable
                    tasks={tasks}
                    employees={employees}
                    onSubtaskClick={onSubtaskClick}
                />
            ) : (
                <WorkloadChart summary={weeklySummary} />
            )}
        </div>
    );
};

export default WorkloadView;
