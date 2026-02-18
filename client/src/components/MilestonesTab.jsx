import React, { useEffect, useState } from 'react';
import { Plus, Flag, Calendar, Trash2, Edit2, ArrowUpDown, ArrowUp, ArrowDown, Star } from 'lucide-react';
import { getProjectMilestones, deleteMilestone } from '../api';
import MilestoneModal from './MilestoneModal';
import clsx from 'clsx';

const MilestoneTable = ({ milestones, onEdit, onDelete, title }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'target_date', direction: 'asc' });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedMilestones = [...milestones].sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle date sorting
        if (sortConfig.key === 'target_date') {
            aValue = aValue ? new Date(aValue).getTime() : 0;
            bValue = bValue ? new Date(bValue).getTime() : 0;
        }
        // Handle sorting for importance (numeric)
        else if (sortConfig.key === 'importance') {
            // Default to 1 if undefined
            aValue = Number(aValue || 1);
            bValue = Number(bValue || 1);
        }
        // Handle string sorting (case-insensitive)
        else if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="ml-1 text-slate-400" />;
        return sortConfig.direction === 'asc' ?
            <ArrowUp size={14} className="ml-1 text-blue-600" /> :
            <ArrowDown size={14} className="ml-1 text-blue-600" />;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'No Date';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    const renderStars = (importance) => {
        const rating = Number(importance || 1);
        let colorClass = "text-slate-400"; // Default 1 star (White/Grey)

        switch (rating) {
            case 2: colorClass = "text-blue-500 fill-blue-500"; break;
            case 3: colorClass = "text-green-500 fill-green-500"; break;
            case 4: colorClass = "text-yellow-400 fill-yellow-400"; break;
            case 5: colorClass = "text-amber-500 fill-amber-500"; break;
            default: colorClass = "text-slate-400"; // 1 Star
        }

        return (
            <div className="flex gap-0.5" title={`Importance: ${rating}/5`}>
                {[...Array(rating)].map((_, i) => (
                    <Star key={i} size={14} className={colorClass} />
                ))}
            </div>
        );
    };

    if (milestones.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 mb-8">
                <p>No {title.toLowerCase()} found.</p>
            </div>
        );
    }

    const getRowClasses = (importance) => {
        const rating = Number(importance || 1);
        switch (rating) {
            case 2: return "bg-blue-50 hover:bg-blue-100";
            case 3: return "bg-green-50 hover:bg-green-100";
            case 4: return "bg-yellow-50 hover:bg-yellow-100";
            case 5: return "bg-amber-50 hover:bg-amber-100";
            default: return "bg-white hover:bg-slate-50"; // 1 Star
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-8">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-semibold text-slate-700">{title}</h3>
            </div>
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-white border-b border-slate-200 text-xs text-slate-500 uppercase font-bold tracking-wider">
                        <th
                            className="p-4 cursor-pointer hover:bg-slate-50 transition-colors w-1/3"
                            onClick={() => handleSort('title')}
                        >
                            <div className="flex items-center">
                                Title {getSortIcon('title')}
                            </div>
                        </th>
                        <th
                            className="p-4 cursor-pointer hover:bg-slate-50 transition-colors w-1/6"
                            onClick={() => handleSort('importance')}
                        >
                            <div className="flex items-center">
                                Importance {getSortIcon('importance')}
                            </div>
                        </th>
                        <th
                            className="p-4 cursor-pointer hover:bg-slate-50 transition-colors w-1/4"
                            onClick={() => handleSort('target_date')}
                        >
                            <div className="flex items-center">
                                Target Date {getSortIcon('target_date')}
                            </div>
                        </th>
                        <th
                            className="p-4 cursor-pointer hover:bg-slate-50 transition-colors w-1/6"
                            onClick={() => handleSort('status')}
                        >
                            <div className="flex items-center">
                                Status {getSortIcon('status')}
                            </div>
                        </th>
                        <th className="p-4 w-24 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {sortedMilestones.map(milestone => (
                        <tr key={milestone.id} className={`${getRowClasses(milestone.importance)} transition-colors group`}>
                            <td className="p-4">
                                <div className="font-semibold text-slate-800">{milestone.title}</div>
                                <div className="text-xs text-slate-400 mt-0.5">{milestone.id}</div>
                            </td>
                            <td className="p-4">
                                {renderStars(milestone.importance)}
                            </td>
                            <td className="p-4">
                                <div className="text-sm text-slate-600 flex items-center gap-2">
                                    <Calendar size={14} className="text-slate-400" />
                                    {formatDate(milestone.target_date)}
                                </div>
                            </td>
                            <td className="p-4">
                                <div className={clsx(
                                    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border",
                                    milestone.status === 'Accomplished' ? "bg-green-50 text-green-700 border-green-200" :
                                        "bg-amber-50 text-amber-700 border-amber-200"
                                )}>
                                    {milestone.status || 'Pending'}
                                </div>
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <button
                                        onClick={() => onEdit(milestone)}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Edit Milestone"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => onDelete(milestone.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Milestone"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const MilestonesTab = ({ projectId }) => {
    const [milestones, setMilestones] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingMilestone, setEditingMilestone] = useState(null);

    const fetchMilestones = () => {
        setIsLoading(true);
        getProjectMilestones(projectId)
            .then(setMilestones)
            .catch(err => console.error("Failed to load milestones", err))
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        if (projectId) fetchMilestones();
    }, [projectId]);

    const handleCreate = () => {
        setEditingMilestone(null);
        setModalOpen(true);
    };

    const handleEdit = (milestone) => {
        setEditingMilestone(milestone);
        setModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this milestone?")) {
            try {
                await deleteMilestone(id);
                fetchMilestones();
            } catch (err) {
                alert("Failed to delete milestone");
            }
        }
    };

    // Split milestones
    // Filtering by exact 'Accomplished' string matching the dropdown. All others are Pending.
    const accomplishedMilestones = milestones.filter(m => m.status === 'Accomplished');
    const pendingMilestones = milestones.filter(m => m.status !== 'Accomplished');

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Flag className="text-blue-600" />
                        Project Milestones
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Track key achievements and projected timelines.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors"
                >
                    <Plus size={18} /> Add Milestone
                </button>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400">Loading milestones...</div>
            ) : milestones.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300 p-12">
                    <Flag size={48} className="mb-4 text-slate-200" />
                    <p className="text-lg font-medium text-slate-600">No milestones yet</p>
                    <p className="text-sm">Create your first milestone to start tracking progress.</p>
                </div>
            ) : (
                <div className="overflow-y-auto pb-12">
                    <MilestoneTable
                        title="Pending Milestones"
                        milestones={pendingMilestones}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />

                    <MilestoneTable
                        title="Accomplished Milestones"
                        milestones={accomplishedMilestones}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                </div>
            )}

            {modalOpen && (
                <MilestoneModal
                    projectId={projectId}
                    milestone={editingMilestone}
                    onClose={() => setModalOpen(false)}
                    onSaved={() => {
                        setModalOpen(false);
                        fetchMilestones();
                    }}
                />
            )}
        </div>
    );
};

export default MilestonesTab;
