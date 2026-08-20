import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import DeveloperSignature from "../pages/WelcomeBanner";

export default function PublicLayout() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true); // Layout desktop
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false); // Drawer mobile
 
  const location = useLocation();

  const todayDate = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",

    month: "long",
    year: "numeric",
  });
  const menuItems = [
    {
      path: "/publik/dashboard",
      label: "Dashboard Utama",
      icon: "fa-house-chimney",
    },
    { path: "/publik/keuangan", label: "Keuangan Warga", icon: "fa-wallet" },
    { path: "/publik/barang", label: "Inventaris Barang", icon: "fa-boxes-stacked" },
    { path: "/publik/warga", label: "Anggota", icon: "fa-users" },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-100 font-sans text-zinc-800 overflow-hidden">
      {/* Style animasi khusus untuk emoji melompat pelan */}
      <style>{`
        @keyframes gentleBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-gentle-bounce {
          display: inline-block;
          animation: gentleBounce 1.8s infinite ease-in-out;
        }
      `}</style>

      {/* TOPBAR KHUSUS MOBILE (Layar Kecil) */}
      <DeveloperSignature />
      <header className="lg:hidden bg-emerald-950 text-white h-14 px-4 flex items-center justify-between z-20 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="p-2 text-emerald-200 hover:text-white rounded-lg focus:outline-none cursor-pointer"
          >
            <i className="fa-solid fa-bars text-xl"></i>
          </button>
          <span className="font-bold text-base tracking-wide flex items-center gap-1.5">
            Portal PKK <span className="animate-gentle-bounce text-sm">😊</span>
          </span>
        </div>

        {/* Shortcut Navigasi Mobile */}
        <nav className="flex items-center gap-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  isActive
                    ? "bg-emerald-800 text-white"
                    : "text-emerald-200 hover:text-white"
                }`}
              >
                <i className={`fa-solid ${item.icon}`}></i>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      {/* OVERLAY BACKDROP MOBILE */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* SIDEBAR RESPONSIVE */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 bg-emerald-950 text-emerald-50 flex flex-col transition-all duration-300 ease-in-out shadow-xl lg:shadow-none
          ${mobileDrawerOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"}
          ${sidebarOpen ? "lg:w-64" : "lg:w-20"}
        `}
      >
        {/* Header Sidebar */}
        <div className="flex items-center justify-between h-16 px-4 bg-emerald-900/40 border-b border-emerald-900/60 shrink-0">
          <div
            className={`flex items-center gap-3 overflow-hidden ${!sidebarOpen && "lg:justify-center lg:w-full"}`}
          >
            <div className="bg-emerald-600 text-white p-2.5 rounded-xl font-bold flex items-center justify-center shrink-0 shadow-sm">
              <i className="fa-solid fa-leaf text-base"></i>
            </div>
            <span
              className={`font-extrabold text-base text-white truncate tracking-wide ${!sidebarOpen && "lg:hidden"}`}
            >
              Portal PKK
            </span>
          </div>

          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="lg:hidden text-emerald-300 hover:text-white p-1 cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* Menu Navigasi Sidebar */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-emerald-800 text-white shadow-xs"
                    : "text-emerald-200 hover:bg-emerald-900/50 hover:text-white"
                }`}
              >
                <i
                  className={`fa-solid ${item.icon} w-5 text-center shrink-0 ${isActive ? "text-emerald-300" : "text-emerald-400"}`}
                ></i>
                <span className={`truncate ${!sidebarOpen && "lg:hidden"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Sidebar Profil Warga */}
        <div className="p-4 border-t border-emerald-900/60 bg-emerald-900/20">
          <div
            className={`flex items-center gap-3 ${!sidebarOpen && "lg:justify-center"}`}
          >
            <div className="w-9 h-9 rounded-full bg-emerald-800 flex items-center justify-center font-bold text-white text-sm shadow-inner shrink-0">
              W
            </div>
            <div
              className={`overflow-hidden transition-opacity duration-200 ${!sidebarOpen && "lg:hidden"}`}
            >
              <p className="text-xs font-bold text-white truncate">
                Warga Aktif
              </p>
              <p className="text-[11px] text-emerald-300 truncate">
                Sistem Warga PKK
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* AREA KONTEN UTAMA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-emerald-50/30">
        {/* Topbar Desktop */}
        <header className="hidden lg:flex h-16 bg-white border-b border-emerald-100 items-center justify-between px-6 shrink-0 shadow-xs">
          {/* Kiri: Toggle Sidebar */}
          <div className="flex items-center w-48">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer"
              title="Toggle Sidebar"
            >
              <i
                className={`fa-solid ${sidebarOpen ? "fa-indent" : "fa-outdent"} text-lg`}
              ></i>
            </button>
          </div>

          {/* Tengah: Judul Portal + Emoticon Senyum Lompat Pelan */}
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
            <span>Sistem Informasi Manajemen</span>
            <span className="animate-gentle-bounce text-base">😊</span>
          </div>

          {/* Kanan: Badge Tanggal Hari Ini */}
          <div className="flex items-center justify-end w-48">
            {todayDate && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-800 shadow-2xs">
                <i className="fa-regular fa-calendar text-emerald-600"></i>
                <span>{todayDate}</span>
              </div>
            )}
          </div>
        </header>

        {/* Konten Halaman */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}