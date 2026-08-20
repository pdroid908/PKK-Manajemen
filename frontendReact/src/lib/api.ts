const rawApiBaseUrl = import.meta.env.VITE_API_URL as string | undefined;

// Menghapus slash di paling akhir URL jika ada
const apiBaseUrl = (rawApiBaseUrl ?? "").trim().replace(/\/+$/, "");

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!apiBaseUrl) {
    return normalizedPath;
  }

  return `${apiBaseUrl}${normalizedPath}`;
};

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});

  // Menggunakan helper apiUrl agar URL terbentuk bersih tanpa double slash '//'
  const fullUrl = apiUrl(endpoint);

  const response = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: "include", // Kirim cookie otomatis
  });

  return response;
}