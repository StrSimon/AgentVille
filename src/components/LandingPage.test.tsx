import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render the title', () => {
    render(<LandingPage connected={false} onDemo={vi.fn()} />);
    expect(screen.getByText('AgentVille')).toBeInTheDocument();
  });

  it('should render the tagline', () => {
    render(<LandingPage connected={false} onDemo={vi.fn()} />);
    expect(screen.getByText(/Watch your AI agents build a village/)).toBeInTheDocument();
  });

  it('should show waiting state when not connected', () => {
    render(<LandingPage connected={false} onDemo={vi.fn()} />);
    expect(screen.getByText(/Waiting for bridge/)).toBeInTheDocument();
    expect(screen.getByText('localhost:4242')).toBeInTheDocument();
  });

  it('should show connected state when bridge is connected', () => {
    render(<LandingPage connected={true} onDemo={vi.fn()} />);
    expect(screen.getByText('Bridge connected!')).toBeInTheDocument();
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('should render all building icons', () => {
    render(<LandingPage connected={false} onDemo={vi.fn()} />);
    expect(screen.getByText('Coding')).toBeInTheDocument();
    expect(screen.getByText('Planning')).toBeInTheDocument();
    expect(screen.getByText('Testing')).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('Town Square')).toBeInTheDocument();
  });

  it('should render setup steps', () => {
    render(<LandingPage connected={false} onDemo={vi.fn()} />);
    expect(screen.getByText('Get Started')).toBeInTheDocument();
    expect(screen.getByText('Clone & install')).toBeInTheDocument();
    expect(screen.getByText('Start the bridge')).toBeInTheDocument();
    expect(screen.getByText('Connect all sessions globally')).toBeInTheDocument();
    expect(screen.getByText('Start coding!')).toBeInTheDocument();
  });

  it('should render code blocks in steps', () => {
    render(<LandingPage connected={false} onDemo={vi.fn()} />);
    expect(screen.getByText('npm run bridge')).toBeInTheDocument();
    expect(screen.getByText('npm run connect:global')).toBeInTheDocument();
  });

  it('should call onDemo when Try Demo button is clicked', () => {
    const onDemo = vi.fn();
    render(<LandingPage connected={false} onDemo={onDemo} />);
    fireEvent.click(screen.getByText('Try Demo'));
    expect(onDemo).toHaveBeenCalledOnce();
  });

  it('should render GitHub link', () => {
    render(<LandingPage connected={false} onDemo={vi.fn()} />);
    const link = screen.getByText('GitHub');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://github.com/StrSimon/AgentVille');
    expect(link.closest('a')).toHaveAttribute('target', '_blank');
  });

  it('should render feature cards', () => {
    render(<LandingPage connected={false} onDemo={vi.fn()} />);
    expect(screen.getByText('Real-time')).toBeInTheDocument();
    expect(screen.getByText('Persistent')).toBeInTheDocument();
    expect(screen.getByText('Local')).toBeInTheDocument();
  });

  it('should switch from waiting to connected state', () => {
    const { rerender } = render(<LandingPage connected={false} onDemo={vi.fn()} />);
    expect(screen.getByText(/Waiting for bridge/)).toBeInTheDocument();

    rerender(<LandingPage connected={true} onDemo={vi.fn()} />);
    expect(screen.getByText('Bridge connected!')).toBeInTheDocument();
  });
});
