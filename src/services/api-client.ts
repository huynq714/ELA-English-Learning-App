export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
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

async function get<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getBaseUrl()}${path}`, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new ApiError('Không kết nối được Backend. Hãy kiểm tra máy chủ và địa chỉ API.');
  }

  if (!response.ok) {
    let message = `Backend trả về HTTP ${response.status}.`;
    try {
      const payload: unknown = await response.json();
      if (payload && typeof payload === 'object') {
        const body = payload as { message?: unknown; detail?: unknown };
        if (typeof body.message === 'string') message = body.message;
        else if (typeof body.detail === 'string') message = body.detail;
      }
    } catch {
      // Keep the safe status-based message when the response is not JSON.
    }
    throw new ApiError(message, response.status);
  }

  try {
    return await response.json() as T;
  } catch {
    throw new ApiError('Backend trả về dữ liệu không đọc được.', response.status);
  }
}

export const apiClient = { get };
