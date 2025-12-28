import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, LayoutTemplate, Wand2, Database } from "lucide-react";
import TemplateManager from "../components/TemplateManager";
import Generator from "../components/Generator";
import SchemaDiscovery from "../components/SchemaDiscovery";
import { preloadEventMarkdown } from "../services/markdownCache";

const EventTab = {
  TEMPLATES: 'TEMPLATES',
  GENERATE: 'GENERATE',
  SCHEMA: 'SCHEMA',
};

const EventDetail = ({ events }) => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(EventTab.TEMPLATES);
  
  const activeEvent = events.find(e => e.id === eventId);

  useEffect(() => {
    if (activeEvent) {
      preloadEventMarkdown(activeEvent.id).catch(err => {
        console.error('Background markdown preload failed:', err);
      });
    }
  }, [activeEvent]);

  if (!activeEvent) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center py-12">
          <p className="text-slate-500">Event not found</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Go back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="  mx-auto px-4 sm:px-6 py-6">
      <button
        onClick={() => navigate('/')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 hover:cursor-pointer"
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

          <button
            onClick={() => setActiveTab(EventTab.SCHEMA)}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition ${
              activeTab === EventTab.SCHEMA
                ? "text-green-600 bg-green-50"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Database size={18} />
            Schema
          </button>
        </div>

        {/* Content */}
        <div className=" bg-slate-50 min-h-[500px] border">
          {activeTab === EventTab.TEMPLATES ? (
            <TemplateManager event={activeEvent} />
          ) : activeTab === EventTab.GENERATE ? (
            <Generator event={activeEvent} />
          ) : (
            <SchemaDiscovery event={activeEvent} />
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDetail;