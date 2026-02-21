import React from 'react';
import { Calendar, User, Flag, AlertCircle, CheckCircle2, Clock, Paperclip } from 'lucide-react';
import clsx from 'clsx';

const ActivityList = ({ activities = [], employees = [], onActivityClick }) => {

    const getStatusColor = (status) => {
        switch (status) {
            case 'Accomplished': return 'bg-green-100 text-green-700 border-green-200';
            case 'In Progress': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Continuing': return 'bg-sky-100 text-sky-700 border-sky-200';
            case 'Deferred': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'Cancelled': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'High': return 'text-red-600 bg-red-50 ring-red-500/10';
            case 'Medium': return 'text-orange-600 bg-orange-50 ring-orange-500/10';
            case 'Low': return 'text-blue-600 bg-blue-50 ring-blue-500/10';
            default: return 'text-slate-500 ring-slate-500/10';
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric'
        });
    };

    if (activities.length === 0) {
        return (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-500">No activities found.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {activities.map(activity => (
                <div
                    key={activity.id}
                    onClick={() => onActivityClick && onActivityClick(activity)}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                                    {activity.title}
                                    {activity.file_attachments && JSON.parse(activity.file_attachments).length > 0 && (
                                        <Paperclip size={14} className="inline ml-2 text-slate-400" />
                                    )}
                                </h3>
                                <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset", getPriorityColor(activity.priority))}>
                                    {activity.priority || 'Normal'}
                                </span>
                            </div>

                            {activity.objective && (
                                <p className="text-sm text-slate-500 line-clamp-2 mb-3 max-w-2xl">
                                    {activity.objective}
                                </p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                <div className="flex items-center gap-1.5">
                                    <Calendar size={14} className="text-slate-400" />
                                    <span>
                                        {formatDate(activity.start_date)} - {formatDate(activity.due_date)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <User size={14} className="text-slate-400" />
                                    <span>{activity.division_name || 'Unassigned'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium border", getStatusColor(activity.status))}>
                                {activity.status}
                            </span>
                            <div className="text-xs font-mono text-slate-400">
                                {activity.budget ? `₱${Number(activity.budget).toLocaleString()}` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ActivityList;
