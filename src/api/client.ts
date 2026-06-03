import { getServerUrl, getToken, clearCredentials } from "../store/auth";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  const url = await getServerUrl();
  const token = await getToken();
  if (!url || !token) return { ok: false, status: 0, error: "Not paired" };

  try {
    const res = await fetch(`${url}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });
    if (res.status === 401) {
      await clearCredentials();
      return { ok: false, status: 401, error: "Unauthorized — please re-pair" };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, status: 0, error: e.message ?? "Network error" };
  }
}

// Used during the pairing flow before a token exists
export async function pairingFetch<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    });
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, status: 0, error: e.message ?? "Network error" };
  }
}

// Returns raw Response for streaming — caller is responsible for reading body
export async function rawFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response | null> {
  const url = await getServerUrl();
  const token = await getToken();
  if (!url || !token) return null;
  return fetch(`${url}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}
