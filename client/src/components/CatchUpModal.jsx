import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, FileText, Type, PlusCircle } from 'lucide-react';
import { createCatchUp, updateCatchUp } from '../api';

const CatchUpModal = ({ isOpen, onClose, activityId, activityTitle, onCatchUpCreated, existingPlans = [] }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [reason, setReason] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [editingPlanId, setEditingPlanId] = useState(null); // Track if editing

    // Reset form on open
    useEffect(() => {
        if (isOpen) {
            resetForm();
        }
    }, [isOpen]);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setReason('');
        setTargetDate('');
        setError(null);
        setEditingPlanId(null);
    };

    const handleEditClick = (plan) => {
        setEditingPlanId(plan.id);
        setTitle(plan.title);
        setDescription(plan.description || '');
        setReason(plan.reason || '');
        setTargetDate(plan.target_date ? plan.target_date.split('T')[0] : '');
        setError(null);
    };

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!title.trim()) {
            setError('Title is required');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingPlanId) {
                await updateCatchUp(editingPlanId, {
                    title,
                    description,
                    reason,
                    target_date: targetDate
                });
            } else {
                await createCatchUp({
                    activity_id: activityId,
                    title,
                    description,
                    reason,
                    target_date: targetDate
                });
            }

            onCatchUpCreated();

            // If editing, exit edit mode but maybe keep modal open to show list?
            // Requirement implies managing multiple.
            // Let's reset form to "Add New" state after success.
            resetForm();

        } catch (err) {
            console.error("Failed to save catch-up activity", err);
            setError(err.response?.data?.error || 'Failed to save catch-up activity');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">
                            Manage Catch-up Plans
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">For: {activityTitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Existing Plans List */}
                    {existingPlans.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 text-center tracking-wider">Existing Plans</h3>
                            <div className="space-y-3">
                                {existingPlans.map((plan, idx) => (
                                    <div key={plan.id || idx} className={`bg-slate-50 border rounded-lg p-3 transition-colors ${editingPlanId === plan.id ? 'border-blue-300 ring-2 ring-blue-100 bg-blue-50' : 'border-slate-200'}`}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-semibold text-sm text-slate-700">{plan.title}</span>
                                            <div className="flex items-center gap-2">
                                                {plan.target_date && (
                                                    <span className="text-xs font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">
                                                        {new Date(plan.target_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => handleEditClick(plan)}
                                                    className="text-xs text-blue-600 hover:underline font-medium"
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        </div>
                                        {plan.description && <p className="text-xs text-slate-500 mb-1">{plan.description}</p>}
                                        {plan.reason && (
                                            <div className="text-xs bg-yellow-50 text-yellow-800 px-2 py-1 rounded mt-2 border border-yellow-100">
                                                <span className="font-bold">Reason for Deferment:</span> {plan.reason}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="border-b border-slate-100 my-6"></div>
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                            <AlertCircle className="text-red-500 mt-0.5" size={18} />
                            <p className="text-sm text-red-600 font-medium">{error}</p>
                        </div>
                    )}

                    <form id="catchup-form" onSubmit={handleSubmit} className="space-y-5">
                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            {editingPlanId ? (
                                <>Edit Plan <button type="button" onClick={resetForm} className="text-xs text-red-500 font-normal hover:underline ml-2">(Cancel Edit)</button></>
                            ) : (
                                <><PlusCircle size={16} className="text-blue-600" /> Add New Plan</>
                            )}
                        </h3>

                        {/* Title */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Type size={16} className="text-slate-400" />
                                    Catch-up Title <span className="text-red-500">*</span>
                                </label>
                                <span className={`text-xs ${title.length >= 50 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                    {title.length}/50
                                </span>
                            </div>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={50}
                                placeholder="e.g., Conduct special session"
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                autoFocus={!editingPlanId}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <FileText size={16} className="text-slate-400" />
                                    Description
                                </label>
                                <span className={`text-xs ${description.length >= 100 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                    {description.length}/100
                                </span>
                            </div>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                maxLength={100}
                                placeholder="Details about this catch-up activity..."
                                rows={2}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 resize-none"
                            />
                        </div>

                        {/* Reason for Deferment */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <AlertCircle size={16} className="text-slate-400" />
                                    Reason for Deferment
                                </label>
                                <span className={`text-xs ${reason.length >= 50 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                    {reason.length}/50
                                </span>
                            </div>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                maxLength={50}
                                placeholder="Why was the original activity deferred?"
                                rows={2}
                                className="w-full px-3 py-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-all placeholder:text-slate-400 resize-none"
                            />
                        </div>

                        {/* Target Date */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                                <Calendar size={16} className="text-slate-400" />
                                Target Date
                            </label>
                            <input
                                type="date"
                                value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors text-sm"
                        disabled={isSubmitting}
                    >
                        Close
                    </button>
                    <button
                        type="submit"
                        form="catchup-form"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm shadow-blue-200 transition-all flex items-center gap-2 text-sm disabled:opacity-70"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Saving...' : (editingPlanId ? 'Update Plan' : 'Add Plan')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CatchUpModal;
