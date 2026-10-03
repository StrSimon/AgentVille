import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bridgeAvailable, createLiveController, type Controller } from './state/controller';
import { createDemoController } from './state/demo';
import { needsYou } from './state/reducer';
import { store, useVillage } from './state/store';
import { announce } from './lib/attention';
import type { BuildingId } from './world/layout';
import type { TimeMode } from './world/sky';
import { AppContext, type AppApi, type Overlay } from './ui/app-context';
import { AgentPanel } from './ui/AgentPanel';
import { BuildingCard } from './ui/BuildingCard';
import { ControlCenter } from './ui/ControlCenter';
import { Timeline, Toasts } from './ui/Feed';
import { Inbox } from './ui/Inbox';
import { HostedBanner, Welcome } from './ui/Onboarding';
import { Residents } from './ui/Residents';
import { SettingsPanel } from './ui/SettingsPanel';
import { TopBar } from './ui/TopBar';
import { WorldCanvas } from './ui/WorldCanvas';

type Mode = 'live' | 'demo';

function useAttentionSignals(select: (id: string) => void): void {
  const agents = useVillage(s => s.agents);
  const selectRef = useRef(select);
  selectRef.current = select;
  useEffect(() => { announce(needsYou(store.getState()), (id) => selectRef.current(id)); }, [agents]);
}

export function App() {
  const [controller, setController] = useState<Controller | null>(null);
  const [hosted, setHosted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [building, setBuilding] = useState<BuildingId | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [timeMode, setTimeModeState] = useState<TimeMode>(() => (localStorage.getItem('agentville-time') as TimeMode) || 'auto');
  const focusFn = useRef<(id: string) => void>(() => {});
  const [weatherPreview, setWeatherPreview] = useState<number | null>(null);

  const start = useCallback((mode: Mode) => {
    setController(prev => {
      prev?.stop();
      setSelectedId(null);
      return mode === 'live' ? createLiveController() : createDemoController();
    });
  }, []);

  useEffect(() => {
    const wantDemo = new URLSearchParams(location.search).has('demo');
    void bridgeAvailable().then((ok) => {
      setHosted(!ok);
      start(ok && !wantDemo ? 'live' : 'demo');
    });
  }, [start]);

  useEffect(() => () => controller?.stop(), [controller]);

  const select = useCallback((id: string | null) => { setSelectedId(id); if (id) setBuilding(null); }, []);
  const focus = useCallback((id: string) => focusFn.current(id), []);
  const registerFocus = useCallback((fn: (id: string) => void) => { focusFn.current = fn; }, []);
  const setTimeMode = useCallback((m: TimeMode) => { localStorage.setItem('agentville-time', m); setTimeModeState(m); }, []);

  useAttentionSignals((id) => { select(id); focus(id); });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey) return;
      if (e.key === 'Escape') { setOverlay('none'); setBuilding(null); setSelectedId(null); }
      if (e.key === 'c') setOverlay(o => (o === 'control' ? 'none' : 'control'));
      if (e.key === 'r') setOverlay(o => (o === 'residents' ? 'none' : 'residents'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const api: AppApi | null = useMemo(() => controller && ({
    controller, mode: controller.mode, hosted, selectedId, select, focus, overlay, setOverlay,
    timeMode, setTimeMode, switchMode: (m: Mode) => { if (m !== controller.mode) start(m); },
    weatherPreview, setWeatherPreview,
  }), [controller, hosted, selectedId, select, focus, overlay, timeMode, setTimeMode, start, weatherPreview]);

  if (!api) {
    return <div className="grid h-full place-items-center font-display text-xl text-muted">Gathering the dwarves…</div>;
  }

  return (
    <AppContext.Provider value={api}>
      <main className="relative h-full w-full overflow-hidden">
        <WorldCanvas
          key={api.mode}
          selectedId={selectedId}
          timeMode={timeMode}
          weatherPreview={weatherPreview}
          onSelect={select}
          onBuilding={(id) => { setBuilding(id); setSelectedId(null); }}
          registerFocus={registerFocus}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(5_8_20/0.55))]" />
        <TopBar />
        <Inbox />
        <AgentPanel />
        {building && <BuildingCard id={building} onClose={() => setBuilding(null)} />}
        <Timeline />
        <Toasts />
        <HostedBanner />
        {overlay === 'control' && <ControlCenter />}
        {overlay === 'residents' && <Residents />}
        {overlay === 'settings' && <SettingsPanel />}
        <Welcome />
      </main>
    </AppContext.Provider>
  );
}
