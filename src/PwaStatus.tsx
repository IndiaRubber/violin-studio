import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export function PwaStatus() {
  const [state, setState] = useState<'preparing' | 'ready' | 'unavailable'>(import.meta.env.PROD ? 'preparing' : 'ready');
  const [update, setUpdate] = useState(false);
  const [applyUpdate, setApplyUpdate] = useState<(() => Promise<void>) | null>(null);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!('serviceWorker' in navigator)) { setState('unavailable'); return; }
    let interval: number | undefined;
    let checkOnReturn: (() => void) | undefined;
    let removeUpdateListener: (() => void) | undefined;
    const updateSW = registerSW({
      onNeedRefresh: () => setUpdate(true),
      onOfflineReady: () => setState('ready'),
      onRegisterError: () => setState('unavailable'),
      onRegisteredSW: (_url, registration) => {
        if (!registration) return;
        const showWaiting = () => { if (registration.waiting && navigator.serviceWorker.controller) setUpdate(true); };
        const onUpdateFound = () => registration.installing?.addEventListener('statechange', showWaiting);
        registration.addEventListener('updatefound', onUpdateFound);
        removeUpdateListener = () => registration.removeEventListener('updatefound', onUpdateFound);
        showWaiting();
        const check = () => { if (navigator.onLine && !document.hidden) void registration.update().then(showWaiting).catch(() => {}); };
        checkOnReturn = check;
        document.addEventListener('visibilitychange', check);
        interval = window.setInterval(check, 60 * 60 * 1000);
      },
    });
    setApplyUpdate(() => updateSW);
    void navigator.serviceWorker.ready.then(registration => { setState('ready'); if (registration.waiting && navigator.serviceWorker.controller) setUpdate(true); }).catch(() => setState('unavailable'));
    return () => { if (interval !== undefined) window.clearInterval(interval); if (checkOnReturn) document.removeEventListener('visibilitychange', checkOnReturn); removeUpdateListener?.(); };
  }, []);
  if (!import.meta.env.PROD) return null;
  return <aside className="pwa-status" aria-live="polite">
    <span>{state === 'ready' ? 'Available offline' : state === 'preparing' ? 'Preparing offline access…' : 'Offline setup unavailable; retry online.'}</span>
    {update && <span>New version ready. <button type="button" onClick={() => void applyUpdate?.()}>Update now</button></span>}
  </aside>;
}
