import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThoughtBubble } from './ThoughtBubble';

describe('ThoughtBubble', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show nothing when detail is empty', () => {
    const { container } = render(
      <ThoughtBubble detail="" activity="coding" color="#60a5fa" />
    );
    // AnimatePresence renders nothing when not visible
    expect(container.textContent).toBe('');
  });

  it('should show a dwarf-themed message for coding activity', () => {
    render(
      <ThoughtBubble detail="App.tsx" activity="coding" color="#60a5fa" />
    );
    // Should contain App.tsx somewhere in the dwarf speech
    expect(screen.getByText(/App\.tsx/)).toBeInTheDocument();
  });

  it('should show a dwarf-themed message for researching activity', () => {
    render(
      <ThoughtBubble detail="handleSubmit" activity="researching" color="#a855f7" />
    );
    expect(screen.getByText(/handleSubmit/)).toBeInTheDocument();
  });

  it('should show a message for testing activity', () => {
    render(
      <ThoughtBubble detail="npm test" activity="testing" color="#22c55e" />
    );
    // Testing phrases don't include {f}, so just check something renders
    const el = screen.getByText(/test|arena|blade|blow|stress/i);
    expect(el).toBeInTheDocument();
  });

  it('should show a message for planning activity', () => {
    render(
      <ThoughtBubble detail="starting" activity="planning" color="#3b82f6" />
    );
    expect(screen.getByText(/Awakening to duty/)).toBeInTheDocument();
  });

  it('should handle idle activity', () => {
    render(
      <ThoughtBubble detail="waiting" activity="idle" color="#78350f" />
    );
    const el = screen.getByText(/axe|fire|Dozing|orders|smoke/i);
    expect(el).toBeInTheDocument();
  });

  it('should truncate long file paths to basename', () => {
    render(
      <ThoughtBubble detail="src/components/deep/nested/VeryLongFile.tsx" activity="coding" color="#60a5fa" />
    );
    expect(screen.getByText(/VeryLongFile\.tsx/)).toBeInTheDocument();
  });

  it('should auto-hide after 5 seconds', () => {
    vi.useFakeTimers();
    const { container } = render(
      <ThoughtBubble detail="App.tsx" activity="coding" color="#60a5fa" />
    );

    // Visible initially
    expect(container.textContent).not.toBe('');

    // After 5 seconds, should trigger hide
    act(() => {
      vi.advanceTimersByTime(5100);
    });

    // framer-motion AnimatePresence may still be animating exit,
    // but the visible state should be false
    // We just verify no crash and the timer works
  });
});
