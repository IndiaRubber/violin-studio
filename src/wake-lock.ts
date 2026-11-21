import { useEffect, useRef, useState } from 'react';

export type WakeStatus = 'off' | 'requesting' | 'active' | 'unavailable' | 'denied' | 'released';
type Sentinel = Pick<WakeLockSentinel, 'released' | 'release' | 'addEventListener' | 'removeEventListener'>;
type RequestLock = () => Promise<Sentinel>;
type Visibility = Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;
const KEY = 'violin-studio-keep-awake';

export function loadKeepAwake(): boolean {
  try { return localStorage.getItem(KEY) !== 'false'; } catch { return true; }
}
export function saveKeepAwake(enabled: boolean): void {
  try { localStorage.setItem(KEY, String(enabled)); } catch { /* optional preference storage */ }
}

/** One request at a time; a released or denied lock waits for a new visible session. */
export class ScreenWakeController {
  private wanted = false;
  private blocked = false;
  private disposed = false;
  private token = 0;
  private sentinel: Sentinel | null = null;
  private pending: Promise<void> | null = null;
  private status: WakeStatus = 'off';
  constructor(private request: RequestLock | null, private visibility: Visibility, private onStatus: (status: WakeStatus) => void) {
    visibility.addEventListener('visibilitychange', this.onVisibility);
  }
  private report(status: WakeStatus) { if (this.status !== status) { this.status = status; this.onStatus(status); } }
  private onRelease = () => {
    if (!this.sentinel) return;
    this.sentinel.removeEventListener('release', this.onRelease);
    this.sentinel = null;
    this.blocked = true;
    this.report(this.wanted && !this.visibility.hidden ? 'released' : 'off');
  };
  private onVisibility = () => {
    if (this.visibility.hidden) { this.release(); return; }
    this.blocked = false;
    this.sync();
  };
  setWanted(wanted: boolean) {
    if (this.disposed || this.wanted === wanted) return;
    this.wanted = wanted;
    if (!wanted) { this.blocked = false; this.release(); }
    else this.sync();
  }
  private release() {
    this.token++;
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel) { sentinel.removeEventListener('release', this.onRelease); void sentinel.release().catch(() => {}); }
    this.report('off');
  }
  private sync() {
    if (this.disposed || !this.wanted || this.visibility.hidden || this.pending || this.sentinel || this.blocked) return;
    if (!this.request) { this.report('unavailable'); return; }
    const token = ++this.token;
    this.report('requesting');
    this.pending = this.request().then(sentinel => {
      if (this.disposed || token !== this.token || !this.wanted || this.visibility.hidden || sentinel.released) {
        if (!sentinel.released) void sentinel.release().catch(() => {});
        return;
      }
      this.sentinel = sentinel;
      sentinel.addEventListener('release', this.onRelease);
      this.report('active');
    }).catch(() => { if (token === this.token && this.wanted && !this.visibility.hidden) { this.blocked = true; this.report('denied'); } })
      .finally(() => { this.pending = null; if (token !== this.token && !this.disposed) this.sync(); });
  }
  dispose() {
    this.disposed = true;
    this.wanted = false;
    this.visibility.removeEventListener('visibilitychange', this.onVisibility);
    this.release();
  }
}

export function useScreenWake(wanted: boolean, enabled: boolean): WakeStatus {
  const [status, setStatus] = useState<WakeStatus>('off');
  const controller = useRef<ScreenWakeController | null>(null);
  useEffect(() => {
    const request = navigator.wakeLock?.request ? () => navigator.wakeLock.request('screen') : null;
    controller.current = new ScreenWakeController(request, document, setStatus);
    return () => { controller.current?.dispose(); controller.current = null; };
  }, []);
  useEffect(() => controller.current?.setWanted(wanted && enabled), [wanted, enabled]);
  return status;
}
