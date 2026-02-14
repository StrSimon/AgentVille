import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionStats } from './SessionStats';

describe('SessionStats', () => {
  it('should render nothing when totalEvents is 0', () => {
    const { container } = render(
      <SessionStats agentCount={0} totalEvents={0} totalInputBytes={0} totalOutputBytes={0} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('should render stats when there are events', () => {
    render(
      <SessionStats agentCount={3} totalEvents={42} totalInputBytes={0} totalOutputBytes={0} />
    );
    expect(screen.getByText('Session')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Peak')).toBeInTheDocument();
  });

  it('should show token count when bytes are provided', () => {
    render(
      <SessionStats agentCount={1} totalEvents={10} totalInputBytes={20000} totalOutputBytes={20000} />
    );
    expect(screen.getByText('Tokens')).toBeInTheDocument();
    // 40000 bytes / 4 = 10000 tokens = 10.0k
    expect(screen.getByText('~10.0k')).toBeInTheDocument();
  });

  it('should not show tokens section when bytes are 0', () => {
    render(
      <SessionStats agentCount={1} totalEvents={10} totalInputBytes={0} totalOutputBytes={0} />
    );
    expect(screen.queryByText('Tokens')).not.toBeInTheDocument();
  });

  it('should format large token counts with M suffix', () => {
    render(
      <SessionStats agentCount={1} totalEvents={10} totalInputBytes={2_000_000} totalOutputBytes={2_000_000} />
    );
    // 4M bytes / 4 = 1M tokens = 1.0M
    expect(screen.getByText('~1.0M')).toBeInTheDocument();
  });

  it('should format small token counts as plain numbers', () => {
    render(
      <SessionStats agentCount={1} totalEvents={10} totalInputBytes={200} totalOutputBytes={200} />
    );
    // 400 bytes / 4 = 100 tokens
    expect(screen.getByText('~100')).toBeInTheDocument();
  });

  it('should track peak agents', () => {
    const { rerender } = render(
      <SessionStats agentCount={5} totalEvents={10} totalInputBytes={0} totalOutputBytes={0} />
    );
    // Peak should be 5
    expect(screen.getByText('5')).toBeInTheDocument();

    // Reduce agent count — peak should remain 5
    rerender(
      <SessionStats agentCount={2} totalEvents={15} totalInputBytes={0} totalOutputBytes={0} />
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
