// Small fetch wrapper shared by all pages.
const TOKEN_KEY = "se_token";

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
}
export function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    clearToken();
    window.location.href = "login.html";
  }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}
