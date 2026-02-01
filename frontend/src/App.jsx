// App.jsx
import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./services/supabaseClient";
import { ToastProvider } from "./contexts/ToastContext";
import { Auth } from "./components/Auth";
import Dashboard from "./pages/Dashboard";
import Uploads from "./pages/Uploads";
import SchemaDiscovery from "./pages/SchemaDiscovery";
// import EventDetail from "./pages/EventDetail";
import EntityLogo from "./components/logo";
import PreviewPage from "./pages/PreviewPage";
import SideMenu from "./components/SideMenu";

import {
  UserCircle,
  LogOut,
  Loader2,
} from "lucide-react";

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

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
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
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
        .order("created_at", { ascending: false });

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
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
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
              <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                <UserCircle size={16} />
                <span className="max-w-40 truncate">
                  {session.user.email}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 transition hover:cursor-pointer"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Layout with Sidebar */}
        <div className="flex flex-1">
          {location.pathname !== '/' && <div className="w-12"></div>} {/* Spacer for fixed sidebar */}
          {location.pathname !== '/' && <SideMenu />}
          
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
                path="/uploads" 
                element={<Uploads />} 
              />
              <Route 
                path="/schema-discovery" 
                element={<SchemaDiscovery />} 
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