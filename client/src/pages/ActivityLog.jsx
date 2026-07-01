import React, { useEffect, useState, useMemo } from 'react';
import { getActivityLogs } from '../api';
import { Search, Calendar, User, ClipboardList, Filter, X } from 'lucide-react';

const getActionBadgeClass = (action) => {
    const act = (action || '').toLowerCase();
    if (act.includes('create')) return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60';
    if (act.includes('update')) return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60';
    if (act.includes('delete')) return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60';
    if (act.includes('log') || act.includes('auth')) return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60';
    return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/60';
};

const getResourceBadgeClass = (resource) => {
    const res = (resource || '').toLowerCase();
    if (res.includes('project')) return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-300 dark:border-sky-800/30';
    if (res.includes('activity') || res.includes('task')) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-800/30';
    if (res.includes('subtask')) return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-300 dark:border-orange-800/30';
    if (res.includes('employee')) return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-300 dark:border-indigo-800/30';
    if (res.includes('milestone')) return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/20 dark:text-teal-300 dark:border-teal-800/30';
    if (res.includes('catch-up')) return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-800/30';
    if (res.includes('division')) return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/20 dark:text-violet-300 dark:border-violet-800/30';
    return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800';
};

const ActivityLog = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filter & search states
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [resourceFilter, setResourceFilter] = useState('all');
    const [userFilter, setUserFilter] = useState('all');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;

    useEffect(() => {
        setLoading(true);
        getActivityLogs()
            .then(data => {
                setLogs(data);
                setError(null);
            })
            .catch(err => {
                console.error('Failed to fetch activity logs:', err);
                setError('Failed to load activity logs.');
            })
            .finally(() => setLoading(false));
    }, []);

    // Get unique list of actions, resources, and users for filters
    const filterOptions = useMemo(() => {
        const actions = new Set();
        const resources = new Set();
        const users = new Set();

        logs.forEach(log => {
            if (log.action) actions.add(log.action);
            if (log.resource) resources.add(log.resource);
            if (log.username) users.add(log.username);
        });

        return {
            actions: Array.from(actions).sort(),
            resources: Array.from(resources).sort(),
            users: Array.from(users).sort()
        };
    }, [logs]);

    // Apply filters
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // Search match
            const matchSearch = searchTerm === '' || 
                (log.username && log.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (log.action && log.action.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (log.resource && log.resource.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchAction = actionFilter === 'all' || log.action === actionFilter;
            const matchResource = resourceFilter === 'all' || log.resource === resourceFilter;
            const matchUser = userFilter === 'all' || log.username === userFilter;

            return matchSearch && matchAction && matchResource && matchUser;
        });
    }, [logs, searchTerm, actionFilter, resourceFilter, userFilter]);

    // Paginated logs
    const paginatedLogs = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredLogs, currentPage]);

    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;

    // Reset filters
    const handleResetFilters = () => {
        setSearchTerm('');
        setActionFilter('all');
        setResourceFilter('all');
        setUserFilter('all');
        setCurrentPage(1);
    };

    const formatTimestamp = (isoString) => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch (e) {
            return isoString;
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/30 p-6 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <ClipboardList className="text-blue-500" size={24} />
                        System Activity Log
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Track and audit all modifications and operations across the dashboard workspace.
                    </p>
                </div>
            </div>

            {/* Filter Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 p-4 mb-6">
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search user, action, resource, details..."
                            className="pl-9 pr-4 py-2 w-full border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-sm"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>

                    {/* Dropdown Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500 font-bold whitespace-nowrap">Action:</span>
                            <select
                                value={actionFilter}
                                onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 px-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="all">All Actions</option>
                                {filterOptions.actions.map(act => (
                                    <option key={act} value={act}>{act}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500 font-bold whitespace-nowrap">Module:</span>
                            <select
                                value={resourceFilter}
                                onChange={(e) => { setResourceFilter(e.target.value); setCurrentPage(1); }}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 px-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="all">All Resources</option>
                                {filterOptions.resources.map(res => (
                                    <option key={res} value={res}>{res}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500 font-bold whitespace-nowrap">User:</span>
                            <select
                                value={userFilter}
                                onChange={(e) => { setUserFilter(e.target.value); setCurrentPage(1); }}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg py-1.5 px-2 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="all">All Users</option>
                                {filterOptions.users.map(usr => (
                                    <option key={usr} value={usr}>{usr}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Reset Button */}
                    {(searchTerm || actionFilter !== 'all' || resourceFilter !== 'all' || userFilter !== 'all') && (
                        <button
                            onClick={handleResetFilters}
                            className="flex items-center justify-center gap-1 px-3 py-2 border border-dashed border-red-300 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors text-xs font-semibold"
                        >
                            <X size={14} /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Content Table / State Views */}
            {loading ? (
                <div className="flex-1 flex justify-center items-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
                </div>
            ) : error ? (
                <div className="flex-1 flex justify-center items-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <p className="text-red-500 font-medium">{error}</p>
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="flex-1 flex flex-col justify-center items-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 text-slate-400">
                    <ClipboardList size={48} className="mb-3 text-slate-300 dark:text-slate-700" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">No activity logs found matching your filters.</p>
                </div>
            ) : (
                <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
                                    <th className="px-6 py-4">Timestamp</th>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Resource / Module</th>
                                    <th className="px-6 py-4">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/55">
                                {paginatedLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors text-slate-700 dark:text-slate-300 text-sm">
                                        <td className="px-6 py-4 font-medium whitespace-nowrap">
                                            <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
                                                <Calendar size={14} />
                                                {formatTimestamp(log.timestamp)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                                            <span className="flex items-center gap-1.5">
                                                <User size={14} className="text-slate-400" />
                                                {log.username}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getActionBadgeClass(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getResourceBadgeClass(log.resource)}`}>
                                                {log.resource}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs max-w-md break-words font-medium text-slate-600 dark:text-slate-400">
                                            {log.details || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/20 text-xs text-slate-500 dark:text-slate-400">
                            <div>
                                Showing <span className="font-bold text-slate-800 dark:text-slate-200">{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {Math.min(currentPage * itemsPerPage, filteredLogs.length)}
                                </span>{' '}
                                of <span className="font-bold text-slate-800 dark:text-slate-200">{filteredLogs.length}</span> logs
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-800 dark:text-slate-200"
                                >
                                    Previous
                                </button>
                                <span className="font-semibold">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-950 font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-800 dark:text-slate-200"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ActivityLog;
