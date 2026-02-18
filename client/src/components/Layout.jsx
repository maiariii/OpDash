import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FolderKanban, Menu, ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { getDivisions } from '../api';

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [divisions, setDivisions] = useState([]);
    const [isProjectsOpen, setIsProjectsOpen] = useState(true);
    const location = useLocation();

    useEffect(() => {
        getDivisions().then(setDivisions).catch(console.error);
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row transition-all duration-300">
            {/* Sidebar / Navbar */}
            <aside
                className={`bg-[#002c5f] border-r border-[#001f44] flex-shrink-0 transition-all duration-300 ease-in-out
                ${isSidebarOpen ? 'w-full md:w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden'}
                `}
            >
                <div className="p-5 border-b border-[#003d82] flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-blue-900 shadow-lg shadow-yellow-900/20">
                            <span className="font-black text-xs tracking-tighter">HR</span>
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-base font-bold text-white leading-tight tracking-wide">
                                HRODI
                            </h1>
                            <span className="text-[10px] text-blue-200 font-medium tracking-wider uppercase">
                                Operations Dashboard
                            </span>
                        </div>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-500">
                        <ChevronLeft size={20} />
                    </button>
                </div>
                <nav className="p-4 space-y-1">
                    <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap group ${location.pathname === '/' ? 'bg-[#003d82] text-white' : 'text-slate-300 hover:bg-[#003d82] hover:text-white'}`}>
                        <LayoutDashboard size={20} className={location.pathname === '/' ? 'text-yellow-400' : 'group-hover:text-yellow-400 transition-colors'} />
                        <span className="font-medium">Dashboard</span>
                    </Link>

                    <Link to="/employees" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap group ${location.pathname === '/employees' ? 'bg-[#003d82] text-white' : 'text-slate-300 hover:bg-[#003d82] hover:text-white'}`}>
                        <Users size={20} className={location.pathname === '/employees' ? 'text-yellow-400' : 'group-hover:text-yellow-400 transition-colors'} />
                        <span className="font-medium">Staff Registration</span>
                    </Link>

                    <div>
                        <button
                            onClick={() => setIsProjectsOpen(!isProjectsOpen)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all whitespace-nowrap group ${location.pathname.startsWith('/projects') ? 'bg-[#003d82] text-white' : 'text-slate-300 hover:bg-[#003d82] hover:text-white'}`}
                        >
                            <div className="flex items-center gap-3">
                                <FolderKanban size={20} className={location.pathname.startsWith('/projects') ? 'text-yellow-400' : 'group-hover:text-yellow-400 transition-colors'} />
                                <span className="font-medium">Projects</span>
                            </div>
                            <ChevronDown size={16} className={`transition-transform duration-300 ${isProjectsOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${isProjectsOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                        >
                            <div className="pl-11 pr-2 space-y-1 mt-1">
                                <Link
                                    to="/projects"
                                    className={`block px-3 py-2 text-sm rounded-md transition-colors ${location.pathname === '/projects' && !location.search ? 'text-white bg-blue-900/50' : 'text-slate-400 hover:text-white hover:bg-blue-900/30'}`}
                                >
                                    All Projects
                                </Link>
                                {divisions.map(div => (
                                    <Link
                                        key={div.id}
                                        to={`/projects?division=${encodeURIComponent(div.name)}`}
                                        className={`block px-3 py-2 text-sm rounded-md transition-colors truncate ${location.search.includes(`division=${encodeURIComponent(div.name)}`) ? 'text-yellow-400 font-medium bg-blue-900/50' : 'text-slate-400 hover:text-white hover:bg-blue-900/30'}`}
                                        title={div.name}
                                    >
                                        {div.name}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>

                    <Link to="/basecamp-targets" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap group ${location.pathname === '/basecamp-targets' ? 'bg-[#003d82] text-white' : 'text-slate-300 hover:bg-[#003d82] hover:text-white'}`}>
                        {/* Using Flag icon for Targets/Goals */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={location.pathname === '/basecamp-targets' ? 'text-yellow-400' : 'group-hover:text-yellow-400 transition-colors'}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" /></svg>
                        <span className="font-medium">Basecamp Targets</span>
                    </Link>
                </nav>
            </aside >

            {/* Main Content */}
            < main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen relative flex flex-col" >
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

                {
                    isSidebarOpen && (
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="hidden md:flex absolute top-4 left-[-12px] md:left-0 md:relative mb-4 items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <Menu size={20} className="md:hidden" /> {/* Mobile maybe handled differently */}
                            <div className="hidden md:block absolute -left-16 top-1/2 "></div>
                        </button>
                    )
                }

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
                    <div key={location.pathname} className="animate-fade-in w-full h-full">
                        <Outlet />
                    </div>
                </div>
            </main >
        </div >
    );
};

export default Layout;
