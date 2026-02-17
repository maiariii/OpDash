import React, { useState, useEffect } from 'react';
import { createProject, getDivisions, getEmployees } from '../api';
import { X } from 'lucide-react';

const CreateProjectModal = ({ onClose, onProjectCreated }) => {
    const [divisions, setDivisions] = useState([]);
    const [employees, setEmployees] = useState([]);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        division: '',
        lead_personnel: '',
        supervising_officer: '',
        assisting_personnel: [] // Array for multi-select
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        Promise.all([getDivisions(), getEmployees()]).then(([d, e]) => {
            setDivisions(d);
            setEmployees(e);
        });
    }, []);

    const getEmployeesInDivision = () => {
        // Optional: Filter employees by selected division if desired.
        // For now, listing all for flexibility as per prompt implies global selection.
        if (!formData.division) return [];
        // Assuming division stores Name in project, but ID in employee relation. 
        // We need to map Name back to ID or just filter by ID if we stored ID.
        // Current Backend stores Division Name string in Project.
        // Let's match by name for simplicity or just show all.
        const div = divisions.find(d => d.name === formData.division);
        return div ? employees.filter(e => e.division_id === div.id) : employees;
    };

    const availableEmployees = formData.division ? getEmployeesInDivision() : employees;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Convert array to string for assisting_personnel as per current schema text field
            const projectData = {
                ...formData,
                assisting_personnel: formData.assisting_personnel.join(', ')
            };

            const newProject = await createProject(projectData);
            onProjectCreated(newProject);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to create project');
        } finally {
            setLoading(false);
        }
    };

    const handleAssistingChange = (name) => {
        setFormData(prev => {
            const current = prev.assisting_personnel;
            if (current.includes(name)) {
                return { ...prev, assisting_personnel: current.filter(n => n !== name) };
            } else {
                return { ...prev, assisting_personnel: [...current, name] };
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-10">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative my-auto">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-slate-800 mb-6">New Project</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <div className="flex justify-between">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
                            <span className="text-xs text-slate-400">{formData.name.length}/50</span>
                        </div>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            maxLength={50}
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <div className="flex justify-between">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                            <span className="text-xs text-slate-400">{formData.description.length}/100</span>
                        </div>
                        <textarea
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            rows="3"
                            maxLength={100}
                            placeholder="Brief project summary..."
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Division</label>
                        <select
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            value={formData.division}
                            onChange={e => setFormData({ ...formData, division: e.target.value })}
                        >
                            <option value="">Select Division</option>
                            {divisions.map(d => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Lead Personnel</label>
                        <select
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            value={formData.lead_personnel}
                            onChange={e => setFormData({ ...formData, lead_personnel: e.target.value })}
                        >
                            <option value="">Select Lead</option>
                            {availableEmployees.map(e => (
                                <option key={e.id} value={e.name}>{e.name} ({e.position})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Supervising Officer</label>
                        <select
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            value={formData.supervising_officer}
                            onChange={e => setFormData({ ...formData, supervising_officer: e.target.value })}
                        >
                            <option value="">Select Supervisor</option>
                            {availableEmployees.map(e => (
                                <option key={e.id} value={e.name}>{e.name} ({e.position})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Assisting Personnel (Select Multiple)
                        </label>
                        <div className="border border-slate-300 rounded-lg p-3 max-h-40 overflow-y-auto bg-slate-50">
                            {availableEmployees.length === 0 ? (
                                <p className="text-xs text-slate-400">Select a Division first to see employees.</p>
                            ) : availableEmployees.map(e => (
                                <label key={e.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-100 rounded px-1">
                                    <input
                                        type="checkbox"
                                        checked={formData.assisting_personnel.includes(e.name)}
                                        onChange={() => handleAssistingChange(e.name)}
                                        className="rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700">{e.name}</span>
                                    <span className="text-xs text-slate-400">({e.position})</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateProjectModal;
