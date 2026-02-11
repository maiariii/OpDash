import React, { useEffect, useState } from 'react';
import { getEmployees, createEmployee, getDivisions, createDivision, updateDivision, deleteEmployee } from '../api';
import { User, Briefcase, Plus, Edit2, Check, X, Trash2 } from 'lucide-react';

const Employees = () => {
    const [divisions, setDivisions] = useState([]);
    const [employees, setEmployees] = useState([]);

    // Forms
    const [newDivName, setNewDivName] = useState('');
    const [newEmp, setNewEmp] = useState({
        first_name: '',
        middle_name: '',
        last_name: '',
        division_id: '',
        position: ''
    });

    // Edit State
    const [editingDiv, setEditingDiv] = useState(null); // id of div being edited
    const [editDivName, setEditDivName] = useState('');

    const refresh = () => {
        Promise.all([getDivisions(), getEmployees()]).then(([d, e]) => {
            setDivisions(d);
            setEmployees(e);
        });
    };

    useEffect(() => {
        refresh();
    }, []);

    const handleAddDivision = async (e) => {
        e.preventDefault();
        await createDivision({ name: newDivName });
        setNewDivName('');
        refresh();
    };

    const handleUpdateDivision = async (id, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!editDivName.trim()) return;
        await updateDivision(id, { name: editDivName });
        setEditingDiv(null);
        refresh();
    };

    const startEditDivision = (div) => {
        setEditingDiv(div.id);
        setEditDivName(div.name);
    };

    const handleAddEmployee = async (e) => {
        e.preventDefault();
        await createEmployee(newEmp);
        setNewEmp({ first_name: '', middle_name: '', last_name: '', division_id: '', position: '' });
        refresh();
    };

    const handleDeleteEmployee = async (id) => {
        if (window.confirm('Are you sure you want to delete this employee?')) {
            try {
                await deleteEmployee(id);
                refresh();
            } catch (err) {
                console.error("Failed to delete employee", err);
                alert("Failed to delete employee");
            }
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Divisions Section */}
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Briefcase size={20} className="text-blue-600" /> Divisions
                    </h2>

                    <form onSubmit={handleAddDivision} className="flex gap-2 mb-6">
                        <input
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="New Division Name"
                            value={newDivName}
                            onChange={e => setNewDivName(e.target.value)}
                            required
                        />
                        <button className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700">
                            <Plus size={20} />
                        </button>
                    </form>

                    <div className="space-y-2">
                        {divisions.map(div => (
                            <div key={div.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between group">
                                {editingDiv === div.id ? (
                                    <div className="flex flex-1 gap-2">
                                        <input
                                            className="flex-1 px-2 py-1 border border-blue-300 rounded bg-white"
                                            value={editDivName}
                                            onChange={e => setEditDivName(e.target.value)}
                                            autoFocus
                                        />
                                        <button type="button" onClick={(e) => handleUpdateDivision(div.id, e)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                                            <Check size={18} />
                                        </button>
                                        <button type="button" onClick={() => setEditingDiv(null)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                            <X size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="font-medium text-slate-700">{div.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded border">ID: {div.id}</span>
                                            <button
                                                onClick={() => startEditDivision(div)}
                                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-opacity p-1"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Employees Section */}
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <User size={20} className="text-green-600" /> Employees
                    </h2>

                    <form onSubmit={handleAddEmployee} className="space-y-3 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <h3 className="text-sm font-bold text-slate-500 uppercase">Add New Employee</h3>

                        <div className="grid grid-cols-3 gap-2">
                            <input
                                className="px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                                placeholder="First Name"
                                value={newEmp.first_name}
                                onChange={e => setNewEmp({ ...newEmp, first_name: e.target.value })}
                                required
                            />
                            <input
                                className="px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                                placeholder="Middle Name"
                                value={newEmp.middle_name}
                                onChange={e => setNewEmp({ ...newEmp, middle_name: e.target.value })}
                            />
                            <input
                                className="px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                                placeholder="Last Name"
                                value={newEmp.last_name}
                                onChange={e => setNewEmp({ ...newEmp, last_name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <select
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
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
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                                value={newEmp.position}
                                onChange={e => setNewEmp({ ...newEmp, position: e.target.value })}
                                required
                            >
                                <option value="">Select Position</option>
                                <option value="Project Development Officer II">Project Development Officer II</option>
                                <option value="Project Development Officer IV">Project Development Officer IV</option>
                                <option value="Technical Assistant I">Technical Assistant I</option>
                            </select>
                        </div>
                        <button className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-medium">
                            Add Employee
                        </button>
                    </form>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {employees.map(emp => {
                            const divName = divisions.find(d => d.id === emp.division_id)?.name || 'Unknown';
                            // Use virtual name if available (from API), else construct
                            const fullName = emp.name || `${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`;
                            return (
                                <div key={emp.id} className="p-3 border-b border-slate-100 last:border-0 flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-slate-800">{fullName}</p>
                                        <p className="text-xs text-slate-500">{emp.position} • {divName}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold">
                                            {emp.first_name ? emp.first_name.charAt(0) : '?'}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteEmployee(emp.id)}
                                            className="text-slate-400 hover:text-red-500 p-1"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Employees;
