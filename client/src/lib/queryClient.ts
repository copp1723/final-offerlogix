import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Return authentication headers for requests.
 * Centralizes reading the API key (avoids scattered localStorage reads).
 */
export function getAuthHeaders(): Record<string, string> {
  // Note: Reading tokens from localStorage is susceptible to XSS. Prefer httpOnly cookies
  // or short-lived in-memory tokens in the future. Centralizing here limits surface area.
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('apiKey') : null;
  return apiKey ? { 'X-API-Key': apiKey } : {};
}

/**
 * Generic apiRequest helper. Returns parsed JSON/text and throws on non-OK.
 * - If `body` is FormData, we intentionally avoid setting Content-Type so the
 *   browser can set the multipart boundary.
 */
export async function apiRequest<T = any>(
  url: string,
  method: string = 'GET',
  body?: unknown,
): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : body ? { 'Content-Type': 'application/json' } : {}),
    ...getAuthHeaders(),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  await throwIfResNotOk(res);

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await res.json()) as T;
  }

  // If caller expects a string but used generic, this will coerce
  return (await res.text()) as unknown as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
