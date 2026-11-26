import { NavLink, Route, Routes } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useSettings } from './lib/settings';

const Home = lazy(() => import('./pages/Home'));
const Analysis = lazy(() => import('./pages/Analysis'));
const Review = lazy(() => import('./pages/Review'));
const Play = lazy(() => import('./pages/Play'));
const Puzzles = lazy(() => import('./pages/Puzzles'));
const Lessons = lazy(() => import('./pages/Lessons'));
const Openings = lazy(() => import('./pages/Openings'));
const Settings = lazy(() => import('./pages/Settings'));

const NAV = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/review', label: 'Game Review', icon: '◎' },
  { to: '/puzzles', label: 'Puzzles', icon: '✦' },
  { to: '/lessons', label: 'Lessons', icon: '❖' },
  { to: '/openings', label: 'Openings', icon: '⌥' },
  { to: '/play', label: 'Play Bots', icon: '♟' },
  { to: '/analysis', label: 'Analysis', icon: '⚲' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function App() {
  const { boardTheme, load } = useSettings();
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className={`app board-${boardTheme}`}>
      <nav className="sidebar">
        <div className="brand">
          <span className="brand-mark">♜</span> Rookery
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="content">
        <Suspense fallback={<div className="page-loading">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
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
