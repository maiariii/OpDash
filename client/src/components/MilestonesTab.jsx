import React, { useEffect, useState } from 'react';
import { Plus, Flag, Calendar, Trash2, Edit2, ArrowUpDown, ArrowUp, ArrowDown, Star } from 'lucide-react';
import { getProjectMilestones, deleteMilestone } from '../api';
import MilestoneModal from './MilestoneModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
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
        else if (sortConfig.key === 'progress') {
            aValue = Number(aValue || 0);
            bValue = Number(bValue || 0);
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



    if (milestones.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 mb-8">
                <p>No {title.toLowerCase()} found.</p>
            </div>
        );
    }



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
                            className="p-4 cursor-pointer hover:bg-slate-50 transition-colors w-1/4"
                            onClick={() => handleSort('target_date')}
                        >
                            <div className="flex items-center">
                                Target Date {getSortIcon('target_date')}
                            </div>
                        </th>
                        <th
                            className="p-4 cursor-pointer hover:bg-slate-50 transition-colors w-1/5"
                            onClick={() => handleSort('progress')}
                        >
                            <div className="flex items-center">
                                Progress {getSortIcon('progress')}
                            </div>
                        </th>

                        <th className="p-4 w-24 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {sortedMilestones.map(milestone => (
                        <tr key={milestone.id} className="bg-white hover:bg-slate-50 transition-colors group border-b border-slate-100">
                            <td className="p-4">
                                <div className="font-semibold text-slate-800">{milestone.title}</div>
                                <div className="text-xs text-slate-400 mt-0.5">{milestone.id}</div>
                            </td>
                            <td className="p-4">
                                <div className="text-sm text-slate-600 flex items-center gap-2">
                                    <Calendar size={14} className="text-slate-400" />
                                    {formatDate(milestone.target_date)}
                                </div>
                            </td>
                            <td className="p-4">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-24">
                                        <div
                                            className={clsx("h-full rounded-full",
                                                milestone.progress === 100 ? "bg-green-500" : "bg-blue-500"
                                            )}
                                            style={{ width: `${milestone.progress || 0}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium text-slate-600">{milestone.progress || 0}%</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1 pl-1">
                                    {milestone.accomplished_activities || 0} / {milestone.total_activities || 0} Activities
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
                                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
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

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [milestoneToDelete, setMilestoneToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

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

    const handleDelete = (id) => {
        const milestone = milestones.find(m => m.id === id);
        setMilestoneToDelete(milestone);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!milestoneToDelete) return;
        setIsDeleting(true);
        try {
            await deleteMilestone(milestoneToDelete.id);
            // Refresh list
            fetchMilestones();
            setDeleteModalOpen(false);
            setMilestoneToDelete(null);
        } catch (err) {
            console.error("Failed to delete milestone", err);
            alert("Failed to delete milestone");
        } finally {
            setIsDeleting(false);
        }
    };

    // Split milestones
    // Filtering by progress === 100 for Accomplished. All others are Pending.
    const accomplishedMilestones = milestones.filter(m => m.progress === 100);
    const pendingMilestones = milestones.filter(m => m.progress !== 100);

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

            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Milestone"
                itemName={milestoneToDelete?.title}
                message="Are you sure you want to delete this milestone?"
                isDeleting={isDeleting}
            />
        </div>
    );
};

export default MilestonesTab;
