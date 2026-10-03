import { useEffect, useRef } from 'react';
import { store } from '../state/store';
import { World } from '../world/World';
import type { TimeMode } from '../world/sky';
import { BUILDING_BY_ID, type BuildingId } from '../world/layout';

interface Props {
  selectedId: string | null;
  timeMode: TimeMode;
  onSelect: (id: string | null) => void;
  onBuilding: (id: BuildingId) => void;
  registerFocus: (fn: (id: string) => void) => void;
}

/** Hosts the Pixi village and keeps it in sync with the store. */
export function WorldCanvas({ selectedId, timeMode, onSelect, onBuilding, registerFocus }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const handlers = useRef({ onSelect, onBuilding });
  handlers.current = { onSelect, onBuilding };
  const initial = useRef({ timeMode, selectedId });
  initial.current = { timeMode, selectedId };

  useEffect(() => {
    let disposed = false;
    let unsub = () => {};
    let unsubFx = () => {};
    void World.create(host.current!, {
      onSelectAgent: (id) => handlers.current.onSelect(id),
      onSelectBuilding: (id) => handlers.current.onBuilding(id),
    }).then((w) => {
      if (disposed) { w.destroy(); return; }
      world.current = w;
      w.setTimeMode(initial.current.timeMode);
      w.select(initial.current.selectedId);
      w.sync(store.getState());
      unsub = store.subscribe(() => w.sync(store.getState()));
      unsubFx = store.onFx((e) => w.fx(e));
      registerFocus((id) => w.focusAgent(id));
    });
    return () => {
      disposed = true;
      unsub();
      unsubFx();
      world.current?.destroy();
      world.current = null;
    };
  }, [registerFocus]);

  useEffect(() => { world.current?.select(selectedId); }, [selectedId]);
  useEffect(() => { world.current?.setTimeMode(timeMode); }, [timeMode]);

  return (
    <div
      ref={host}
      className="absolute inset-0 touch-none select-none"
      role="img"
      aria-label={`Isometric village with ${Object.keys(BUILDING_BY_ID).length} buildings where your agents work`}
    />
  );
}
