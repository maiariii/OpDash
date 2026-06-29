import React, { useState, useEffect } from 'react';
import { createProject, getDivisions, getEmployees } from '../api';
import { X } from 'lucide-react';
import { useToast } from './ToastContext';

const CreateProjectModal = ({ onClose, onProjectCreated }) => {
    const { showToast } = useToast();
    const [divisions, setDivisions] = useState([]);
    const [employees, setEmployees] = useState([]);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        division: '',
        lead_personnel: [], // Array for multi-select
        supervising_officer: [], // Array for multi-select
        assisting_personnel: [], // Array for multi-select
        expenditure_framework: ''
    });

    // Financial Optimizations
    const [selectedFundingSource, setSelectedFundingSource] = useState('');
    const [allocationAmount, setAllocationAmount] = useState('');
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

    const [leadSearch, setLeadSearch] = useState('');
    const [assistingSearch, setAssistingSearch] = useState('');
    const [supervisorSearch, setSupervisorSearch] = useState('');

    const filteredLeads = availableEmployees.filter(e =>
        e.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
        (e.position && e.position.toLowerCase().includes(leadSearch.toLowerCase()))
    );

    const filteredAssisting = availableEmployees.filter(e =>
        e.name.toLowerCase().includes(assistingSearch.toLowerCase()) ||
        (e.position && e.position.toLowerCase().includes(assistingSearch.toLowerCase()))
    );

    const filteredSupervisors = availableEmployees.filter(e =>
        e.name.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
        (e.position && e.position.toLowerCase().includes(supervisorSearch.toLowerCase()))
    );

    const handleSupervisorChange = (name) => {
        setFormData(prev => {
            const current = prev.supervising_officer;
            if (current.includes(name)) {
                return { ...prev, supervising_officer: current.filter(n => n !== name) };
            } else {
                return { ...prev, supervising_officer: [...current, name] };
            }
        });
    };

    const handleLeadChange = (name) => {
        setFormData(prev => {
            const current = prev.lead_personnel;
            if (current.includes(name)) {
                return { ...prev, lead_personnel: current.filter(n => n !== name) };
            } else {
                return { ...prev, lead_personnel: [...current, name] };
            }
        });
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

    const basecampOptions = [
        "Career Progression for DepEd Personnel",
        "Mental Health Professionals for Schools",
        "Workforce Plan and Management",
        "HROD Process Excellence",
        "Prioritization Index for Education Facilities Allocation",
        "Prioritization Index for Education Facilities Allocation",
        "Career Opportunities in DepEd for SHS Graduates"
    ];



    const [selectedBasecamp, setSelectedBasecamp] = useState([]);

    const handleBasecampChange = (option) => {
        if (selectedBasecamp.includes(option)) {
            setSelectedBasecamp(selectedBasecamp.filter(o => o !== option));
        } else {
            setSelectedBasecamp([...selectedBasecamp, option]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation Checks to ensure complete detail
        if (!formData.name || !formData.name.trim()) {
            showToast("Project Name is required.", "warning");
            return;
        }
        if (!formData.description || !formData.description.trim()) {
            showToast("Description is required.", "warning");
            return;
        }
        if (!selectedFundingSource) {
            showToast("Source of Fund is required.", "warning");
            return;
        }
        if (allocationAmount === '' || Number(allocationAmount) < 0) {
            showToast("Allocation Amount is required and must be 0 or greater.", "warning");
            return;
        }
        if (!formData.expenditure_framework) {
            showToast("Expenditure Framework is required.", "warning");
            return;
        }
        if (!formData.division) {
            showToast("Division is required.", "warning");
            return;
        }
        if (!formData.lead_personnel || formData.lead_personnel.length === 0) {
            showToast("At least one Lead Personnel must be selected.", "warning");
            return;
        }
        if (!formData.supervising_officer || formData.supervising_officer.length === 0) {
            showToast("At least one Supervising Officer must be selected.", "warning");
            return;
        }
        if (!formData.assisting_personnel || formData.assisting_personnel.length === 0) {
            showToast("At least one Assisting Personnel must be selected.", "warning");
            return;
        }
        if (!selectedBasecamp || selectedBasecamp.length === 0) {
            showToast("At least one Basecamp Target must be selected.", "warning");
            return;
        }

        const customTarget = selectedBasecamp.find(opt => !basecampOptions.includes(opt));
        if (customTarget !== undefined) {
            const specifiedText = customTarget.replace("Others: ", "").trim();
            if (!specifiedText) {
                showToast("Please specify the custom Basecamp target in the 'Others' section.", "warning");
                return;
            }
        }

        setLoading(true);
        try {
            const amount = Number(allocationAmount) || 0;

            const cleanedBasecamp = selectedBasecamp.map(opt => {
                if (!basecampOptions.includes(opt)) {
                    const cleanedVal = opt.replace(/^Others:\s*/i, '').trim();
                    return `Others: ${cleanedVal}`;
                }
                return opt;
            });

            const projectData = {
                ...formData,
                lead_personnel: formData.lead_personnel.join(', '),
                supervising_officer: formData.supervising_officer.join(', '),
                assisting_personnel: formData.assisting_personnel.join(', '),
                basecamp_target: cleanedBasecamp.join(', '),
                source_of_fund: selectedFundingSource,
                sof_allocation: amount,
                total_budget: amount
            };

            const newProject = await createProject(projectData);
            showToast("Project created successfully!", "success");
            onProjectCreated(newProject);
            onClose();
        } catch (error) {
            console.error(error);
            showToast("Failed to create project", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-10 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative my-auto animate-scale-in transition-all">
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
                            <label className="block text-sm font-bold text-slate-700 mb-1">Project Name <span className="text-red-500">*</span></label>
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
                            <label className="block text-sm font-bold text-slate-700 mb-1">Description <span className="text-red-500">*</span></label>
                            <span className="text-xs text-slate-400">{formData.description.length}/100</span>
                        </div>
                        <textarea
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            rows="3"
                            maxLength={100}
                            placeholder="Brief project summary..."
                            required
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    {/* Source of Funds Section */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3 animate-fade-in">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Source of Fund <span className="text-red-500">*</span></label>
                            <select
                                required
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                                value={selectedFundingSource}
                                onChange={e => setSelectedFundingSource(e.target.value)}
                            >
                                <option value="">Select Source of Fund</option>
                                <option value="GAA-PS">GAA-PS</option>
                                <option value="GAA-MOOE">GAA-MOOE</option>
                                <option value="GMS">GMS</option>
                                <option value="APB">APB</option>
                                <option value="HRD">HRD</option>
                                <option value="HRDP">HRDP</option>
                                <option value="Basic Education Inputs Program">Basic Education Inputs Program</option>
                            </select>
                        </div>

                        {selectedFundingSource && (
                            <div className="animate-slide-in">
                                <label className="block text-xs font-medium text-slate-500 mb-1">{selectedFundingSource} Allocation (₱)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    placeholder="0.00"
                                    value={allocationAmount}
                                    onChange={e => setAllocationAmount(e.target.value)}
                                />
                            </div>
                        )}
                        {selectedFundingSource && (
                            <div className="text-right text-xs font-bold text-slate-600 border-t border-slate-200 pt-2">
                                Total Budget: ₱{(Number(allocationAmount) || 0).toLocaleString()}
                            </div>
                        )}
                    </div>

                    {/* Expenditure Framework Section */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                        <label className="block text-sm font-bold text-slate-700">Expenditure Framework <span className="text-red-500">*</span></label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="expenditure_framework"
                                    value="PREXC"
                                    checked={formData.expenditure_framework === 'PREXC'}
                                    onChange={e => setFormData({ ...formData, expenditure_framework: e.target.value })}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700 font-medium">PREXC</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="expenditure_framework"
                                    value="WFP"
                                    checked={formData.expenditure_framework === 'WFP'}
                                    onChange={e => setFormData({ ...formData, expenditure_framework: e.target.value })}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700 font-medium">WFP</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Division <span className="text-red-500">*</span></label>
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
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                            Lead Personnel (Select Multiple) <span className="text-red-500">*</span>
                        </label>
                        <div className="border border-slate-300 rounded-lg p-3 bg-slate-50 space-y-2">
                            {availableEmployees.length > 0 && (
                                <input
                                    type="text"
                                    placeholder="Search lead personnel..."
                                    value={leadSearch}
                                    onChange={e => setLeadSearch(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none bg-white font-normal"
                                />
                            )}
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {availableEmployees.length === 0 ? (
                                    <p className="text-xs text-slate-400">Select a Division first to see employees.</p>
                                ) : filteredLeads.length === 0 ? (
                                    <p className="text-xs text-slate-400">No matching employees found.</p>
                                ) : filteredLeads.map(e => (
                                    <label key={e.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-100 rounded px-1">
                                        <input
                                            type="checkbox"
                                            checked={formData.lead_personnel.includes(e.name)}
                                            onChange={() => handleLeadChange(e.name)}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-slate-700">{e.name}</span>
                                        <span className="text-xs text-slate-400">({e.position})</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                            Supervising Officer (Select Multiple) <span className="text-red-500">*</span>
                        </label>
                        <div className="border border-slate-300 rounded-lg p-3 bg-slate-50 space-y-2">
                            {availableEmployees.length > 0 && (
                                <input
                                    type="text"
                                    placeholder="Search supervising officer..."
                                    value={supervisorSearch}
                                    onChange={e => setSupervisorSearch(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none bg-white font-normal"
                                />
                            )}
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {availableEmployees.length === 0 ? (
                                    <p className="text-xs text-slate-400">Select a Division first to see employees.</p>
                                ) : filteredSupervisors.length === 0 ? (
                                    <p className="text-xs text-slate-400">No matching employees found.</p>
                                ) : filteredSupervisors.map(e => (
                                    <label key={e.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-100 rounded px-1">
                                        <input
                                            type="checkbox"
                                            checked={formData.supervising_officer.includes(e.name)}
                                            onChange={() => handleSupervisorChange(e.name)}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-slate-700">{e.name}</span>
                                        <span className="text-xs text-slate-400">({e.position})</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                            Assisting Personnel (Select Multiple) <span className="text-red-500">*</span>
                        </label>
                        <div className="border border-slate-300 rounded-lg p-3 bg-slate-50 space-y-2">
                            {availableEmployees.length > 0 && (
                                <input
                                    type="text"
                                    placeholder="Search assisting personnel..."
                                    value={assistingSearch}
                                    onChange={e => setAssistingSearch(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none bg-white font-normal"
                                />
                            )}
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {availableEmployees.length === 0 ? (
                                    <p className="text-xs text-slate-400">Select a Division first to see employees.</p>
                                ) : filteredAssisting.length === 0 ? (
                                    <p className="text-xs text-slate-400">No matching employees found.</p>
                                ) : filteredAssisting.map(e => (
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
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                            Basecamp Target (Select Multiple) <span className="text-red-500">*</span>
                        </label>
                        <div className="border border-slate-300 rounded-lg p-3 max-h-40 overflow-y-auto bg-slate-50">
                            {basecampOptions.map((option, idx) => (
                                <label key={idx} className="flex items-start gap-2 py-1 cursor-pointer hover:bg-slate-100 rounded px-1">
                                    <input
                                        type="checkbox"
                                        checked={selectedBasecamp.includes(option)}
                                        onChange={() => handleBasecampChange(option)}
                                        className="mt-1 rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700 leading-snug">{option}</span>
                                </label>
                            ))}
                            <label className="flex items-start gap-2 py-1 cursor-pointer hover:bg-slate-100 rounded px-1">
                                <input
                                    type="checkbox"
                                    checked={selectedBasecamp.some(opt => !basecampOptions.includes(opt))}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            // Add placeholder for custom input
                                            setSelectedBasecamp([...selectedBasecamp, "Others: "]);
                                        } else {
                                            // Remove custom input
                                            setSelectedBasecamp(selectedBasecamp.filter(opt => basecampOptions.includes(opt)));
                                        }
                                    }}
                                    className="mt-1 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700 leading-snug">Others</span>
                            </label>
                            {selectedBasecamp.some(opt => !basecampOptions.includes(opt)) && (
                                <input
                                    type="text"
                                    className="w-full mt-2 px-2 py-1 border border-slate-300 rounded text-sm outline-none focus:border-blue-500"
                                    placeholder="Specify other target..."
                                    value={selectedBasecamp.find(opt => !basecampOptions.includes(opt))?.replace("Others: ", "") || ""}
                                    onChange={(e) => {
                                        const customVal = "Others: " + e.target.value;
                                        setSelectedBasecamp(prev => [
                                            ...prev.filter(opt => basecampOptions.includes(opt)),
                                            customVal
                                        ]);
                                    }}
                                />
                            )}
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
