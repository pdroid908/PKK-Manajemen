import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'error',
  });

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAlert({ show: false, message: '', type: 'error' });

    if (!username.trim() || !password) {
      setAlert({ show: true, message: 'Harap isi semua kolom.', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include', // <-- 3. PASTIKAN INI ADA agar Cookie session tersimpan di browser!
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setAlert({ show: true, message: 'Login berhasil! Mengalihkan...', type: 'success' });
        setTimeout(() => {
          navigate('/admin'); // <-- 4. Pindah halaman menggunakan React Router tanpa reload ke backend
        }, 1000);
      } else {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Gagal login, periksa kembali data Anda.';
        setAlert({ show: true, message: errorMessage, type: 'error' });
      }
    } catch {
      setAlert({ show: true, message: 'Gagal terhubung ke server. Periksa koneksi Anda.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border-2 border-emerald-500 shadow-2xl overflow-hidden">
        
        <div className="bg-emerald-700 text-white p-6 text-center border-b-2 border-emerald-800">
          <div className="inline-flex bg-white text-emerald-700 p-3 rounded-2xl shadow-md mb-3">
            <i className="fa-solid fa-calendar-days text-2xl" aria-hidden="true"></i>
          </div>
          <h1 className="text-2xl font-black">Login Owner</h1>
          <p className="text-xs text-emerald-100 font-medium mt-1">Masuk ke akun untuk mengelola jadwal booking</p>
        </div>

        <div className="p-6 space-y-4">
          {alert.show && (
            <div className={`p-3.5 rounded-2xl border-2 text-xs font-bold flex items-center gap-2 ${
              alert.type === 'success' ? 'bg-emerald-100 border-emerald-400 text-emerald-950' : 'bg-rose-100 border-rose-400 text-rose-950'
            }`} role="alert">
              <i className={`fa-solid ${alert.type === 'success' ? 'fa-circle-check text-emerald-700' : 'fa-triangle-exclamation text-rose-600'} text-base`} aria-hidden="true"></i>
              <span>{alert.message}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <i className="fa-solid fa-user text-sm" aria-hidden="true"></i>
                </span>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  required 
                  placeholder="Masukkan username" 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:border-emerald-600 focus:bg-white outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <i className="fa-solid fa-lock text-sm" aria-hidden="true"></i>
                </span>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  placeholder="••••••••" 
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:border-emerald-600 focus:bg-white outline-none transition"
                />
                
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-emerald-700 transition cursor-pointer"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} aria-hidden="true"></i>
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-70 disabled:cursor-not-allowed text-white font-black text-sm rounded-xl shadow-md transition transform active:scale-95 flex items-center justify-center gap-2"
            >
              <i className={`fa-solid ${loading ? 'fa-spinner animate-spin' : 'fa-right-to-bracket'}`} aria-hidden="true"></i>
              <span>{loading ? 'Memproses...' : 'Masuk'}</span>
            </button>
          </form>

          <div className="pt-4 border-t-2 border-slate-100 text-center text-xs font-bold text-slate-600">
            Belum punya akun?{' '}
            <span className="text-emerald-700 font-black">Hubungi admin untuk aktivasi</span>
          </div>

          <div className="text-center">
            <Link to="/" className="text-xs font-extrabold text-slate-700 hover:text-slate-600 transition">
              <i className="fa-solid fa-arrow-left mr-1" aria-hidden="true"></i> Kembali ke Halaman Utama
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}