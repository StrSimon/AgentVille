import { act, fireEvent, render, screen } from '@testing-library/react';
import { store } from '../state/store';
import type { Controller } from '../state/controller';
import type { PendingRequest } from '../types';
import { makeAgent } from '../test-utils';
import { AppContext, type AppApi } from './app-context';
import { Inbox } from './Inbox';

function setup() {
  const controller = {
    mode: 'demo',
    respond: vi.fn(async () => true),
    sendOrder: vi.fn(async () => true),
    setLeash: vi.fn(async () => true),
  } as unknown as Controller;
  const api = {
    controller, mode: 'demo', hosted: false, selectedId: null, select: vi.fn(), focus: vi.fn(),
    overlay: 'none', setOverlay: vi.fn(), timeMode: 'auto', setTimeMode: vi.fn(), switchMode: vi.fn(),
  } as AppApi;
  render(<AppContext.Provider value={api}><Inbox /></AppContext.Provider>);
  return { controller, api };
}

const permission: PendingRequest = {
  id: 'r1', agentId: 'a1', kind: 'permission', source: 'claude', name: 'Grimdur', tool: 'Bash',
  command: 'git push origin main', createdAt: Date.now(), deadline: Date.now() + 45_000,
};

describe('Inbox', () => {
  beforeEach(() => store.reset());

  it('should render nothing when nobody waits', () => {
    act(() => store.dispatch({ type: 'snapshot', agents: [makeAgent()], buildings: [], requests: [], stats: null as never, settings: null as never }));
    setup();
    expect(screen.queryByLabelText(/dwarves waiting for you/i)).not.toBeInTheDocument();
  });

  it('should approve a permission request from the card', () => {
    act(() => store.dispatch({
      type: 'snapshot',
      agents: [makeAgent({ attention: { kind: 'permission', since: Date.now(), requestId: 'r1', text: 'git push' } })],
      buildings: [], requests: [permission], stats: null as never, settings: null as never,
    }));
    const { controller } = setup();
    expect(screen.getByText('git push origin main')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /allow/i }));
    expect(controller.respond).toHaveBeenCalledWith('r1', { decision: 'allow' });
  });

  it('should hand a request back to the terminal', () => {
    act(() => store.dispatch({
      type: 'snapshot',
      agents: [makeAgent({ attention: { kind: 'permission', since: Date.now(), requestId: 'r1' } })],
      buildings: [], requests: [permission], stats: null as never, settings: null as never,
    }));
    const { controller } = setup();
    fireEvent.click(screen.getByRole('button', { name: /answer in the terminal/i }));
    expect(controller.respond).toHaveBeenCalledWith('r1', { release: true });
  });

  it('should answer a question with the chosen option', () => {
    const q: PendingRequest = { ...permission, id: 'q1', kind: 'question', questions: [{ question: 'Which DB?', options: [{ label: 'Postgres' }, { label: 'SQLite' }] }] };
    act(() => store.dispatch({
      type: 'snapshot',
      agents: [makeAgent({ attention: { kind: 'question', since: Date.now(), requestId: 'q1' } })],
      buildings: [], requests: [q], stats: null as never, settings: null as never,
    }));
    const { controller } = setup();
    const send = screen.getByRole('button', { name: /send answer/i });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /sqlite/i }));
    fireEvent.click(send);
    expect(controller.respond).toHaveBeenCalledWith('q1', { answers: { 'Which DB?': 'SQLite' } });
  });

  it('should let you put a finished dwarf on the leash and send orders', () => {
    act(() => store.dispatch({
      type: 'snapshot',
      agents: [makeAgent({ busy: false, attention: { kind: 'done', since: Date.now() } })],
      buildings: [], requests: [], stats: null as never, settings: null as never,
    }));
    const { controller } = setup();
    expect(screen.getByText(/waiting for your reply/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /wait for orders/i }));
    expect(controller.setLeash).toHaveBeenCalledWith('a1', true);
    fireEvent.change(screen.getByLabelText(/send orders to grimdur/i), { target: { value: 'Write the changelog' } });
    fireEvent.click(screen.getByRole('button', { name: /^send orders$/i }));
    expect(controller.sendOrder).toHaveBeenCalledWith('a1', 'Write the changelog');
  });
});
