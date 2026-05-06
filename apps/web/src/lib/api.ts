export function getApiBase(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) return configured.replace(/\/$/, '');
  const { protocol, hostname, port } = window.location;
  if (port === '5173' || port === '4173') return `${protocol}//${hostname}:3001/api`;
  return '/api';
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
