export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
let renewing: Promise<Response> | null = null;
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError('Conexão indisponível. Verifique sua internet e tente novamente.', 0);
  }
  if (
    response.status === 401 &&
    retry &&
    ![
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/logout',
      '/auth/forgot-password',
      '/auth/reset-password',
    ].includes(path)
  ) {
    renewing ??= fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' }).finally(
      () => {
        renewing = null;
      },
    );
    const fresh = await renewing;
    if (fresh.ok) return api(path, options, false);
  }
  if (!response.ok) {
    let message = 'Não foi possível concluir a operação';
    try {
      const body = await response.json();
      message = body.error?.message ?? body.message ?? message;
      if (Array.isArray(message)) message = message.join(', ');
    } catch {
      message = 'Não foi possível concluir a operação';
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
