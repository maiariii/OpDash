import React, { useState, useEffect } from 'react';
import { Target, Plus, Database } from 'lucide-react'; // Added Database icon for Activity column
import { getProjectIndicators, getProjectTasks } from '../api';
import CreateIndicatorModal from './CreateIndicatorModal';

const IndicatorsTab = ({ projectId }) => {
    const [indicators, setIndicators] = useState([]);
    const [activities, setActivities] = useState({}); // Map of activityId -> activityTitle
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        loadData();
    }, [projectId]);

    const loadData = async () => {
        setLoading(true);
        console.log("Loading Indicators Data for Project:", projectId);
        try {
            const [inds, acts] = await Promise.all([
                getProjectIndicators(projectId),
                getProjectTasks(projectId)
            ]);
            console.log("Loaded Indicators:", inds);
            console.log("Loaded Activities:", acts);
            setIndicators(inds);

            // Create a lookup map for activities
            const actMap = {};
            acts.forEach(a => actMap[a.id] = a.title);
            setActivities(actMap);
        } catch (err) {
            console.error("Failed to load indicators data", err);
            setError("Failed to load indicators");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Target size={18} className="text-blue-600" />
                        Project Indicators
                    </h3>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <Plus size={16} />
                        Add Indicator
                    </button>
                </div>

                <div className="p-0">
                    {error && (
                        <div className="m-6 mb-0 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="text-center py-12 text-slate-500">Loading indicators...</div>
                    ) : indicators.length === 0 ? (
                        <div className="text-center py-16 bg-slate-50/50">
                            <Target size={48} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-500 font-medium">No indicators added yet.</p>
                            <p className="text-slate-400 text-sm mt-1">Click "Add Indicator" to get started.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 font-bold">Activity</th>
                                        <th className="px-6 py-4 font-bold">Indicator</th>
                                        <th className="px-6 py-4 font-bold text-right">Target</th>
                                        <th className="px-6 py-4 font-bold text-right">Date Added</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {indicators.map((ind) => (
                                        <tr key={ind.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4 font-medium text-slate-600">
                                                {activities[ind.activity_id] ? (
                                                    <span className="flex items-center gap-2">
                                                        <Database size={14} className="text-slate-400" />
                                                        {activities[ind.activity_id]}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic">Unassigned</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-900 font-semibold">
                                                {ind.indicator}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-slate-700">
                                                {Number(ind.target).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-400 text-xs">
                                                {new Date(ind.created_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <CreateIndicatorModal
                    projectId={projectId}
                    onClose={() => setShowModal(false)}
                    onIndicatorCreated={loadData}
                />
            )}
        </div>
    );
};

export default IndicatorsTab;
