import type { ApiError } from '@athenaeum/shared';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
  }
}

export interface ApiInit extends Omit<RequestInit, 'body'> {
  /** Sent as a JSON body with the right Content-Type. */
  json?: unknown;
  body?: BodyInit;
}

/** Fetch JSON from the local API. Always sends the session cookie. */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...rest,
    headers: json === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: json === undefined ? rest.body : JSON.stringify(json),
  });
  const body: unknown = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : undefined;
  if (!res.ok) {
    const message = (body as ApiError | undefined)?.error ?? `Request failed (${res.status})`;
    throw new HttpError(res.status, message, body);
  }
  return body as T;
}
