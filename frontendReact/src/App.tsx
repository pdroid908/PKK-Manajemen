import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
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
import WargaManagement  from "./pages/admin/Warga";
export default function App() {
  return (
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
  );
}
