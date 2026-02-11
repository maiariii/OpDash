import React, { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, FolderKanban, Menu, ChevronLeft } from 'lucide-react';

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row transition-all duration-300">
            {/* Sidebar / Navbar */}
            <aside
                className={`bg-white border-r border-slate-200 flex-shrink-0 transition-all duration-300 ease-in-out
                ${isSidebarOpen ? 'w-full md:w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden'}
                `}
            >
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-slate-800 whitespace-nowrap">OpDash</h1>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-500">
                        <ChevronLeft size={20} />
                    </button>
                </div>
                <nav className="p-4 space-y-1">
                    <Link to="/" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-md transition-colors whitespace-nowrap">
                        <LayoutDashboard size={20} />
                        <span>Dashboard</span>
                    </Link>
                    <Link to="/projects" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-md transition-colors whitespace-nowrap">
                        <FolderKanban size={20} />
                        <span>Projects</span>
                    </Link>
                    <Link to="/employees" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-md transition-colors whitespace-nowrap">
                        <Users size={20} />
                        <span>Employees</span>
                    </Link>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen relative flex flex-col">
                <div className="absolute top-4 left-4 z-10">
                    {!isSidebarOpen && (
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors"
                            title="Show Sidebar"
                        >
                            <Menu size={20} />
                        </button>
                    )}
                    {isSidebarOpen && (
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2 bg-white border border-slate-200 rounded-full p-1 shadow-sm text-slate-400 hover:text-slate-600 z-20"
                            style={{ left: '-12px' }}
                        >
                            {/* This button might be tricky relative to main, let's just put a toggle inside the Sidebar header for closing, and this one for opening, or a common top bar.
                                Actually simpler: Just a button in the top left of MAIN that toggles.
                            */}
                        </button>
                    )}
                </div>

                {/* Toggle Button for Desktop (Visible when open too? Or maybe inside sidebar to close?) 
                    Let's put a toggle button always visible in the top left of main area if we want, or just relying on the one above.
                    Better UX:
                    - Sidebar has a "Collapse" button (ChevronLeft)
                    - Main area has "Expand" button (Menu) when collapsed.
                */}

                {isSidebarOpen && (
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="hidden md:flex absolute top-4 left-[-12px] md:left-0 md:relative mb-4 items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <Menu size={20} className="md:hidden" /> {/* Mobile maybe handled differently */}
                        <div className="hidden md:block absolute -left-16 top-1/2 "></div>
                    </button>
                )}

                {/* Let's redo the toggle button logic cleaner. */}
                {/* Close button inside sidebar (desktop) */}


                <div className="flex items-center gap-4 mb-2">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                <div className="max-w-7xl mx-auto w-full flex-1">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
