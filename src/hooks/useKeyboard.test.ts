import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboard } from './useKeyboard';

function fireKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

describe('useKeyboard', () => {
  it('should call toggleSound on "m" key', () => {
    const actions = {
      toggleSound: vi.fn(),
      toggleTimeline: vi.fn(),
      toggleMode: vi.fn(),
    };
    renderHook(() => useKeyboard(actions));

    fireKey('m');
    expect(actions.toggleSound).toHaveBeenCalledOnce();
  });

  it('should call toggleSound on "M" key', () => {
    const actions = {
      toggleSound: vi.fn(),
      toggleTimeline: vi.fn(),
      toggleMode: vi.fn(),
    };
    renderHook(() => useKeyboard(actions));

    fireKey('M');
    expect(actions.toggleSound).toHaveBeenCalledOnce();
  });

  it('should call toggleTimeline on "t" key', () => {
    const actions = {
      toggleSound: vi.fn(),
      toggleTimeline: vi.fn(),
      toggleMode: vi.fn(),
    };
    renderHook(() => useKeyboard(actions));

    fireKey('t');
    expect(actions.toggleTimeline).toHaveBeenCalledOnce();
  });

  it('should call toggleMode on "d" key', () => {
    const actions = {
      toggleSound: vi.fn(),
      toggleTimeline: vi.fn(),
      toggleMode: vi.fn(),
    };
    renderHook(() => useKeyboard(actions));

    fireKey('d');
    expect(actions.toggleMode).toHaveBeenCalledOnce();
  });

  it('should not trigger on unrelated keys', () => {
    const actions = {
      toggleSound: vi.fn(),
      toggleTimeline: vi.fn(),
      toggleMode: vi.fn(),
    };
    renderHook(() => useKeyboard(actions));

    fireKey('a');
    fireKey('Enter');
    fireKey('Escape');

    expect(actions.toggleSound).not.toHaveBeenCalled();
    expect(actions.toggleTimeline).not.toHaveBeenCalled();
    expect(actions.toggleMode).not.toHaveBeenCalled();
  });

  it('should clean up event listener on unmount', () => {
    const actions = {
      toggleSound: vi.fn(),
      toggleTimeline: vi.fn(),
      toggleMode: vi.fn(),
    };
    const { unmount } = renderHook(() => useKeyboard(actions));

    unmount();
    fireKey('m');
    expect(actions.toggleSound).not.toHaveBeenCalled();
  });
});
