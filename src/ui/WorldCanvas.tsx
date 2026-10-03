import { useEffect, useRef } from 'react';
import { store } from '../state/store';
import { World } from '../world/World';
import type { TimeMode } from '../world/sky';
import { BUILDING_BY_ID, type BuildingId } from '../world/layout';
import { computeMood } from '../lib/mood';
import { ambience } from '../lib/ambience';
import { nightFactor } from '../world/sky';

interface Props {
  selectedId: string | null;
  timeMode: TimeMode;
  weatherPreview: number | null;
  onSelect: (id: string | null) => void;
  onBuilding: (id: BuildingId) => void;
  registerFocus: (fn: (id: string) => void) => void;
}

/** Hosts the Pixi village and keeps it in sync with the store. */
export function WorldCanvas({ selectedId, timeMode, weatherPreview, onSelect, onBuilding, registerFocus }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const handlers = useRef({ onSelect, onBuilding });
  handlers.current = { onSelect, onBuilding };
  const initial = useRef({ timeMode, selectedId });
  initial.current = { timeMode, selectedId };
  const preview = useRef(weatherPreview);
  preview.current = weatherPreview;

  useEffect(() => {
    let disposed = false;
    let unsub = () => {};
    let unsubFx = () => {};
    let ambientTimer: ReturnType<typeof setInterval> | undefined;
    void World.create(host.current!, {
      onSelectAgent: (id) => handlers.current.onSelect(id),
      onSelectBuilding: (id) => handlers.current.onBuilding(id),
    }).then((w) => {
      if (disposed) { w.destroy(); return; }
      world.current = w;
      w.setTimeMode(initial.current.timeMode);
      w.select(initial.current.selectedId);
      const applyState = () => {
        const state = store.getState();
        w.sync(state);
        w.weather.setTarget(preview.current ?? computeMood(state.stats).level);
      };
      applyState();
      unsub = store.subscribe(applyState);
      unsubFx = store.onFx((e) => w.fx(e));
      registerFocus((id) => w.focusAgent(id));
      w.weather.onThunder = (k) => ambience.thunder(k);
      ambientTimer = setInterval(() => {
        const agents = Object.values(store.getState().agents);
        ambience.update({
          night: nightFactor(new Date(), initial.current.timeMode),
          rain: w.weather.rain,
          forge: agents.some(a => a.online && a.activity === 'coding' && !a.attention),
        });
      }, 1000);
    });
    return () => {
      disposed = true;
      clearInterval(ambientTimer);
      unsub();
      unsubFx();
      world.current?.destroy();
      world.current = null;
    };
  }, [registerFocus]);

  useEffect(() => { world.current?.select(selectedId); }, [selectedId]);
  useEffect(() => { world.current?.setTimeMode(timeMode); }, [timeMode]);
  useEffect(() => { world.current?.weather.setTarget(weatherPreview ?? computeMood(store.getState().stats).level); }, [weatherPreview]);

  return (
    <div
      ref={host}
      className="absolute inset-0 touch-none select-none"
      role="img"
      aria-label={`Isometric village with ${Object.keys(BUILDING_BY_ID).length} buildings where your agents work`}
    />
  );
}
