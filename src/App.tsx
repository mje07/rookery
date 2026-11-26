import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { BookOpen, Bot, Castle, GitBranch, House, Microscope, Puzzle, ScanSearch, Settings as SettingsIcon, type LucideIcon } from 'lucide-react';
import { useSettings } from './lib/settings';
import { db } from './db/db';

const Home = lazy(() => import('./pages/Home'));
const Analysis = lazy(() => import('./pages/Analysis'));
const Review = lazy(() => import('./pages/Review'));
const Play = lazy(() => import('./pages/Play'));
const Puzzles = lazy(() => import('./pages/Puzzles'));
const Lessons = lazy(() => import('./pages/Lessons'));
const Openings = lazy(() => import('./pages/Openings'));
const Settings = lazy(() => import('./pages/Settings'));
const Train = lazy(() => import('./pages/Train'));

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
}
const NAV: { group?: string; items: NavEntry[] }[] = [
  { items: [{ to: '/', label: 'Today', icon: House }] },
  {
    group: 'Learn',
    items: [
      { to: '/review', label: 'Game Review', icon: ScanSearch },
      { to: '/puzzles', label: 'Puzzles', icon: Puzzle },
      { to: '/lessons', label: 'Lessons', icon: BookOpen },
      { to: '/openings', label: 'Openings', icon: GitBranch },
    ],
  },
  {
    group: 'Play',
    items: [
      { to: '/play', label: 'Play Bots', icon: Bot },
      { to: '/analysis', label: 'Analysis', icon: Microscope },
    ],
  },
  { group: 'App', items: [{ to: '/settings', label: 'Settings', icon: SettingsIcon }] },
];

export default function App() {
  const { boardTheme, load } = useSettings();
  const location = useLocation();
  const [due, setDue] = useState(0);
  useEffect(() => {
    void load();
  }, [load]);
  // Refresh the "due openings" badge as the user moves around.
  useEffect(() => {
    void db.repCards.where('due').belowOrEqual(Date.now()).count().then(setDue);
  }, [location.pathname]);

  return (
    <div className={`app board-${boardTheme}`}>
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <span className="brand-mark"><Castle size={18} strokeWidth={2.4} /></span>
          <span className="brand-name">Rookery</span>
        </div>
        {NAV.map((section, i) => (
          <div key={i}>
            {section.group && <div className="nav-group">{section.group}</div>}
            {section.items.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={label}>
                <span className="nav-icon"><Icon size={18} strokeWidth={2} /></span>
                <span className="nav-label">{label}</span>
                {to === '/openings' && due > 0 && <span className="nav-badge">{due}</span>}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="sidebar-foot">Runs offline · Stockfish 19</div>
      </nav>
      <main className="content">
        <Suspense fallback={<div className="page-loading">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/train/:task" element={<Train />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/review" element={<Review />} />
            <Route path="/review/:gameId" element={<Review />} />
            <Route path="/play" element={<Play />} />
            <Route path="/puzzles/*" element={<Puzzles />} />
            <Route path="/lessons" element={<Lessons />} />
            <Route path="/lessons/:lessonId" element={<Lessons />} />
            <Route path="/openings/*" element={<Openings />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
