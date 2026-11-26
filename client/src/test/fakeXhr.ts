import { vi } from 'vitest';

type Listener = (event: ProgressEvent) => void;

/**
 * Stand-in for XMLHttpRequest (jsdom can't report upload progress). Each request waits until
 * the test calls `progress()` / `respond()`, so tests can see the in-between states.
 */
export class FakeXHR {
  static instances: FakeXHR[] = [];

  method = '';
  url = '';
  body: unknown;
  status = 0;
  responseText = '';
  withCredentials = false;
  private listeners: Record<string, Listener[]> = {};
  private uploadListeners: Record<string, Listener[]> = {};

  upload = {
    addEventListener: (type: string, fn: Listener) => {
      (this.uploadListeners[type] ??= []).push(fn);
    },
  };

  constructor() {
    FakeXHR.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader() {}
  getResponseHeader(name: string) {
    return name.toLowerCase() === 'content-type' ? 'application/json' : null;
  }
  addEventListener(type: string, fn: Listener) {
    (this.listeners[type] ??= []).push(fn);
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {}

  /** The uploaded File, when the body is FormData. */
  get file(): File | undefined {
    return this.body instanceof FormData ? (this.body.get('file') as File) : undefined;
  }

  progress(loaded: number, total: number) {
    const ev = { lengthComputable: true, loaded, total } as ProgressEvent;
    this.uploadListeners.progress?.forEach((fn) => fn(ev));
  }

  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.listeners.load?.forEach((fn) => fn({} as ProgressEvent));
  }

  failNetwork() {
    this.listeners.error?.forEach((fn) => fn({} as ProgressEvent));
  }
}

export function installFakeXhr() {
  FakeXHR.instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
  return FakeXHR;
}
