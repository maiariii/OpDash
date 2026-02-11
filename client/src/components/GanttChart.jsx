import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import Gantt from 'frappe-gantt';
import 'frappe-gantt/dist/frappe-gantt.css';

const GanttChart = ({ tasks = [], onTaskClick }) => {
    const ganttRef = useRef(null);
    const ganttInstance = useRef(null);

    // Helper to generate consistent, visible colors using HSL
    const stringToColor = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = Math.abs(hash) % 360;
        return `hsl(${h}, 70%, 50%)`;
    };

    // Restore real data processing
    const ganttTasks = useMemo(() => {
        return tasks
            .filter(t => t.start_date || t.due_date)
            .map(t => {
                const divisionName = t.division_name || 'Unassigned';
                const divisionClass = `gantt-div-${divisionName.replace(/[^a-zA-Z0-9-]/g, '-')}`;

                return {
                    id: t.id,
                    name: t.title,
                    start: t.start_date || new Date().toISOString().split('T')[0],
                    end: t.due_date || new Date().toISOString().split('T')[0],
                    progress: t.status === 'Done' ? 100 : t.status === 'In Progress' ? 50 : 0,
                    dependencies: '',
                    custom_class: divisionClass,
                    _division: divisionName
                };
            });
    }, [tasks]);

    const uniqueDivisions = useMemo(() => {
        const divs = new Set(ganttTasks.map(t => t._division));
        return Array.from(divs);
    }, [ganttTasks]);

    useEffect(() => {
        if (!ganttRef.current || ganttTasks.length === 0) return;

        // Clear previous instance if needed (Frappe Gantt appends SVG)
        ganttRef.current.innerHTML = '';

        try {
            ganttInstance.current = new Gantt(ganttRef.current, ganttTasks, {
                header_height: 50,
                column_width: 30,
                step: 24,
                view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
                bar_height: 20,
                bar_corner_radius: 3,
                arrow_curve: 5,
                padding: 18,
                view_mode: 'Week',
                date_format: 'YYYY-MM-DD',
                custom_popup_html: null,
                on_click: (task) => {
                    console.log('Clicked', task);
                    if (onTaskClick) onTaskClick(task);
                },
                on_date_change: (task, start, end) => console.log('Date change', task, start, end),
                on_progress_change: (task, progress) => console.log('Progress change', task, progress),
                on_view_change: (mode) => console.log('View change', mode)
            });
            console.log("Gantt initialized successfully");
        } catch (err) {
            console.error("Failed to initialize Frappe Gantt:", err);
            ganttRef.current.innerHTML = `<div class="text-red-500 p-4">Error loading Gantt Chart: ${err.message}</div>`;
        }

    }, [ganttTasks]);

    if (ganttTasks.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                No tasks with dates found for Gantt visualization.
            </div>
        );
    }

    return (
        <div className="gantt-wrapper card-shadow bg-white p-4 rounded-xl border border-slate-200">
            {/* Dynamic Styles for Division Colors */}
            <style dangerouslySetInnerHTML={{
                __html: uniqueDivisions.map(div => {
                    const color = stringToColor(div);
                    // Frappe Gantt manual implementation usually uses .gantt-target .bar-wrapper...
                    const className = `gantt-div-${div.replace(/[^a-zA-Z0-9-]/g, '-')}`;
                    return `
                        .gantt .bar-wrapper.${className} .bar-progress { fill: ${color} !important; }
                        .gantt .bar-wrapper.${className} .bar { fill: ${color} !important; opacity: 0.5; }
                        .gantt .bar-wrapper.${className}:hover .bar { fill: ${color} !important; opacity: 0.7; }
                     `;
                }).join('\n')
            }} />

            <div className="flex gap-4 mb-4 flex-wrap">
                {uniqueDivisions.map(div => (
                    <div key={div} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stringToColor(div) }}></span>
                        <span className="text-slate-600">{div}</span>
                    </div>
                ))}
            </div>

            {/* Container for Frappe Gantt */}
            <div className="overflow-x-auto">
                <svg ref={ganttRef} id="gantt-chart" width="100%"></svg>
            </div>
        </div>
    );
};

export default GanttChart;
