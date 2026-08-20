import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

interface NotificationState {
  show: boolean;
  message: string;
  type: "success" | "error";
}

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [notification, setNotification] = useState<NotificationState>({
    show: false,
    message: "",
    type: "error",
  });

  const showToast = (message: string, type: "success" | "error" = "error") => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 3500);
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username || !password) {
      showToast("Harap isi username dan password!", "error");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch("api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result: { message?: string; error?: string } | null =
        await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Username atau password salah!");
      }

      // Karena backend sudah set HttpOnly Cookie secara otomatis,
      // kita cukup cek jika response.ok, langsung alihkan ke dashboard admin!
      showToast("Login berhasil! Mengalihkan...", "success");
      
      setTimeout(() => {
        navigate("/admin", { replace: true });
      }, 1000);

    } catch (err: unknown) {
      console.error("Login Error:", err);
      showToast(
        err instanceof Error ? err.message : "Tidak dapat terhubung ke server.",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4 relative">
      {/* TOAST NOTIFIKASI */}
      {notification.show && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white font-semibold text-sm transition-all animate-bounce ${
            notification.type === "success"
              ? "bg-emerald-600 border border-emerald-500"
              : "bg-rose-600 border border-rose-500"
          }`}
        >
          <i
            className={`fa-solid ${
              notification.type === "success"
                ? "fa-circle-check text-xl"
                : "fa-triangle-exclamation text-xl"
            }`}
          ></i>
          <span>{notification.message}</span>
        </div>
      )}

      {/* CARD LOGIN */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-emerald-200/80 shadow-md p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6 pb-4 border-b border-emerald-100">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl font-bold mb-3 shadow-sm">
            <i className="fa-solid fa-lock"></i>
          </div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
            Masuk Admin 
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Gunakan akun administrator untuk mengakses panel pengelola
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                <i className="fa-solid fa-user text-sm"></i>
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                required
                className="w-full pl-10 pr-3.5 py-2.5 bg-zinc-50/80 border border-zinc-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all text-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                <i className="fa-solid fa-key text-sm"></i>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-3.5 py-2.5 bg-zinc-50/80 border border-zinc-300 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all text-zinc-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <i className="fa-solid fa-spinner animate-spin"></i>
                Memproses...
              </>
            ) : (
              <>
                <i className="fa-solid fa-right-to-bracket"></i>
                Masuk ke Dashboard
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}