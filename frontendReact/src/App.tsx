import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Login from "./pages/Login";
import AdminLayout from "./layout/AdminLayout";
import AdminPengumuman from "./pages/admin/Admin";
import KeuanganAdmin from "./pages/admin/Keuangan";
import Barang from "./pages/Barang";
import DashboardPublik from "./pages/dashboard";
import PublikWarga from "./pages/PublikWarga";
import PublicLayout from "./layout/PublicLayout";
import KeuanganPublic from "./pages/KeuanganPublic";
import Inventory from "./pages/admin/Inventory";
import Adminpinjaman from "./pages/admin/AdminPinjaman";
import WargaManagement from "./pages/admin/Warga";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 15, // Data dianggap segar selama 5 menit (TIDAK AKAN FETCH ULANG)
      gcTime: 1000 * 60 * 30,    // Cache disimpan di memori selama 30 menit
      refetchOnWindowFocus: false, // Tidak fetch ulang saat tab browser diklik
    },
  },
});


export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <Router>
      <Routes>
        {/* Redirect root '/' langsung ke halaman dashboard publik */}
        <Route path="/" element={<Navigate to="/publik/dashboard" replace />} />

        {/* Area Publik / Warga */}
        <Route path="/publik" element={<PublicLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPublik />} />
          <Route path="keuangan" element={<KeuanganPublic />} />
          <Route path="barang" element={<Barang />} />
          <Route path="warga" element={<PublikWarga />} />
        </Route>

        <Route path="/login" element={<Login />} />

        {/* Area Admin */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="pengumuman" replace />} />
          <Route path="pengumuman" element={<AdminPengumuman />} />
          <Route path="keuangan" element={<KeuanganAdmin />} />
          <Route path="barang" element={<Inventory />} />
          <Route path="pinjaman" element={<Adminpinjaman />} />
           <Route path="warga" element={<WargaManagement />} />
        </Route>

        {/* Fallback jika URL tidak ditemukan */}
        <Route path="*" element={<Navigate to="/publik/dashboard" replace />} />
      </Routes>
      </Router>
      </QueryClientProvider>
  );
}
