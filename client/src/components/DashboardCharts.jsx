import React, { useState } from 'react';
import { PieChart, BarChart3, Users, DollarSign, Activity, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

const COLORS = {
    'Pending': '#f59e0b', // Amber
    'Accomplished': '#10b981', // Emerald
    'Delayed': '#ef4444', // Red
    'Budget': '#3b82f6', // Blue
    'Spent': '#8b5cf6'  // Violet
};

const MetricCard = ({ title, value, subtext, icon: Icon, color }) => (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
        <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
            {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
        </div>
        <div className={clsx("p-3 rounded-lg", color)}>
            <Icon size={20} className="text-white" />
        </div>
    </div>
);

const SimplePieChart = ({ data }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const [hoveredIndex, setHoveredIndex] = useState(null);

    if (total === 0) return <div className="text-center text-slate-400 py-10">No activities found</div>;

    let cumulativePercent = 0;
    const slices = data.map((item, index) => {
        const startPercent = cumulativePercent;
        const slicePercent = item.value / total;
        cumulativePercent += slicePercent;
        const endPercent = cumulativePercent;

        const getCoordinatesForPercent = (percent) => {
            const x = Math.cos(2 * Math.PI * percent);
            const y = Math.sin(2 * Math.PI * percent);
            return [x, y];
        };

        const [startX, startY] = getCoordinatesForPercent(startPercent);
        const [endX, endY] = getCoordinatesForPercent(endPercent);

        const largeArcFlag = slicePercent > 0.5 ? 1 : 0;
        const pathData = slicePercent === 1
            ? `M 1 0 A 1 1 0 1 1 -1 0 A 1 1 0 1 1 1 0 Z`
            : `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L 0 0`;

        return { ...item, path: pathData, percent: Math.round(slicePercent * 100) };
    });

    return (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <div className="relative w-48 h-48">
                <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full transform -rotate-90">
                    {slices.map((slice, i) => (
                        <path
                            key={i}
                            d={slice.path}
                            fill={slice.color}
                            stroke="white"
                            strokeWidth="0.02"
                            className={clsx("transition-opacity cursor-pointer", hoveredIndex === i ? "opacity-100" : (hoveredIndex !== null ? "opacity-50" : "opacity-100"))}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        />
                    ))}
                </svg>
            </div>
            <div className="space-y-2">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-medium text-slate-700">{item.label}</span>
                        <span className="text-slate-500">({item.value})</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const FinancialBar = ({ label, value, max, color }) => {
    const percent = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-slate-700">{label}</span>
                <span className="font-bold text-slate-900">${value.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
};

const DashboardCharts = ({ metrics }) => {
    const {
        totalProjects,
        totalEmployees,
        totalActivities,
        pendingActivities,
        accomplishedActivities,
        delayedActivities,
        totalBudget,
        totalSpent
    } = metrics;

    const activityData = [
        { label: 'Pending', value: pendingActivities, color: COLORS.Pending },
        { label: 'Accomplished', value: accomplishedActivities, color: COLORS.Accomplished },
        { label: 'Delayed', value: delayedActivities, color: COLORS.Delayed }
    ];

    return (
        <div className="space-y-6">
            {/* Metric Cards Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Activities"
                    value={totalActivities}
                    icon={Activity}
                    color="bg-blue-500"
                />
                <MetricCard
                    title="Pending"
                    value={pendingActivities}
                    icon={Clock}
                    color="bg-amber-500"
                />
                <MetricCard
                    title="Accomplished"
                    value={accomplishedActivities}
                    icon={CheckCircle2}
                    color="bg-emerald-500"
                />
                <MetricCard
                    title="Delayed"
                    value={delayedActivities}
                    icon={AlertTriangle}
                    color="bg-red-500"
                />
            </div>

            {/* Metric Cards Row 2 (Financials & People) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                    title="Total Employees"
                    value={totalEmployees}
                    icon={Users}
                    color="bg-indigo-500"
                />
                <MetricCard
                    title="Total Budget"
                    value={`$${totalBudget.toLocaleString()}`}
                    icon={DollarSign}
                    color="bg-blue-600"
                />
                <MetricCard
                    title="Amount Spent"
                    value={`$${totalSpent.toLocaleString()}`}
                    icon={BarChart3}
                    color="bg-violet-600"
                />
            </div>

            {/* Graphs Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Activity Status Pie Chart */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Activity Status</h3>
                    <SimplePieChart data={activityData} />
                </div>

                {/* Financials Bar Chart */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Financial Overview</h3>
                    <div className="space-y-6 py-4">
                        <FinancialBar
                            label="Total Budget"
                            value={totalBudget}
                            max={Math.max(totalBudget, totalSpent) * 1.1} // Scale relative to max
                            color={COLORS.Budget}
                        />
                        <FinancialBar
                            label="Amount Spent"
                            value={totalSpent}
                            max={Math.max(totalBudget, totalSpent) * 1.1}
                            color={COLORS.Spent}
                        />
                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-slate-500">Utilization Rate</span>
                                <span className={clsx("text-lg font-bold", totalSpent > totalBudget ? "text-red-500" : "text-emerald-600")}>
                                    {totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardCharts;
