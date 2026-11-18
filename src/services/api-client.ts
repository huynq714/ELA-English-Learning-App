export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function getBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new ApiError('Chưa cấu hình EXPO_PUBLIC_API_BASE_URL.');
  }
  return baseUrl;
}

async function request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown, token?: string): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('Không kết nối được Backend. Hãy kiểm tra máy chủ và địa chỉ API.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let message = `Backend trả về HTTP ${response.status}.`;
    let code: string | undefined;
    try {
      const payload: unknown = await response.json();
      if (payload && typeof payload === 'object') {
        const body = payload as { message?: unknown; detail?: unknown; code?: unknown };
        if (typeof body.code === 'string') code = body.code;
        if (typeof body.message === 'string') message = body.message;
        else if (typeof body.detail === 'string') message = body.detail;
      }
    } catch {
      // Keep the safe status-based message when the response is not JSON.
    }
    throw new ApiError(message, response.status, code);
  }

  try {
    return await response.json() as T;
  } catch {
    throw new ApiError('Backend trả về dữ liệu không đọc được.', response.status);
  }
}

export const apiClient = {
  get: <T>(path: string, token?: string) => request<T>('GET', path, undefined, token),
  post: <T>(path: string, body: unknown, token?: string) => request<T>('POST', path, body, token),
  patch: <T>(path: string, body: unknown, token: string) => request<T>('PATCH', path, body, token),
};
