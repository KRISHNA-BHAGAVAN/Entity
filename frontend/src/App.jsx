import { useState, useEffect } from "react";
import { ViewState, EventTab } from "./types";
import { supabase } from "./services/supabaseClient";
import { Auth } from "./components/Auth";
import EventList from "./components/EventList";
import TemplateManager from "./components/TemplateManager";
import Generator from "./components/Generator";
import EntityLogo from "./components/logo";

import {
  ChevronLeft,
  LayoutTemplate,
  Wand2,
  UserCircle,
  LogOut,
  Loader2,
} from "lucide-react";

const App = () => {
  const [session, setSession] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [view, setView] = useState(ViewState.DASHBOARD);
  const [activeEvent, setActiveEvent] = useState(null);
  const [activeTab, setActiveTab] = useState(EventTab.TEMPLATES);
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
        setActiveEvent(null);
        setView(ViewState.DASHBOARD);
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
        .select("*")
        .order("created_at", { ascending: false });

      setEvents(
        data.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          createdAt: new Date(e.created_at).getTime(),
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
    setActiveEvent(event);
    setView(ViewState.EVENT_DETAIL);
    setActiveTab(EventTab.TEMPLATES);
  };

  const goHome = () => {
    setView(ViewState.DASHBOARD);
    setActiveEvent(null);
    refreshEvents();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    goHome();
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
            <EntityLogo size={26} />
            <span className="text-xl font-semibold tracking-tight text-slate-900">
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
              className="p-2 rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        {view === ViewState.DASHBOARD && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <EventList
              events={events}
              isLoading={loadingEvents}
              onSelectEvent={handleSelectEvent}
              onRefresh={refreshEvents}
            />
          </div>
        )}

        {view === ViewState.EVENT_DETAIL && activeEvent && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <button
              onClick={goHome}
              className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
            >
              <ChevronLeft size={16} />
              Dashboard
            </button>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-slate-200">
                <button
                  onClick={() => setActiveTab(EventTab.TEMPLATES)}
                  className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition ${
                    activeTab === EventTab.TEMPLATES
                      ? "text-blue-600 bg-blue-50"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <LayoutTemplate size={18} />
                  Templates
                </button>

                <button
                  onClick={() => setActiveTab(EventTab.GENERATE)}
                  className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition ${
                    activeTab === EventTab.GENERATE
                      ? "text-indigo-600 bg-indigo-50"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Wand2 size={18} />
                  Generate
                </button>
              </div>

              {/* Content */}
              <div className="p-5 sm:p-6 bg-slate-50 min-h-[500px]">
                {activeTab === EventTab.TEMPLATES ? (
                  <TemplateManager event={activeEvent} />
                ) : (
                  <Generator event={activeEvent} />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;