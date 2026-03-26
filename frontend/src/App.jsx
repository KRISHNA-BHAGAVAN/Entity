// App.jsx
import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { supabase } from "./services/supabaseClient";
import { ToastProvider } from "./contexts/ToastContext";
import { Auth } from "./components/Auth";
import Dashboard from "./pages/Dashboard";
import Uploads from "./pages/Uploads";
import SchemaDiscovery from "./pages/SchemaDiscovery";
import BYOKSettings from "./pages/BYOKSettings";
import BYODCallback from "./pages/BYODCallback";
import AgentChat from "./pages/AgentChat";
// import EventDetail from "./pages/EventDetail";
import EntityLogo from "./components/logo";
import Reports from "./pages/Reports";
import SideMenu from "./components/SideMenu";

import {
  UserCircle,
  LogOut,
  Loader2,
  ChevronDown,
  Key,
} from "lucide-react";

const App = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  /* ---------------------------
     Session Init
  ---------------------------- */
  useEffect(() => {
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setEvents([]);
        navigate('/');
      }
      else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkSession = async () => {
    setIsLoadingSession(true);
    try {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
    } finally {
      setIsLoadingSession(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown && !event.target.closest('.profile-dropdown')) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileDropdown]);


  /* ---------------------------
     Events
  ---------------------------- */
  useEffect(() => {
    if (session) refreshEvents();
  }, [session]);

  const refreshEvents = async () => {
    setLoadingEvents(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*, event_schema")

      if (error || !data) {
        console.error('Failed to fetch events:', error);
        setEvents([]);
        return;
      }

      setEvents(
        data.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          createdAt: new Date(e.created_at).getTime(),
          eventDate: e.event_date,
          event_schema: e.event_schema,
        }))
      );
    } finally {
      setLoadingEvents(false);
    }
  };

  /* ---------------------------
     Navigation
  ---------------------------- */
  const handleSelectEvent = (event) => {
    navigate(`/uploads?eventId=${event.id}`);
  };

  const goHome = () => {
    navigate('/');
    refreshEvents();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    navigate('/');
  };

  /* ---------------------------
     Guards
  ---------------------------- */
  if (isLoadingSession) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <EntityLogo size={48} className="text-blue-800 animate-pulse" />
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  /* ---------------------------
     UI
  ---------------------------- */
  return (
    <ToastProvider>
      <div className="h-screen flex flex-col bg-white overflow-hidden font-sans text-slate-900">
        {/* Fixed Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 flex-none">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div
              onClick={goHome}
              className="flex items-center gap-3 cursor-pointer group transition-all"
            >
              <div className="rounded-md bg-white group-hover:scale-110 transition-transform border border-blue-200 shadow-md shadow-blue-200">
                 <EntityLogo size={30} fill="black" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-slate-900 uppercase">
                  Entity
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest hidden sm:block">
                  Smart Docs System
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="profile-dropdown relative">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all bg-white"
                >
                  <div className="flex items-center gap-2 px-1 text-slate-500">
                    <span className="text-xs font-semibold hidden md:block max-w-[160px] truncate">
                      {session.user.email}
                    </span>
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                      <UserCircle size={18} />
                    </div>
                  </div>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showProfileDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/50 z-50 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-2 border-b border-slate-50 mb-1">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logged in as</p>
                       <p className="text-xs font-semibold text-slate-700 truncate">{session.user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigate('/settings/byok');
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      <Key size={16} />
                      API Configuration
                    </button>
                    <hr className="my-1 border-slate-50" />
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Layout Container */}
        <div className="flex flex-1 pt-14 min-h-0 overflow-hidden">
          <SideMenu />

          {/* Scrolling Content Area */}
          <main className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-white custom-scrollbar relative">
            <Routes>
              <Route
                path="/"
                element={
                  <Dashboard
                    events={events}
                    isLoading={loadingEvents}
                    onSelectEvent={handleSelectEvent}
                    onRefresh={refreshEvents}
                  />
                }
              />
              <Route
                path="/reports"
                element={<Reports />}
              />
              <Route
                path="/agent-chat"
                element={<AgentChat />}
              />
              <Route
                path="/uploads"
                element={<Uploads />}
              />
              <Route
                path="/schema-discovery"
                element={<SchemaDiscovery />}
              />
              <Route
                path="/settings/byok"
                element={<BYOKSettings />}
              />
              <Route
                path="/settings/byod/callback"
                element={<BYODCallback />}
              />
            </Routes>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
};

export default App;