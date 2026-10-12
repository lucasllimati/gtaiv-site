import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { Permission, Role } from '@pgi/shared';
import { API_URL } from '../lib/env.ts';

export interface Me {
  user: { id: number; email: string; name: string; role: Role };
  csrfToken: string;
  permissions: Permission[];
  features: { ai: boolean; mediaDriver: 'local' | 'r2'; rebuild: boolean };
  userCount: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

let csrfToken = '';
export function setCsrf(token: string) {
  csrfToken = token;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  const res = await fetch(`${API_URL}/api/admin${path}`, { ...init, method, headers, body, credentials: 'include' });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string; details?: { path: string; message: string }[] };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Erro ${res.status}`, data.details);
  return data as T;
}

export function useApiQuery<T>(key: QueryKey, path: string, enabled = true) {
  return useQuery<T, ApiError>({ queryKey: key, queryFn: () => api<T>(path), enabled });
}

/** Mutação que invalida as chaves informadas ao concluir. */
export function useApiMutation<TBody, TRes = unknown>(fn: (body: TBody) => Promise<TRes>, invalidate: QueryKey[] = []) {
  const qc = useQueryClient();
  return useMutation<TRes, ApiError, TBody>({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of invalidate) void qc.invalidateQueries({ queryKey: k });
    },
  });
}

export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.details?.length) return `${err.message} ${err.details.map((d) => `${d.path || 'campo'}: ${d.message}`).join(' · ')}`;
    return err.message;
  }
  return err instanceof Error ? err.message : 'Erro inesperado.';
}

/** Converte "2026-10-12T15:30:00.000Z" ↔ valor de <input type="datetime-local"> no fuso local. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
