import React, { useState, useEffect } from 'react';
import { X, Calendar, Flag, Star } from 'lucide-react';
import { createMilestone, updateMilestone } from '../api';

const MilestoneModal = ({ projectId, milestone, onClose, onSaved }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const isEditing = !!milestone;

    useEffect(() => {
        if (milestone) {
            setTitle(milestone.title);
            setDescription(milestone.description || '');
            // Format date to YYYY-MM-DD for input
            if (milestone.target_date) {
                const d = new Date(milestone.target_date);
                setTargetDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
            } else {
                setTargetDate('');
            }
            setNotes(milestone.notes || '');
        }
    }, [milestone]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        // Validation
        if (title.length > 50) {
            setError("Title cannot exceed 50 characters.");
            setIsLoading(false);
            return;
        }
        if (description.length > 100) {
            setError("Description cannot exceed 100 characters.");
            setIsLoading(false);
            return;
        }

        try {
            const data = {
                title,
                description,
                target_date: targetDate,
                notes
            };

            if (isEditing) {
                await updateMilestone(milestone.id, data);
            } else {
                await createMilestone({
                    project_id: projectId,
                    ...data
                });
            }
            onSaved();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Flag size={18} className="text-blue-600" />
                        {isEditing ? 'Edit Milestone' : 'Add Milestone'}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                            <span className="font-bold">Error:</span> {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Milestone Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            maxLength={50}
                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g., Phase 1 Completion"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <div className="flex justify-end mt-1">
                            <span className={`text-xs ${title.length > 50 ? 'text-red-500' : 'text-slate-400'}`}>
                                {title.length}/50
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Description
                        </label>
                        <textarea
                            rows="3"
                            maxLength={100}
                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            placeholder="Brief description of the milestone..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        <div className="flex justify-end mt-1">
                            <span className={`text-xs ${description.length > 100 ? 'text-red-500' : 'text-slate-400'}`}>
                                {description.length}/100
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Target Date
                            </label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input
                                    type="date"
                                    required
                                    className="w-full border border-slate-300 rounded-lg pl-9 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={targetDate}
                                    onChange={(e) => setTargetDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>



                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Notes
                        </label>
                        <textarea
                            rows="2"
                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            placeholder="Optional notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Saving...' : (isEditing ? 'Update Milestone' : 'Create Milestone')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MilestoneModal;
