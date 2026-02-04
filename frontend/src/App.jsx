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
// import EventDetail from "./pages/EventDetail";
import EntityLogo from "./components/logo";
import PreviewPage from "./pages/PreviewPage";
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
  }, []);

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
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-slate-700" size={32} />
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
      <div className="min-h-screen flex flex-col bg-slate-50">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b">
          <div className="max-w-10xl px-4 sm:px-6 h-10 flex items-center justify-between">
            <div
              onClick={goHome}
              className="flex items-center gap-3 cursor-pointer select-none"
            >
              <EntityLogo size={25} fill="currentColor" className="text-red-500" />

              <span className="text-lg font-semibold font-mono tracking-tight">
                Smart Documentation System
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="profile-dropdown">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center gap-3"
                >
                  <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                    <UserCircle size={20} />
                  </div>
                  <span className="max-w-40 truncate hover:cursor-pointer">
                    {session.user.email}
                  </span>
                  <ChevronDown size={14} className={`transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showProfileDropdown && (
                  <div className="absolute top-full right-10 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                    <button
                      onClick={() => {
                        navigate('/settings/byok');
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Key size={16} className="text-indigo-600" />
                      API Keys
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Layout with Sidebar */}
        <div className="flex flex-1">
          <SideMenu />

          {/* Main Content */}
          <main className="flex-1">
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
              {/* <Route 
                path="/event/:eventId" 
                element={<EventDetail events={events} />} 
              /> */}
              <Route
                path="/preview"
                element={<PreviewPage />}
              />

            </Routes>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
};

export default App;