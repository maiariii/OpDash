import React, { useState, useEffect } from 'react';
import { X, Target, Plus } from 'lucide-react';
import { getProjectTasks, createIndicator } from '../api';

const CreateIndicatorModal = ({ projectId, onClose, onIndicatorCreated }) => {
    const [activities, setActivities] = useState([]);
    const [selectedActivity, setSelectedActivity] = useState('');
    const [indicator, setIndicator] = useState('');
    const [target, setTarget] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingActivities, setFetchingActivities] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Fetch activities when modal opens
        setFetchingActivities(true);
        getProjectTasks(projectId)
            .then(data => {
                // Filter out subtasks if the API returns them flattened? 
                // Based on API review, getProjectTasks returns the main tasks (activities).
                setActivities(data);
            })
            .catch(err => {
                console.error("Failed to fetch activities", err);
                setError("Failed to load activities. Please try again.");
            })
            .finally(() => setFetchingActivities(false));
    }, [projectId]);

    const toProperCase = (str) => {
        return str.replace(
            /\w\S*/g,
            (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!selectedActivity) {
            setError("Please select a parent Activity.");
            return;
        }
        if (!indicator.trim()) {
            setError("Indicator name is required.");
            return;
        }
        if (!target) {
            setError("Target value is required.");
            return;
        }

        setLoading(true);
        try {
            const properCaseIndicator = toProperCase(indicator);
            await createIndicator({
                project_id: projectId,
                activity_id: selectedActivity,
                indicator: properCaseIndicator,
                target: Number(target)
            });
            onIndicatorCreated();
            onClose();
        } catch (err) {
            console.error("Failed to create indicator", err);
            setError("Failed to create indicator. " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Target size={18} className="text-blue-600" />
                        Add New Indicator
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Activity Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Parent Activity
                        </label>
                        {fetchingActivities ? (
                            <div className="text-sm text-slate-400 px-3 py-2 border rounded bg-slate-50">Loading activities...</div>
                        ) : (
                            <select
                                value={selectedActivity}
                                onChange={(e) => setSelectedActivity(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                            >
                                <option value="">Select an Activity...</option>
                                {activities.map(act => (
                                    <option key={act.id} value={act.id}>
                                        {act.id}: {act.title}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Indicator Name */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Indicator Name <span className="text-slate-400 font-normal ml-1">(Max 30 chars)</span>
                        </label>
                        <input
                            type="text"
                            value={indicator}
                            onChange={(e) => {
                                if (e.target.value.length <= 30) setIndicator(e.target.value);
                            }}
                            placeholder="E.g. Schools Visited"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                        <div className="text-right text-xs text-slate-400 mt-1">
                            {indicator.length}/30
                        </div>
                    </div>

                    {/* Target */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Target Value
                        </label>
                        <input
                            type="text"
                            value={target}
                            onChange={(e) => {
                                if (/^\d*$/.test(e.target.value)) setTarget(e.target.value);
                            }}
                            placeholder="0"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !selectedActivity || !indicator || !target}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? 'Adding...' : (
                                <>
                                    <Plus size={16} />
                                    Add Indicator
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateIndicatorModal;
