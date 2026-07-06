import React, { useState, useEffect } from 'react';
import { createProject, getDivisions, getEmployees } from '../api';
import { X } from 'lucide-react';
import { useToast } from './ToastContext';

const CreateProjectModal = ({ onClose, onProjectCreated, divisions: initialDivisions, employees: initialEmployees }) => {
    const { showToast } = useToast();
    const [divisions, setDivisions] = useState(initialDivisions || []);
    const [employees, setEmployees] = useState(initialEmployees || []);

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
        if (!initialDivisions || !initialEmployees || initialDivisions.length === 0 || initialEmployees.length === 0) {
            Promise.all([getDivisions(), getEmployees()]).then(([d, e]) => {
                setDivisions(d);
                setEmployees(e);
            });
        }
    }, [initialDivisions, initialEmployees]);

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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto py-10 animate-fade-in">
            <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col relative my-auto animate-scale-in transition-all mx-4">
                <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-100 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-2.5 h-6 bg-blue-600 rounded-full"></span>
                        New Project
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-6 overflow-y-auto max-h-[calc(85vh-100px)]">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Sub-Card 1: Project Identity */}
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Project Identity</h3>
                                </div>

                                <div>
                                    <div className="flex justify-between">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name <span className="text-red-500">*</span></label>
                                        <span className="text-xs text-slate-400">{formData.name.length}/50</span>
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                                        maxLength={50}
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description <span className="text-red-500">*</span></label>
                                        <span className="text-xs text-slate-400">{formData.description.length}/100</span>
                                    </div>
                                    <textarea
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white text-sm"
                                        rows="4"
                                        maxLength={100}
                                        placeholder="Brief project summary..."
                                        required
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Division <span className="text-red-500">*</span></label>
                                    <select
                                        required
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                                        value={formData.division}
                                        onChange={e => setFormData({ ...formData, division: e.target.value })}
                                    >
                                        <option value="">Select Division</option>
                                        {divisions.map(d => (
                                            <option key={d.id} value={d.name}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                    <label className="block text-xs font-bold text-slate-700 uppercase">Expenditure Framework <span className="text-red-500">*</span></label>
                                    <div className="flex gap-6 mt-1">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="expenditure_framework"
                                                value="PREXC"
                                                checked={formData.expenditure_framework === 'PREXC'}
                                                onChange={e => setFormData({ ...formData, expenditure_framework: e.target.value })}
                                                className="text-blue-600 focus:ring-blue-500 rounded-full"
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
                                                className="text-blue-600 focus:ring-blue-500 rounded-full"
                                            />
                                            <span className="text-sm text-slate-700 font-medium">WFP</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Sub-Card 2: Project Team */}
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Project Team</h3>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-15">
                                        Lead Personnel (Select Multiple) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2.5">
                                        {availableEmployees.length > 0 && (
                                            <input
                                                type="text"
                                                placeholder="Search lead personnel..."
                                                value={leadSearch}
                                                onChange={e => setLeadSearch(e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white font-normal"
                                            />
                                        )}
                                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                                            {availableEmployees.length === 0 ? (
                                                <p className="text-xs text-slate-400">Select a Division first to see employees.</p>
                                            ) : filteredLeads.length === 0 ? (
                                                <p className="text-xs text-slate-400">No matching employees found.</p>
                                            ) : filteredLeads.map(e => {
                                                const isSelected = formData.lead_personnel.includes(e.name);
                                                return (
                                                    <label key={e.id} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer rounded-lg border transition-all ${isSelected ? 'bg-blue-50/80 border-blue-300 text-blue-900 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => handleLeadChange(e.name)}
                                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                                        />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-xs font-semibold truncate">{e.name}</span>
                                                            <span className="text-[10px] text-slate-500 truncate">{e.position}</span>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-15">
                                        Supervising Officer (Select Multiple) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2.5">
                                        {availableEmployees.length > 0 && (
                                            <input
                                                type="text"
                                                placeholder="Search supervising officer..."
                                                value={supervisorSearch}
                                                onChange={e => setSupervisorSearch(e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white font-normal"
                                            />
                                        )}
                                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                                            {availableEmployees.length === 0 ? (
                                                <p className="text-xs text-slate-400">Select a Division first to see employees.</p>
                                            ) : filteredSupervisors.length === 0 ? (
                                                <p className="text-xs text-slate-400">No matching employees found.</p>
                                            ) : filteredSupervisors.map(e => {
                                                const isSelected = formData.supervising_officer.includes(e.name);
                                                return (
                                                    <label key={e.id} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer rounded-lg border transition-all ${isSelected ? 'bg-blue-50/80 border-blue-300 text-blue-900 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => handleSupervisorChange(e.name)}
                                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                                        />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-xs font-semibold truncate">{e.name}</span>
                                                            <span className="text-[10px] text-slate-500 truncate">{e.position}</span>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-15">
                                        Assisting Personnel (Select Multiple) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2.5">
                                        {availableEmployees.length > 0 && (
                                            <input
                                                type="text"
                                                placeholder="Search assisting personnel..."
                                                value={assistingSearch}
                                                onChange={e => setAssistingSearch(e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white font-normal"
                                            />
                                        )}
                                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                                            {availableEmployees.length === 0 ? (
                                                <p className="text-xs text-slate-400">Select a Division first to see employees.</p>
                                            ) : filteredAssisting.length === 0 ? (
                                                <p className="text-xs text-slate-400">No matching employees found.</p>
                                            ) : filteredAssisting.map(e => {
                                                const isSelected = formData.assisting_personnel.includes(e.name);
                                                return (
                                                    <label key={e.id} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer rounded-lg border transition-all ${isSelected ? 'bg-blue-50/80 border-blue-300 text-blue-900 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => handleAssistingChange(e.name)}
                                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                                        />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-xs font-semibold truncate">{e.name}</span>
                                                            <span className="text-[10px] text-slate-500 truncate">{e.position}</span>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sub-Card 3: Financials & Targets */}
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-20c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z" /></svg>
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Financials & Targets</h3>
                                </div>

                                {/* Source of Funds Section */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Source of Fund <span className="text-red-500">*</span></label>
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
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{selectedFundingSource} Allocation (₱)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                required
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                                                placeholder="0.00"
                                                value={allocationAmount}
                                                onChange={e => setAllocationAmount(e.target.value)}
                                            />
                                        </div>
                                    )}
                                    {selectedFundingSource && (
                                        <div className="text-right text-xs font-bold text-slate-700 border-t border-slate-200 pt-2">
                                            Total Budget: ₱{(Number(allocationAmount) || 0).toLocaleString()}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                        Basecamp Target (Select Multiple) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="border border-slate-200 rounded-xl p-3 max-h-56 overflow-y-auto bg-slate-50 space-y-2 pr-1">
                                        {basecampOptions.map((option, idx) => {
                                            const isSelected = selectedBasecamp.includes(option);
                                            return (
                                                <label key={idx} className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer rounded-lg border transition-all ${isSelected ? 'bg-blue-50/80 border-blue-300 text-blue-900 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleBasecampChange(option)}
                                                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 flex-shrink-0"
                                                    />
                                                    <span className="text-xs font-medium leading-snug">{option}</span>
                                                </label>
                                            );
                                        })}
                                        {(() => {
                                            const isCustomSelected = selectedBasecamp.some(opt => !basecampOptions.includes(opt));
                                            return (
                                                <>
                                                    <label className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer rounded-lg border transition-all ${isCustomSelected ? 'bg-blue-50/80 border-blue-300 text-blue-900 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isCustomSelected}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedBasecamp([...selectedBasecamp, "Others: "]);
                                                                } else {
                                                                    setSelectedBasecamp(selectedBasecamp.filter(opt => basecampOptions.includes(opt)));
                                                                }
                                                            }}
                                                            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 flex-shrink-0"
                                                        />
                                                        <span className="text-xs font-semibold leading-snug">Others</span>
                                                    </label>
                                                    {isCustomSelected && (
                                                        <input
                                                            type="text"
                                                            className="w-full mt-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
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
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    <div className="flex justify-end gap-3 p-4 bg-white border-t border-slate-100 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 transition-colors text-sm shadow-sm"
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
