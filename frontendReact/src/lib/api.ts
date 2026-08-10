const rawApiBaseUrl = import.meta.env.VITE_API_URL as string | undefined;

const apiBaseUrl = (rawApiBaseUrl ?? "").trim().replace(/\/+$/, "");

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!apiBaseUrl) {
    return normalizedPath;
  }

  return `${apiBaseUrl}${normalizedPath}`;
};

export const apiFetch = (path: string, init?: RequestInit) => {
  return fetch(apiUrl(path), init);
};