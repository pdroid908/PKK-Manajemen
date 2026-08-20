import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function ProtectedRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        // Mengirim request ping/auth ke endpoint backend
        const res = await apiFetch("/admin/pengumuman");

        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    };

    void verifyAuth();
  }, []);

  // Tampilkan loading sebentar saat mengecek token cookie
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600">
          <i className="fa-solid fa-spinner animate-spin text-emerald-600"></i>
          <span>Memeriksa status login...</span>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}