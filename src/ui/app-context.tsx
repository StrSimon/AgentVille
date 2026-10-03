import { createContext, useContext } from 'react';
import type { Controller } from '../state/controller';
import type { TimeMode } from '../world/sky';

export type Overlay = 'none' | 'control' | 'residents' | 'settings';

export interface AppApi {
  controller: Controller;
  mode: 'live' | 'demo';
  hosted: boolean;
  selectedId: string | null;
  select: (id: string | null) => void;
  focus: (id: string) => void;
  overlay: Overlay;
  setOverlay: (o: Overlay) => void;
  timeMode: TimeMode;
  setTimeMode: (m: TimeMode) => void;
  switchMode: (m: 'live' | 'demo') => void;
}

export const AppContext = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext missing');
  return ctx;
}
