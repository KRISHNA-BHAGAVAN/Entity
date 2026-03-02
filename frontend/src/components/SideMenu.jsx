import { useState } from "react";
import { Upload, Database, FileText, Trophy } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export default function SideMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  const EventMenuItems = [
    { icon: Upload, path: "/uploads", label: "Uploads" },
    { icon: Database, path: "/schema-discovery", label: "Schema Discovery" },
  ];

  const DashboardMenuItems = [
    { icon: Trophy, path: "/", label: "Dashboard" },
    { icon: FileText, path: "/reports", label: "Reports" },
  ];

  const isDashboardPath = DashboardMenuItems.some(
    (item) => item.path === location.pathname
  );

  const menuItems = isDashboardPath ? DashboardMenuItems : EventMenuItems;

  return (
    <div
      className={`bg-white border-r border-slate-200 flex flex-col gap-1 p-1.5 h-screen overflow-hidden shrink-0 relative z-10 transition-[width] duration-280 ease-in-out ${isExpanded ? "w-[200px]" : "w-[48px]"
        }`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Subtle hover-indicator edge line */}
      <div
        className={`absolute top-0 right-0 w-[2px] h-full transition-colors duration-300 rounded-[1px] ${isExpanded ? "bg-linear-to-b from-blue-500 to-indigo-500" : "bg-transparent"
          }`}
      />

      {menuItems.map(({ icon: Icon, path, label }, index) => {
        const isActive = location.pathname === path;

        return (
          <button
            key={path}
            onClick={() =>
              navigate(isDashboardPath ? path : path + location.search)
            }
            className={`group flex items-center gap-3 p-2.5 rounded-md cursor-pointer w-full text-left whitespace-nowrap overflow-hidden transition-all duration-200 relative ${isActive
                ? "bg-blue-50 text-blue-500"
                : "bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            title={!isExpanded ? label : undefined}
          >
            {/* Active indicator dot */}
            {isActive && isExpanded && (
              <div
                className="absolute left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-full rounded-sm bg-blue-500"
              />
            )}

            <Icon
              className={`w-5 h-5 shrink-0 transition-[margin] duration-200
                }`}
            />

            <span
              className={`text-[13.5px] tracking-[-0.01em] transition-all duration-200 ${isActive ? "font-semibold" : "font-medium"
                } ${isExpanded
                  ? "opacity-100 translate-x-0 pointer-events-auto"
                  : "opacity-0 -translate-x-2 pointer-events-none"
                }`}
              style={{ transitionDelay: `${index * 40}ms` }}
            >
              {label}
            </span>
          </button>
        );
      })}

      {/* Expand hint — subtle chevron indicator */}
      {/* <div className="mt-auto flex justify-center py-2 opacity-35 transition-opacity duration-200">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={`transition-transform duration-280 ease-in-out ${isExpanded ? "rotate-180" : "rotate-0"
            }`}
        >
          <path
            d="M6 3L11 8L6 13"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div> */}
    </div>
  );
}