import React, { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from './context/Auth.jsx';
import { TemplatesProvider } from './context/Templates.jsx';
import Sidebar from './components/Sidebar.jsx';
import Login from './pages/Login.jsx';
import Gallery from './pages/Gallery.jsx';
import NewTemplate from './pages/NewTemplate.jsx';
import Edit from './pages/Edit.jsx';
import Generate from './pages/Generate.jsx';
import Team from './pages/Team.jsx';
import History from './pages/History.jsx';
import ChangeRequests from './pages/ChangeRequests.jsx';

export default function App() {
  const { user } = useAuth();
  if (user === undefined) return <p className="loading">Loading…</p>;
  if (!user) return <Login />;
  return (
    <TemplatesProvider>
      <Shell isAdmin={user.role === 'admin'} />
    </TemplatesProvider>
  );
}

function Shell({ isAdmin }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const [pendingTick, setPendingTick] = useState(0); // bumps the sidebar badge after a decision

  const adminOnly = (el) => (isAdmin ? el : <p className="error">Only admins can do this.</p>);

  return (
    <div className="shell">
      <button className="burger" onClick={() => setOpen((o) => !o)} aria-label="Menu">☰</button>
      <Sidebar open={open} refreshKey={pendingTick} />
      <main className="content">
        <Routes>
          <Route path="/" element={<Gallery isAdmin={isAdmin} />} />
          <Route path="/new" element={adminOnly(<NewTemplate />)} />
          <Route path="/t/:id" element={<Generate isAdmin={isAdmin} />} />
          <Route path="/t/:id/edit" element={adminOnly(<Edit />)} />
          <Route path="/history" element={<History isAdmin={isAdmin} />} />
          <Route path="/requests" element={<ChangeRequests isAdmin={isAdmin} onChanged={() => setPendingTick((n) => n + 1)} />} />
          <Route path="/team" element={adminOnly(<Team />)} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}
