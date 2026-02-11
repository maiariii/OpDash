import React, { useState } from 'react';
import clsx from 'clsx';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const WorkloadChart = ({ summary = [] }) => {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    // Filter out 0 counts for the chart
    const data = summary.filter(s => s.weeklyCount > 0);
    const total = data.reduce((sum, item) => sum + item.weeklyCount, 0);

    // If no data
    if (total === 0) {
        return (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center h-64 text-slate-400">
                <div className="mb-2 text-lg font-medium">No tasks due this week</div>
                <div className="text-sm">Enjoy the break!</div>
            </div>
        );
    }

    let cumulativePercent = 0;

    const getCoordinatesForPercent = (percent) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    const slices = data.map((item, index) => {
        const startPercent = cumulativePercent;
        const slicePercent = item.weeklyCount / total;
        cumulativePercent += slicePercent;
        const endPercent = cumulativePercent;

        // Calculate SVG path
        const [startX, startY] = getCoordinatesForPercent(startPercent);
        const [endX, endY] = getCoordinatesForPercent(endPercent);

        let pathData;
        if (slicePercent === 1) {
            pathData = `M 1 0 A 1 1 0 1 1 -1 0 A 1 1 0 1 1 1 0 Z`;
        } else {
            const largeArcFlag = slicePercent > 0.5 ? 1 : 0;
            pathData = [
                `M 0 0`,
                `L ${startX} ${startY}`,
                `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                `L 0 0`,
            ].join(' ');
        }

        return {
            ...item,
            path: pathData,
            color: COLORS[index % COLORS.length],
            percent: Math.round(slicePercent * 100)
        };
    });

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Workload Distribution (This Week)</h3>

            <div className="flex flex-col md:flex-row items-center justify-center gap-12">
                {/* Pie Chart */}
                <div className="relative w-64 h-64">
                    <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full transform -rotate-90">
                        {slices.map((slice, i) => (
                            <path
                                key={slice.id}
                                d={slice.path}
                                fill={slice.color}
                                stroke="white"
                                strokeWidth="0.02"
                                className={clsx(
                                    "transition-opacity duration-200 cursor-pointer",
                                    hoveredIndex === i ? "opacity-100" : (hoveredIndex !== null ? "opacity-50" : "opacity-100")
                                )}
                                onMouseEnter={() => setHoveredIndex(i)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            />
                        ))}
                    </svg>
                </div>

                {/* Legend */}
                <div className="flex flex-col gap-3 min-w-[200px]">
                    {slices.map((slice, i) => (
                        <div
                            key={slice.id}
                            className={clsx(
                                "flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer",
                                hoveredIndex === i ? "bg-slate-50 border-slate-300 shadow-sm scale-[1.02]" : "border-transparent hover:bg-slate-50"
                            )}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: slice.color }}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-700 truncate">
                                    {slice.first_name} {slice.last_name}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {slice.weeklyCount} {slice.weeklyCount === 1 ? 'task' : 'tasks'} ({slice.percent}%)
                                </div>
                            </div>
                        </div>
                    ))}
                    <div className="mt-2 pt-2 border-t border-slate-100 text-right text-xs font-medium text-slate-400">
                        Total: {total} Tasks
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkloadChart;
