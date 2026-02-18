import React, { useState } from 'react';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
    parseISO, isToday
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import clsx from 'clsx';

const CalendarView = ({ activities = [], title = "Activity Calendar", onActivityClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Helper to find activities for a specific day
    const getActivitiesForDay = (day) => {
        return activities.filter(activity => {
            if (!activity.target_date && !activity.due_date) return false;
            // Prefer target_date (for catch-ups/milestones) or due_date (for tasks)
            const dateStr = activity.target_date || activity.due_date;
            if (!dateStr) return false;

            // Handle potentially different date formats if necessary, but assuming ISO string or YYYY-MM-DD
            // activity.target_date might be ISO string
            const activityDate = new Date(dateStr);
            return isSameDay(activityDate, day);
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2">
                    <CalendarIcon className="text-blue-600" size={20} />
                    <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={goToToday} className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">
                        Today
                    </button>
                    <div className="flex items-center bg-slate-100 rounded-lg p-1">
                        <button onClick={prevMonth} className="p-1 hover:bg-white hover:shadow rounded text-slate-600">
                            <ChevronLeft size={20} />
                        </button>
                        <span className="px-3 font-semibold text-slate-700 min-w-[140px] text-center select-none">
                            {format(currentDate, 'MMMM yyyy')}
                        </span>
                        <button onClick={nextMonth} className="p-1 hover:bg-white hover:shadow rounded text-slate-600">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {weekDays.map(day => (
                    <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-y-auto">
                {calendarDays.map((day, idx) => {
                    const dayActivities = getActivitiesForDay(day);
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const isDayToday = isToday(day);

                    return (
                        <div
                            key={day.toString()}
                            className={clsx(
                                "min-h-[100px] border-b border-r border-slate-100 p-2 transition-colors relative group",
                                !isCurrentMonth && "bg-slate-50/50 text-slate-400",
                                isCurrentMonth && "bg-white",
                                // "hover:bg-blue-50/30"
                            )}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={clsx(
                                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                                    isDayToday ? "bg-blue-600 text-white" : "text-slate-700",
                                    !isCurrentMonth && !isDayToday && "text-slate-400"
                                )}>
                                    {format(day, 'd')}
                                </span>
                                {dayActivities.length > 0 && (
                                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 rounded-full">
                                        {dayActivities.length}
                                    </span>
                                )}
                            </div>

                            <div className="space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                                {dayActivities.map((activity, actIdx) => (
                                    <div
                                        key={activity.id || actIdx}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onActivityClick && onActivityClick(activity);
                                        }}
                                        className={clsx(
                                            "text-[10px] px-1.5 py-1 rounded truncate border cursor-pointer transition-shadow hover:shadow-md hover:z-10 relative",
                                            activity.status === 'Done' || activity.status === 'Completed' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                                (activity.status === 'In Progress' || activity.status === 'Ongoing') ? "bg-blue-50 text-blue-700 border-blue-100" :
                                                    "bg-slate-50 text-slate-600 border-slate-200"
                                        )}
                                        title={`${activity.title || 'Untitled'} - ${activity.status}`}
                                    >
                                        <div className="font-semibold truncate">
                                            {activity.title || 'Untitled'}
                                        </div>
                                        {activity.project_name && <div className="text-[9px] opacity-75 truncate">{activity.project_name}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div >
    );
};

export default CalendarView;
