import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadKeepAwake, saveKeepAwake, ScreenWakeController, type WakeStatus } from './wake-lock';

class Visibility extends EventTarget { hidden = false; change(hidden: boolean) { this.hidden = hidden; this.dispatchEvent(new Event('visibilitychange')); } }
class Sentinel extends EventTarget {
  released = false;
  release = vi.fn(async () => { this.released = true; this.dispatchEvent(new Event('release')); });
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
afterEach(() => vi.unstubAllGlobals());

describe('screen wake lock', () => {
  it('does not request on Home, requests once in practice, releases on exit, and reacquires on return to visibility', async () => {
    const visibility = new Visibility(), statuses: WakeStatus[] = [];
    const first = new Sentinel(), second = new Sentinel();
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const controller = new ScreenWakeController(request, visibility, status => statuses.push(status));
    controller.setWanted(false);
    expect(request).not.toHaveBeenCalled();
    controller.setWanted(true); controller.setWanted(true);
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toBe('active');
    visibility.change(true); await flush();
    expect(first.release).toHaveBeenCalledOnce();
    expect(statuses.at(-1)).toBe('off');
    visibility.change(false); await flush();
    expect(request).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)).toBe('active');
    controller.setWanted(false); await flush();
    expect(second.release).toHaveBeenCalledOnce();
    expect(statuses.at(-1)).toBe('off');
    controller.dispose();
  });
  it('reports denied or system-released locks honestly without a request loop', async () => {
    const visibility = new Visibility(), statuses: WakeStatus[] = [];
    const sentinel = new Sentinel();
    const request = vi.fn().mockRejectedValueOnce(new Error('battery saver')).mockResolvedValueOnce(sentinel);
    const controller = new ScreenWakeController(request, visibility, status => statuses.push(status));
    controller.setWanted(true); await flush();
    expect(statuses.at(-1)).toBe('denied');
    controller.setWanted(true); await flush();
    expect(request).toHaveBeenCalledTimes(1);
    visibility.change(true); visibility.change(false); await flush();
    expect(statuses.at(-1)).toBe('active');
    sentinel.released = true; sentinel.dispatchEvent(new Event('release'));
    expect(statuses.at(-1)).toBe('released');
    await flush(); expect(request).toHaveBeenCalledTimes(2);
    controller.dispose();
  });
  it('handles unsupported browsers and releases a late request after leaving practice', async () => {
    const visibility = new Visibility(), statuses: WakeStatus[] = [];
    const unsupported = new ScreenWakeController(null, visibility, status => statuses.push(status));
    unsupported.setWanted(true);
    expect(statuses.at(-1)).toBe('unavailable');
    unsupported.dispose();
    let resolve!: (value: Sentinel) => void;
    const request = vi.fn(() => new Promise<Sentinel>(done => { resolve = done; }));
    const controller = new ScreenWakeController(request, visibility, () => {});
    controller.setWanted(true);
    controller.setWanted(false);
    const sentinel = new Sentinel(); resolve(sentinel); await flush();
    expect(sentinel.release).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
    controller.dispose();
  });
  it('defaults the saved preference on and stores an explicit off choice', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    expect(loadKeepAwake()).toBe(true);
    saveKeepAwake(false); expect(loadKeepAwake()).toBe(false);
    saveKeepAwake(true); expect(loadKeepAwake()).toBe(true);
  });
});
