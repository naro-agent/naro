import React, { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Home, BarChart2, TrendingUp, Lightbulb, MessageCircle } from 'lucide-react';

import HomePage from './pages/Home.jsx';
import Consent from './pages/Consent.jsx';
import AreaSelect from './pages/AreaSelect.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Survey from './pages/Survey.jsx';
import PreDiagnosis from './pages/PreDiagnosis.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Diagnosis from './pages/Diagnosis.jsx';
import Simulation from './pages/Simulation.jsx';
import Recommend from './pages/Recommend.jsx';
import Chat from './pages/Chat.jsx';

export const AppContext = createContext(null);

export function useAppContext() {
  return useContext(AppContext);
}

const NAV_ITEMS = [
  { path: '/dashboard', Icon: Home, label: '홈' },
  { path: '/diagnosis', Icon: BarChart2, label: '진단' },
  { path: '/simulation', Icon: TrendingUp, label: '시뮬' },
  { path: '/recommend', Icon: Lightbulb, label: '추천' },
  { path: '/chat', Icon: MessageCircle, label: 'AI상담' },
];

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const hiddenPaths = ['/', '/consent', '/area-select', '/onboarding', '/survey', '/pre-diagnosis'];
  if (hiddenPaths.includes(location.pathname)) return null;

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ path, Icon, label }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            className={`nav-item ${active ? 'active' : ''}`}
            onClick={() => navigate(path)}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.6} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function AppShell() {
  return (
    <div className="app-shell">
      <div className="page-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/consent" element={<Consent />} />
          <Route path="/area-select" element={<AreaSelect />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/survey" element={<Survey />} />
          <Route path="/pre-diagnosis" element={<PreDiagnosis />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/diagnosis" element={<Diagnosis />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/recommend" element={<Recommend />} />
          <Route path="/chat" element={<Chat />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}

export default function App() {
  const [profile, setProfile] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [recommend, setRecommend] = useState(null);
  const [selectedAreas, setSelectedAreas] = useState([]);  // ['finance','health','leisure','relation']
  const [surveyScores, setSurveyScores] = useState(null);  // { finance: 72.5, health: 60, ... }

  return (
    <AppContext.Provider value={{
      profile, setProfile,
      diagnosis, setDiagnosis,
      simulation, setSimulation,
      recommend, setRecommend,
      selectedAreas, setSelectedAreas,
      surveyScores, setSurveyScores,
    }}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AppContext.Provider>
  );
}
