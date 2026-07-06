import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown, LayoutDashboard, Users, FolderKanban, Target, Sun, Moon, Activity } from 'lucide-react';
import { getDivisions } from '../api';

const Layout = () => {
    const [divisions, setDivisions] = useState([]);
    const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);
    const [user, setUser] = useState(null);
    const [theme, setTheme] = useState(localStorage.getItem('opdash_theme') || 'light');
    const location = useLocation();

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('opdash_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const [activeHash, setActiveHash] = useState('#overview');
    const navigate = useNavigate();

    // Helper to determine if a route is active
    const isActive = (path) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    const handleAnchorClick = (e, hash) => {
        e.preventDefault();
        setActiveHash(hash);
        if (location.pathname !== '/') {
            navigate('/' + hash);
        } else {
            const element = document.querySelector(hash);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
                window.history.pushState(null, '', hash);
            }
        }
    };

    useEffect(() => {
        getDivisions().then(setDivisions).catch(console.error);
        const storedUser = localStorage.getItem('opdash_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    useEffect(() => {
        if (location.pathname !== '/') return;

        const handleScroll = () => {
            const sections = ['#overview', '#distributionGraph', '#distributionDetails', '#distributionPanel', '#updates'];
            let currentActive = '#overview';
            
            for (const section of sections) {
                const el = document.querySelector(section);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    // If the section is scrolled into view (top is near/above top of screen)
                    if (rect.top <= 200) {
                        currentActive = section;
                    }
                }
            }
            setActiveHash(currentActive);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        // Also check if initial URL has hash
        if (window.location.hash) {
            const hash = window.location.hash;
            setActiveHash(hash);
            setTimeout(() => {
                const el = document.querySelector(hash);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 300);
        }

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [location.pathname]);

    const getTopbarDetails = () => {
        const path = location.pathname;
        const search = location.search;
        const hrEyebrow = "DEPARTMENT OF EDUCATION | HUMAN RESOURCE AND ORGANIZATIONAL DEVELOPMENT AND INFRASTRUCTURE";

        if (path === '/') {
            return {
                eyebrow: hrEyebrow,
                title: (
                    <>
                        <span className="text-white">Executive Activity </span>
                        <span style={{ color: 'var(--gold)' }}>& Budget Status</span>
                    </>
                ),
                note: "One-page executive view: activity status, division performance, budget utilization, stale updates, risks, and action priorities."
            };
        }

        if (path === '/employees') {
            return {
                eyebrow: hrEyebrow,
                title: (
                    <>
                        <span className="text-white">Authorized Personnel </span>
                        <span style={{ color: 'var(--gold)' }}>Registry</span>
                    </>
                ),
                note: "Monitors agency headcount, employee designations, division distribution, and staffing details for compliance and resource planning."
            };
        }

        if (path.startsWith('/projects/')) {
            return {
                eyebrow: hrEyebrow,
                title: (
                    <>
                        <span className="text-white">Project Activity </span>
                        <span style={{ color: 'var(--gold)' }}>& Financial Ledger</span>
                    </>
                ),
                note: "In-depth tracking of activities, task assignments, financial status, and milestone completion progress for the selected project."
            };
        }

        if (path === '/projects') {
            const params = new URLSearchParams(search);
            const division = params.get('division');
            if (division) {
                const cleanDivision = division.toLowerCase().endsWith('division') ? division : `${division} Division`;
                return {
                    eyebrow: hrEyebrow,
                    title: (
                        <>
                            <span className="text-white">{cleanDivision} </span>
                            <span style={{ color: 'var(--gold)' }}>Projects Dashboard</span>
                        </>
                    ),
                    note: `Tracks project implementation, milestones, key activities, and division-specific deliverables for the ${cleanDivision}.`
                };
            }
            return {
                eyebrow: hrEyebrow,
                title: (
                    <>
                        <span className="text-white">Projects Portfolio </span>
                        <span style={{ color: 'var(--gold)' }}>Dashboard</span>
                    </>
                ),
                note: "Tracks project implementation, milestones, key activities, and division-specific deliverables to support operational alignment."
            };
        }

        if (path === '/basecamp-targets') {
            return {
                eyebrow: hrEyebrow,
                title: (
                    <>
                        <span className="text-white">Basecamp Targets </span>
                        <span style={{ color: 'var(--gold)' }}>Scorecard</span>
                    </>
                ),
                note: "Tracks targets, output performance indicators, target timelines, and accomplishments to ensure compliance with organization goals."
            };
        }

        if (path === '/activity-log') {
            return {
                eyebrow: hrEyebrow,
                title: (
                    <>
                        <span className="text-white">Operations </span>
                        <span style={{ color: 'var(--gold)' }}>Activity Registry</span>
                    </>
                ),
                note: "Real-time log of data modifications, project updates, and user activities for audit trail and compliance verification."
            };
        }

        return {
            eyebrow: hrEyebrow,
            title: (
                <>
                    <span className="text-white">System </span>
                    <span style={{ color: 'var(--gold)' }}>Resources</span>
                </>
            ),
            note: "InsightED Resource tracking and dashboard system."
        };
    };

    const { eyebrow: topbarEyebrow, title: topbarTitle, note: topbarNote } = getTopbarDetails();

    return (
        <div className="app-container">
            {/* Sidebar (Desktop left sidebar / Mobile bottom nav) */}
            <aside className="sidebar">
                {/* Brand Logo Card */}
                <div className="brand">
                    <img src="/opdash/insighted_logo_full.png" alt="InsightED Logo" className="logo-img logo-full" />
                    <img src="/opdash/insighted_logo_collapsed.png" alt="InsightED Logo" className="logo-img logo-collapsed" />
                </div>

                {/* Navigation Menu */}
                <nav className="nav">
                    {/* Overview Tab */}
                    <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
                        <LayoutDashboard size={18} className="nav-icon" />
                        Overview
                    </Link>

                    {/* Authorized Personnel Tab */}
                    <Link to="/employees" className={location.pathname === '/employees' ? 'active' : ''}>
                        <Users size={18} className="nav-icon" />
                        Authorized Personnel
                    </Link>

                    <div className="flex flex-col w-full">
                        <Link 
                            to="/projects" 
                            className={location.pathname.startsWith('/projects') ? 'active' : ''}
                            onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                        >
                            <FolderKanban size={18} className="nav-icon" />
                            Projects
                        </Link>
                        {isProjectsExpanded && (
                            <div className="projects-sub-menu">
                                {divisions.map(div => {
                                    const isActiveSub = location.search.includes(`division=${encodeURIComponent(div.name)}`);
                                    return (
                                        <Link
                                            key={div.id}
                                            to={`/projects?division=${encodeURIComponent(div.name)}`}
                                            className={`sub-item ${isActiveSub ? 'active-sub' : ''}`}
                                            title={div.name}
                                        >
                                            {div.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Basecamp Targets Tab */}
                    <Link to="/basecamp-targets" className={location.pathname === '/basecamp-targets' ? 'active' : ''}>
                        <Target size={18} className="nav-icon" />
                        Basecamp Targets
                    </Link>
                </nav>

                {/* Theme Toggle — visible in both collapsed and expanded states */}
                <div className="sidebar-theme-toggle-container mt-auto">
                    <button
                        onClick={toggleTheme}
                        className="sidebar-theme-btn"
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        style={{ background: 'none', cursor: 'pointer' }}
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        <span className="sidebar-theme-text">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                </div>

                {/* User Profile and Log Out — desktop sidebar only */}
                {user && (
                    <div className="sidebar-user-section pt-4 border-t border-white/10 flex flex-col gap-3">
                        <div className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                            <div className="w-8 h-8 rounded-full bg-red-100 text-red-650 flex items-center justify-center font-bold text-sm">
                                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white truncate">{user.email}</p>
                                <p className="text-[10px] text-slate-300 font-medium">DepEd Employee</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                localStorage.removeItem('opdash_token');
                                localStorage.removeItem('opdash_user');
                                window.location.href = '/opdash/login';
                            }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-red-300 hover:text-white hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20 w-full text-left"
                        >
                            <LogOut size={18} />
                            <span>Log Out</span>
                        </button>
                    </div>
                )}
            </aside>

            {/* Main Content Area */}
            <main className="main-content">
                <header className="topbar">
                    <div className="page-title">
                        <div className="eyebrow">{topbarEyebrow}</div>
                        <h1>{topbarTitle}</h1>
                        <p>{topbarNote}</p>
                    </div>
                </header>

                {/* Sub-page content */}
                <div className="w-full flex-1">
                    <div className="animate-fade-in w-full h-full">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Layout;
