import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { supabase } from "./services/supabaseClient";
import { Auth } from "./components/Auth";
import Dashboard from "./pages/Dashboard";
import EventDetail from "./pages/EventDetail";
import EntityLogo from "./components/logo";

import {
  UserCircle,
  LogOut,
  Loader2,
} from "lucide-react";

const App = () => {
  const navigate = useNavigate();
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
      const { data } = await supabase
        .from("events")
        .select("*, event_schema")
        .order("created_at", { ascending: false });

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
    navigate(`/event/${event.id}`);
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div
            onClick={goHome}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
          <EntityLogo size={35} fill="currentColor" className="text-red-500" />

          <span className="text-2xl font-semibold font-mono tracking-tight">
              Entity
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

      {/* Main */}
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
            path="/event/:eventId" 
            element={<EventDetail events={events} />} 
          />
        </Routes>
      </main>
    </div>
  );
};

export default App;