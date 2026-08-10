import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true); // Layout desktop
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false); // Drawer mobile
  const location = useLocation();

  const menuItems = [
    { path: "/admin/pengumuman", label: "Pengumuman", icon: "fa-bullhorn" },
    { path: "/admin/keuangan", label: "Keuangan", icon: "fa-wallet" },
    { path: "/admin/barang", label: "Inventaris", icon: "fa-boxes-stacked" },
    { path: "/admin/pinjaman", label: "Peminjam", icon: "fa-handshake" },
    { path: "/admin/warga", label: "Anggota", icon: "fa-users" },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-100 font-sans text-zinc-800 overflow-hidden">

      {/* TOPBAR KHUSUS MOBILE (Layar Kecil) */}
      <header className="lg:hidden bg-emerald-950 text-white h-14 px-4 flex items-center justify-between z-20 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setMobileDrawerOpen(true)}
            className="p-2 text-emerald-200 hover:text-white rounded-lg focus:outline-none"
          >
            <i className="fa-solid fa-bars text-xl"></i>
          </button>
          <span className="font-bold text-base tracking-wide">Admin Panel</span>
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
                  isActive ? 'bg-emerald-800 text-white' : 'text-emerald-200 hover:text-white'
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
          ${mobileDrawerOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
          ${sidebarOpen ? 'lg:w-64' : 'lg:w-20'}
        `}
      >
        <div className="flex items-center justify-between h-16 px-4 bg-emerald-900/40 border-b border-emerald-900/60 shrink-0">
          <div className={`flex items-center gap-3 overflow-hidden ${!sidebarOpen && 'lg:justify-center lg:w-full'}`}>
            <div className="bg-emerald-600 text-white p-2 rounded-lg font-bold flex items-center justify-center shrink-0">
              <i className="fa-solid fa-layer-group text-lg"></i>
            </div>
            <span className={`font-bold text-lg text-white truncate ${!sidebarOpen && 'lg:hidden'}`}>
              AdminPanel
            </span>
          </div>

          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="lg:hidden text-emerald-300 hover:text-white p-1"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileDrawerOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-emerald-200 hover:bg-emerald-900/50 hover:text-white'
                }`}
              >
                <i className={`fa-solid ${item.icon} w-5 text-center shrink-0 ${isActive ? 'text-emerald-300' : ''}`}></i>
                <span className={`truncate ${!sidebarOpen && 'lg:hidden'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-emerald-900/60 bg-emerald-900/20">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'lg:justify-center'}`}>
            <div className="w-9 h-9 rounded-full bg-emerald-800 flex items-center justify-center font-bold text-white text-sm shadow-inner shrink-0">
              A
            </div>
            <div className={`overflow-hidden transition-opacity duration-200 ${!sidebarOpen && 'lg:hidden'}`}>
              <p className="text-xs font-semibold text-white truncate">Administrator</p>
              <p className="text-[11px] text-emerald-300 truncate">admin@system.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* AREA KONTEN UTAMA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-emerald-50/50">
        <header className="hidden lg:flex h-16 bg-white border-b border-emerald-100 items-center justify-between px-6 shrink-0 shadow-xs">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700 transition"
            title="Toggle Sidebar"
          >
            <i className={`fa-solid ${sidebarOpen ? 'fa-indent' : 'fa-outdent'} text-lg`}></i>
          </button>
          <span className="text-sm font-semibold text-zinc-700">GoJadwal Admin System</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Tempat halaman anak (seperti Admin.tsx) dirender */}
          <Outlet />
        </main>
      </div>

    </div>
  );
}