const rawApiBaseUrl = import.meta.env.VITE_API_URL as string | undefined;

const apiBaseUrl = (rawApiBaseUrl ?? "").trim().replace(/\/+$/, "");

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!apiBaseUrl) {
    return normalizedPath;
  }

  return `${apiBaseUrl}${normalizedPath}`;
};

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const BASE_URL = import.meta.env.VITE_API_URL || "";

  // Gabungkan header default dengan options header
  const headers = new Headers(options.headers || {});

  // Pastikan credentials "include" aktif agar HttpOnly Cookie terkirim otomatis oleh browser
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  // Jika token cookie tidak valid/kedaluwarsa (401), lempar otomatis ke halaman /login
  if (response.status === 401) {
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }

  return response;
}