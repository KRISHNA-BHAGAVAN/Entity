import { Upload, Database } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export default function SideMenu() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: Upload, path: "/uploads", label: "Uploads" },
    { icon: Database, path: "/schema-discovery", label: "Schema Discovery" }
  ];

  return (
    <div className="bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col gap-2 h-screen w-fit p-1 fixed top-10 left-0 z-10">
      {menuItems.map(({ icon: Icon, path, label }) => (
        <button
          key={path}
          onClick={() => navigate(path + location.search)}
          className={`p-2 rounded-lg transition-colors ${
            location.pathname === path
              ? "bg-blue-100 text-blue-600"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
          }`}
          title={label}
        >
          <Icon className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}