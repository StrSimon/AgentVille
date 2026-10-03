import { useSyncExternalStore } from 'react';
import type { FxEvent, ServerMessage } from '../types';
import { dismissToast, initialState, reduce, type VillageState } from './reducer';

type Listener = () => void;
type FxListener = (e: FxEvent) => void;

/** Tiny external store: React reads it via useSyncExternalStore, the Pixi world subscribes directly. */
export class VillageStore {
  private state: VillageState = initialState;
  private listeners = new Set<Listener>();
  private fxListeners = new Set<FxListener>();

  getState = (): VillageState => this.state;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  onFx(fn: FxListener): () => void {
    this.fxListeners.add(fn);
    return () => this.fxListeners.delete(fn);
  }

  dispatch(msg: ServerMessage): void {
    this.state = reduce(this.state, msg);
    if (msg.type === 'fx') for (const fn of this.fxListeners) fn(msg);
    for (const fn of this.listeners) fn();
  }

  dismissToast(id: number): void {
    this.state = dismissToast(this.state, id);
    for (const fn of this.listeners) fn();
  }

  reset(): void {
    this.state = initialState;
    for (const fn of this.listeners) fn();
  }
}

export const store = new VillageStore();

export function useVillage<T>(select: (s: VillageState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.getState()));
}
