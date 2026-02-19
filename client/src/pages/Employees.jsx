import React, { useEffect, useState, useMemo } from 'react';
import { getEmployees, createEmployee, updateEmployee, getDivisions, deleteEmployee } from '../api';
import { User, Plus, Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';

const POSITIONS = [
    "Administrative Aide I", "Administrative Aide II", "Administrative Aide III", "Administrative Aide IV", "Administrative Aide V", "Administrative Aide VI",
    "Administrative Assistant I", "Administrative Assistant II", "Administrative Assistant III", "Administrative Assistant V", "Administrative Assistant VI",
    "Administrative Officer I", "Administrative Officer II", "Administrative Officer III", "Administrative Officer IV", "Administrative Officer V",
    "Administrative Support I", "Administrative Support II",
    "Chief Administrative Officer",
    "Chief Health Program Officer",
    "Director II", "Director III", "Director IV",
    "Draftsman II",
    "Electronics and Communications",
    "Engineer II", "Engineer III", "Engineer IV", "Engineer V",
    "Executive Assistant I", "Executive Assistant II", "Executive Assistant III", "Executive Assistant IV", "Executive Assistant V",
    "Messenger/Ground Maintenance/Utility Workers",
    "Project Development Officer I", "Project Development Officer II", "Project Development Officer III", "Project Development Officer IV", "Project Development Officer V",
    "Senior Administrative Assistant I", "Senior Administrative Assistant II", "Senior Administrative Assistant III", "Senior Administrative Assistant V",
    "Skilled Worker/Driver",
    "Statistician I", "Statistician II", "Statistician III",
    "Supervising Administrative Officer",
    "Technical Assistant I", "Technical Assistant II", "Technical Assistant III",
    "Technical Assistant III (Attorney III)", "Technical Assistant III (Engineer II)",
    "Technical Assistant IV",
    "Technical Assistant IV (Architect III)", "Technical Assistant IV (Attorney IV)", "Technical Assistant IV (Engineer III)", "Technical Assistant IV (Medical Officer III)"
].sort();

const Employees = () => {
    const [divisions, setDivisions] = useState([]);
    const [employees, setEmployees] = useState([]);

    // Sort & Filter State
    const [sortConfig, setSortConfig] = useState({ key: 'fullName', direction: 'ascending' });
    const [filters, setFilters] = useState({ fullName: '', position: '', divisionName: '' });

    // Forms
    const [newEmp, setNewEmp] = useState({
        first_name: '',
        middle_name: '',
        last_name: '',
        division_id: '',
        position: ''
    });

    // Edit State for Employee
    const [editingEmp, setEditingEmp] = useState(null);
    const [editEmpForm, setEditEmpForm] = useState({
        first_name: '',
        middle_name: '',
        last_name: '',
        division_id: '',
        position: ''
    });

    const refresh = () => {
        Promise.all([getDivisions(), getEmployees()]).then(([d, e]) => {
            setDivisions(d);
            setEmployees(e);
        });
    };

    useEffect(() => {
        refresh();
    }, []);

    // Derived Data
    const processedEmployees = useMemo(() => {
        let data = employees.map(emp => {
            const divName = divisions.find(d => d.id === emp.division_id)?.name || 'Unknown';
            const fullName = (emp.name || `${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`).trim();
            return { ...emp, fullName, divisionName: divName };
        });

        // Filter
        if (filters.fullName) {
            data = data.filter(item => item.fullName.toLowerCase().includes(filters.fullName.toLowerCase()));
        }
        if (filters.position) {
            data = data.filter(item => item.position.toLowerCase().includes(filters.position.toLowerCase()));
        }
        if (filters.divisionName) {
            data = data.filter(item => item.divisionName.toLowerCase().includes(filters.divisionName.toLowerCase()));
        }

        // Sort
        if (sortConfig.key) {
            data.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }

        return data;
    }, [employees, divisions, filters, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-slate-400" />;
        if (sortConfig.direction === 'ascending') return <ArrowUp size={14} className="text-blue-600" />;
        return <ArrowDown size={14} className="text-blue-600" />;
    };

    const handleAddEmployee = async (e) => {
        e.preventDefault();
        await createEmployee(newEmp);
        setNewEmp({ first_name: '', middle_name: '', last_name: '', division_id: '', position: '' });
        refresh();
    };

    const handleDeleteEmployee = async (id) => {
        if (window.confirm('Are you sure you want to delete this staff member?')) {
            try {
                await deleteEmployee(id);
                refresh();
            } catch (err) {
                console.error("Failed to delete staff member", err);
                alert("Failed to delete staff member");
            }
        }
    };

    const startEditEmployee = (emp) => {
        setEditingEmp(emp.id);
        setEditEmpForm({
            first_name: emp.first_name || '',
            middle_name: emp.middle_name || '',
            last_name: emp.last_name || '',
            division_id: emp.division_id || '',
            position: emp.position || ''
        });
    };

    const handleUpdateEmployee = async (e) => {
        e.preventDefault();
        try {
            await updateEmployee(editingEmp, editEmpForm);
            setEditingEmp(null);
            refresh();
        } catch (err) {
            console.error("Failed to update staff member", err);
            alert("Failed to update staff member");
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            {/* Employees Section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <User size={20} className="text-green-600" /> Staff Registration
                    </h2>
                </div>

                <form onSubmit={handleAddEmployee} className="mb-8 bg-slate-50 p-6 rounded-lg border border-slate-100">
                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Add New Staff</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <input
                            className="px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="First Name"
                            value={newEmp.first_name}
                            onChange={e => setNewEmp({ ...newEmp, first_name: e.target.value })}
                            required
                        />
                        <input
                            className="px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Middle Name"
                            value={newEmp.middle_name}
                            onChange={e => setNewEmp({ ...newEmp, middle_name: e.target.value })}
                        />
                        <input
                            className="px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Last Name"
                            value={newEmp.last_name}
                            onChange={e => setNewEmp({ ...newEmp, last_name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <select
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            value={newEmp.division_id}
                            onChange={e => setNewEmp({ ...newEmp, division_id: e.target.value })}
                            required
                        >
                            <option value="">Select Division</option>
                            {divisions.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                        <select
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            value={newEmp.position}
                            onChange={e => setNewEmp({ ...newEmp, position: e.target.value })}
                            required
                        >
                            <option value="">Select Position</option>
                            {POSITIONS.map(pos => (
                                <option key={pos} value={pos}>{pos}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end">
                        <button className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 font-medium flex items-center gap-2 transition-colors shadow-sm">
                            <Plus size={18} /> Add Staff
                        </button>
                    </div>
                </form>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercasetracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('fullName')}>
                                    <div className="flex items-center gap-2">
                                        Name {getSortIcon('fullName')}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('position')}>
                                    <div className="flex items-center gap-2">
                                        Position {getSortIcon('position')}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('divisionName')}>
                                    <div className="flex items-center gap-2">
                                        Division {getSortIcon('divisionName')}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider text-right">Actions</th>
                            </tr>
                            {/* Filter Row */}
                            <tr className="bg-white border-b border-slate-100">
                                <td className="px-6 py-2">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Filter name..."
                                            value={filters.fullName}
                                            onChange={e => setFilters({ ...filters, fullName: e.target.value })}
                                        />
                                    </div>
                                </td>
                                <td className="px-6 py-2">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Filter position..."
                                            value={filters.position}
                                            onChange={e => setFilters({ ...filters, position: e.target.value })}
                                        />
                                    </div>
                                </td>
                                <td className="px-6 py-2">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Filter division..."
                                            value={filters.divisionName}
                                            onChange={e => setFilters({ ...filters, divisionName: e.target.value })}
                                        />
                                    </div>
                                </td>
                                <td className="px-6 py-2"></td>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {processedEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                                        No staff members found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                processedEmployees.map(emp => (
                                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold ring-2 ring-white">
                                                    {emp.first_name ? emp.first_name.charAt(0) : '?'}
                                                </div>
                                                <span className="font-medium text-slate-900">{emp.fullName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 text-sm">{emp.position}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                {emp.divisionName}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => startEditEmployee(emp)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteEmployee(emp.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Edit Modal (Inline Overlay) */}
                {editingEmp && (
                    <div className="absolute inset-0 bg-white/95 z-10 flex flex-col justify-center items-center p-6 rounded-xl animate-in fade-in duration-200">
                        <div className="w-full max-w-2xl bg-white p-8 rounded-2xl border border-slate-200 shadow-xl">
                            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Edit2 size={20} className="text-blue-600" />
                                Edit Staff Information
                            </h3>
                            <form onSubmit={handleUpdateEmployee} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500 uppercase">First Name</label>
                                        <input
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                            value={editEmpForm.first_name}
                                            onChange={e => setEditEmpForm({ ...editEmpForm, first_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500 uppercase">Middle Name</label>
                                        <input
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                            value={editEmpForm.middle_name}
                                            onChange={e => setEditEmpForm({ ...editEmpForm, middle_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500 uppercase">Last Name</label>
                                        <input
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                            value={editEmpForm.last_name}
                                            onChange={e => setEditEmpForm({ ...editEmpForm, last_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500 uppercase">Division</label>
                                        <select
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                            value={editEmpForm.division_id}
                                            onChange={e => setEditEmpForm({ ...editEmpForm, division_id: e.target.value })}
                                            required
                                        >
                                            <option value="">Select Division</option>
                                            {divisions.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-500 uppercase">Position</label>
                                        <select
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                            value={editEmpForm.position}
                                            onChange={e => setEditEmpForm({ ...editEmpForm, position: e.target.value })}
                                            required
                                        >
                                            <option value="">Select Position</option>
                                            {POSITIONS.map(pos => (
                                                <option key={pos} value={pos}>{pos}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium transition-colors">Save Changes</button>
                                    <button type="button" onClick={() => setEditingEmp(null)} className="px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 font-medium transition-colors">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Employees;
