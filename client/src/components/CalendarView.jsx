import React, { useState, useMemo } from 'react';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
    addWeeks, subWeeks, isToday, startOfDay, endOfDay, isWithinInterval
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Layers, LayoutGrid, List, ChevronDown, Filter, Check } from 'lucide-react';
import clsx from 'clsx';

const CalendarView = ({ activities = [], title = "Activity Calendar", onActivityClick, onDayClick, onRangeSelect }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'biweek'
    const [filterStatus, setFilterStatus] = useState(['Pending', 'In Progress']); // Default: Pending & Ongoing
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Activity Type Filter
    const activityTypes = ['Deskwork', 'Communications', 'Workshop', 'Field Visit'];
    // Default: Exclude Deskwork and Communications
    const [filterType, setFilterType] = useState(['Workshop', 'Field Visit']);

    // Drag Selection State
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState(null);
    const [dragEnd, setDragEnd] = useState(null);

    const next = () => {
        if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
        else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
        else if (viewMode === 'biweek') setCurrentDate(addWeeks(currentDate, 2));
    };

    const prev = () => {
        if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
        else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
        else if (viewMode === 'biweek') setCurrentDate(subWeeks(currentDate, 2));
    };

    const goToToday = () => setCurrentDate(new Date());

    // Generate days based on view mode
    let calendarDays = [];
    let headerTitle = '';

    if (viewMode === 'month') {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
        headerTitle = format(currentDate, 'MMMM yyyy');
    } else if (viewMode === 'week') {
        const startDate = startOfWeek(currentDate);
        const endDate = endOfWeek(currentDate);
        calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
        headerTitle = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
    } else if (viewMode === 'biweek') {
        const startDate = startOfWeek(currentDate);
        const endDate = endOfWeek(addWeeks(startDate, 1)); // 2 weeks total
        calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
        headerTitle = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
    }

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // --- Status Filtering Logic ---
    const explicitStatuses = [
        'Pending',
        'In Progress', // Note: data might use 'Ongoing' too, we can handle normalization or multiple checks
        'Accomplished', // Note: data might use 'Done'/'Completed' too
        'Deferred',
        'Waitlisted',
        'Continuing',
        'Cancelled'
    ];

    const uniqueStatuses = useMemo(() => {
        // We prioritizing the explicit list, but if we want to show OTHER statuses that exist in data but not in list, we could merge.
        // However, the user request "Use this activity status selection" implies a fixed list.
        // But for safety, if there are statuses in data NOT in this list, they should probably validation or "Other".
        // For now, let's just stick to the requested list as the filter options.
        return explicitStatuses;
    }, []);

    const filteredActivities = useMemo(() => {
        if (filterStatus.length === 0 && filterType.length === 0) return [];
        return activities.filter(a => {
            const statusMatch = filterStatus.includes(a.status);
            // If activity has no type, treat it cautiously? Or include if only status match?
            // Let's assume default 'Deskwork' if missing, but better to check
            const type = a.activity_type || 'Deskwork';
            const typeMatch = filterType.includes(type);
            return statusMatch && typeMatch;
        });
    }, [activities, filterStatus, filterType]);

    // --- Layout Algorithm for Continuous Tiles ---

    // 1. Filter activities visible in current view
    const viewStart = calendarDays[0];
    const viewEnd = calendarDays[calendarDays.length - 1];

    const visibleActivities = filteredActivities.filter(activity => {
        let start = activity.start_date ? new Date(activity.start_date) :
            (activity.target_date ? new Date(activity.target_date) :
                (activity.due_date ? new Date(activity.due_date) : null));
        let end = activity.due_date ? new Date(activity.due_date) :
            (activity.target_date ? new Date(activity.target_date) :
                (activity.start_date ? new Date(activity.start_date) : null));

        if (!start || !end) return false;

        // Normalize
        if (start > end) { const temp = start; start = end; end = temp; }

        // Check overlap with view
        return start <= endOfDay(viewEnd) && end >= startOfDay(viewStart);
    }).map(activity => {
        // Normalize dates once for use below
        let start = activity.start_date ? new Date(activity.start_date) :
            (activity.target_date ? new Date(activity.target_date) :
                (activity.due_date ? new Date(activity.due_date) : null));
        let end = activity.due_date ? new Date(activity.due_date) :
            (activity.target_date ? new Date(activity.target_date) :
                (activity.start_date ? new Date(activity.start_date) : null));
        if (!start) start = end;
        if (!end) end = start;
        if (start > end) { const temp = start; start = end; end = temp; }

        return { ...activity, normalizedStart: startOfDay(start), normalizedEnd: endOfDay(end) };
    });

    // 2. Sort activities: earlier start first, then longer duration
    visibleActivities.sort((a, b) => {
        if (a.normalizedStart.getTime() !== b.normalizedStart.getTime()) {
            return a.normalizedStart.getTime() - b.normalizedStart.getTime();
        }
        return (b.normalizedEnd.getTime() - b.normalizedStart.getTime()) - (a.normalizedEnd.getTime() - a.normalizedStart.getTime());
    });

    // 3. Assign to rows (slots)
    // Map: dateString -> Array<Activity|null> (where index is row)
    const dayRows = {};
    calendarDays.forEach(day => {
        dayRows[day.toString()] = [];
    });

    visibleActivities.forEach(activity => {
        // Find visible days for this activity
        const daysInRange = calendarDays.filter(day =>
            day >= activity.normalizedStart && day <= activity.normalizedEnd
        );

        if (daysInRange.length === 0) return;

        // Find first available row index across ALL these days
        let rowIndex = 0;
        let found = false;
        while (!found) {
            let rowClear = true;
            for (const day of daysInRange) {
                const dayKey = day.toString();
                if (dayRows[dayKey][rowIndex] !== undefined) { // Slot taken
                    rowClear = false;
                    break;
                }
            }
            if (rowClear) {
                found = true;
            } else {
                rowIndex++;
            }
        }

        // Fill the slot
        daysInRange.forEach(day => {
            const dayKey = day.toString();
            // Verify array size padding
            while (dayRows[dayKey].length < rowIndex) {
                dayRows[dayKey].push(null); // Spacer
            }
            dayRows[dayKey][rowIndex] = activity;
        });
    });

    const handleMouseDown = (day) => {
        if (onRangeSelect) {
            setIsDragging(true);
            setDragStart(day);
            setDragEnd(day);
        }
    };

    const handleMouseEnter = (day) => {
        if (isDragging) {
            setDragEnd(day);
        }
    };

    const handleMouseUp = () => {
        if (isDragging && dragStart && dragEnd) {
            setIsDragging(false);
            // Ensure start is before end
            const start = dragStart < dragEnd ? dragStart : dragEnd;
            const end = dragStart < dragEnd ? dragEnd : dragStart;

            if (onRangeSelect) {
                onRangeSelect({ start, end });
            } else if (onDayClick) {
                onDayClick(start);
            }

            setDragStart(null);
            setDragEnd(null);
        }
    };

    // Helper to check if a day is within the drag selection
    const isDaySelected = (day) => {
        if (!dragStart || !dragEnd) return false;
        const start = dragStart < dragEnd ? dragStart : dragEnd;
        const end = dragStart < dragEnd ? dragEnd : dragStart;
        return day >= start && day <= end;
    };

    // Helper for status colors
    const getStatusColor = (status) => {
        switch (status) {
            case 'Accomplished':
            case 'Done':
            case 'Completed':
                return "bg-emerald-50 text-emerald-700 border border-emerald-100";
            case 'In Progress':
            case 'Ongoing':
            case 'Continuing':
                return "bg-blue-50 text-blue-700 border border-blue-100";
            case 'Pending':
                return "bg-slate-100 text-slate-600 border border-slate-200";
            case 'Waitlisted':
                return "bg-purple-50 text-purple-700 border border-purple-100";
            case 'Deferred':
                return "bg-amber-50 text-amber-700 border border-amber-100";
            case 'Cancelled':
                return "bg-red-50 text-red-700 border border-red-100";
            default:
                return "bg-slate-100 text-slate-600 border border-slate-200";
        }
    };

    return (
        <div
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px] select-none"
            onMouseUp={handleMouseUp} // Catch mouse up anywhere in the component
            onMouseLeave={handleMouseUp} // End drag if leaving the component
        >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between bg-white gap-4">
                <div className="flex items-center gap-2">
                    <CalendarIcon className="text-blue-600" size={20} />
                    <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 w-full sm:w-auto">
                    {/* Activity Status & Type Filter */}
                    <div className="relative">
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors"
                        >
                            <Filter size={16} />
                            <span>Filters ({filterStatus.length + filterType.length})</span>
                            <ChevronDown size={14} className="text-slate-400" />
                        </button>

                        {isFilterOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                                <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 animate-in fade-in zoom-in duration-100 flex flex-col max-h-[400px]">

                                    {/* Activity Codes / Type */}
                                    <div className="p-2 border-b border-slate-100">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Activity Type</div>
                                        <div className="space-y-1">
                                            {activityTypes.map(type => (
                                                <label key={type} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer select-none">
                                                    <div className={clsx(
                                                        "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                                        filterType.includes(type) ? "bg-purple-600 border-purple-600 text-white" : "border-slate-300 bg-white"
                                                    )}>
                                                        {filterType.includes(type) && <Check size={12} />}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={filterType.includes(type)}
                                                        onChange={() => {
                                                            setFilterType(prev =>
                                                                prev.includes(type)
                                                                    ? prev.filter(t => t !== type)
                                                                    : [...prev, type]
                                                            );
                                                        }}
                                                        className="hidden"
                                                    />
                                                    <span className="text-sm text-slate-700">{type}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div className="p-2 flex-1 overflow-y-auto custom-scrollbar">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Status</div>
                                        <div className="space-y-1">
                                            {uniqueStatuses.map(status => (
                                                <label key={status} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer select-none">
                                                    <div className={clsx(
                                                        "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                                        filterStatus.includes(status) ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
                                                    )}>
                                                        {filterStatus.includes(status) && <Check size={12} />}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={filterStatus.includes(status)}
                                                        onChange={() => {
                                                            setFilterStatus(prev =>
                                                                prev.includes(status)
                                                                    ? prev.filter(s => s !== status)
                                                                    : [...prev, status]
                                                            );
                                                        }}
                                                        className="hidden"
                                                    />
                                                    <span className="text-sm text-slate-700">{status}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-2 border-t border-slate-100 bg-slate-50 flex gap-2">
                                        <button
                                            onClick={() => {
                                                setFilterStatus(uniqueStatuses);
                                                setFilterType(activityTypes);
                                            }}
                                            className="text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded hover:bg-blue-50 flex-1 border border-blue-100 bg-white"
                                        >
                                            Reset All
                                        </button>
                                        <button
                                            onClick={() => {
                                                setFilterStatus([]);
                                                setFilterType([]);
                                            }}
                                            className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded hover:bg-slate-200 flex-1 border border-slate-200 bg-white"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* View Switcher */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('month')}
                            className={clsx("px-3 py-1 text-xs font-medium rounded-md transition-all", viewMode === 'month' ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700")}
                        >
                            Month
                        </button>
                        <button
                            onClick={() => setViewMode('biweek')}
                            className={clsx("px-3 py-1 text-xs font-medium rounded-md transition-all", viewMode === 'biweek' ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700")}
                        >
                            2-Weeks
                        </button>
                        <button
                            onClick={() => setViewMode('week')}
                            className={clsx("px-3 py-1 text-xs font-medium rounded-md transition-all", viewMode === 'week' ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700")}
                        >
                            Week
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={goToToday} className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors mr-2">
                            Today
                        </button>
                        <div className="flex items-center bg-slate-100 rounded-lg p-1">
                            <button onClick={prev} className="p-1 hover:bg-white hover:shadow rounded text-slate-600">
                                <ChevronLeft size={20} />
                            </button>
                            <span className="px-3 font-semibold text-slate-700 min-w-[170px] text-center select-none text-sm">
                                {headerTitle}
                            </span>
                            <button onClick={next} className="p-1 hover:bg-white hover:shadow rounded text-slate-600">
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Days Header */}
            <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {weekDays.map(day => (
                    <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid - Week Based Rendering */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                {/* Divide calendarDays into weeks */}
                {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, weekIdx) => {
                    const weekStartIdx = weekIdx * 7;
                    const weekDays = calendarDays.slice(weekStartIdx, weekStartIdx + 7);

                    // Determine max rows in this week to set height
                    let maxRow = 0;
                    weekDays.forEach(day => {
                        const rows = dayRows[day.toString()] || [];
                        if (rows.length > maxRow) maxRow = rows.length;
                    });
                    const weekHeight = Math.max(100, (maxRow * 28) + 40);

                    return (
                        <div key={`week-${weekIdx}`} className="flex relative border-b border-slate-200" style={{ minHeight: '100px', height: `${weekHeight}px` }}>
                            {/* Background Grid (Day Cells) */}
                            {weekDays.map((day) => {
                                const isCurrentMonth = isSameMonth(day, currentDate);
                                const isDayToday = isToday(day);
                                const isSelected = isDaySelected(day);

                                return (
                                    <div
                                        key={day.toString()}
                                        onMouseDown={() => handleMouseDown(day)}
                                        onMouseEnter={() => handleMouseEnter(day)}
                                        className={clsx(
                                            "flex-1 border-r border-slate-100 transition-colors relative group h-full",
                                            viewMode === 'month' && !isCurrentMonth && "bg-slate-50/50 text-slate-400",
                                            (viewMode !== 'month' || isCurrentMonth) && "bg-white",
                                            isSelected && "bg-blue-50 ring-inset ring-2 ring-blue-200",
                                            (onRangeSelect || onDayClick) && "cursor-pointer hover:bg-slate-50"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-1 h-7 p-2">
                                            <span className={clsx(
                                                "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full z-10 relative",
                                                isDayToday ? "bg-blue-600 text-white" : "text-slate-700",
                                                viewMode === 'month' && !isCurrentMonth && !isDayToday && "text-slate-400"
                                            )}>
                                                {format(day, 'd')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Events Layer (Absolute Positioning) */}
                            <div className="absolute inset-x-0 top-[30px] bottom-0 pointer-events-none">
                                {(() => {
                                    const renderedActivityKeys = new Set();
                                    const weekEvents = [];

                                    weekDays.forEach((day, dayIdx) => {
                                        const rows = dayRows[day.toString()] || [];
                                        rows.forEach((activity, rowIndex) => {
                                            if (!activity) return;

                                            // Unique key for this activity IN THIS WEEK
                                            const key = `${activity.id}-${weekIdx}`;
                                            if (renderedActivityKeys.has(key)) return;

                                            renderedActivityKeys.add(key);

                                            // Find span end
                                            let spanEndIdx = dayIdx;
                                            for (let k = dayIdx + 1; k < 7; k++) {
                                                const nextDayRows = dayRows[weekDays[k].toString()] || [];
                                                if (nextDayRows[rowIndex] === activity) {
                                                    spanEndIdx = k;
                                                } else {
                                                    break;
                                                }
                                            }

                                            weekEvents.push({
                                                activity,
                                                startIdx: dayIdx,
                                                endIdx: spanEndIdx,
                                                rowIndex
                                            });
                                        });
                                    });

                                    return weekEvents.map((evt) => {
                                        const isActualStart = isSameDay(weekDays[evt.startIdx], evt.activity.normalizedStart);
                                        const isActualEnd = isSameDay(weekDays[evt.endIdx], evt.activity.normalizedEnd);

                                        return (
                                            <div
                                                key={`${evt.activity.id}-${weekIdx}-${evt.startIdx}`}
                                                className={clsx(
                                                    "absolute h-[24px] text-[10px] px-2 flex items-center justify-center cursor-pointer transition-shadow hover:shadow-md hover:z-50 pointer-events-auto",
                                                    getStatusColor(evt.activity.status),

                                                    isActualStart ? "rounded-l" : "rounded-l-none border-l-0",
                                                    isActualEnd ? "rounded-r" : "rounded-r-none border-r-0",
                                                    (!isActualStart) && "-ml-[1px]", // Overlap left border
                                                    (!isActualEnd) && "-mr-[1px]"   // Overlap right border
                                                )}
                                                style={{
                                                    top: `${evt.rowIndex * 28}px`,
                                                    left: `${evt.startIdx * 14.28}%`,
                                                    width: `${(evt.endIdx - evt.startIdx + 1) * 14.28}%`,
                                                    zIndex: 20
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onActivityClick && onActivityClick(evt.activity);
                                                }}
                                                title={`${evt.activity.title} - ${evt.activity.status}`}
                                            >
                                                <span className="truncate font-semibold w-full text-center block">
                                                    {evt.activity.title || 'Untitled'}
                                                </span>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div >
    );
};

export default CalendarView;
