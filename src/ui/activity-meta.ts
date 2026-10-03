import type { Activity } from '../types';

export const ACTIVITY_META: Record<Activity, { label: string; color: string; place: string }> = {
  planning: { label: 'Planning', color: '#60a5fa', place: 'Architect Guild' },
  delegating: { label: 'Delegating', color: '#818cf8', place: 'Architect Guild' },
  coding: { label: 'Coding', color: '#f97316', place: 'The Forge' },
  writing: { label: 'Writing docs', color: '#e879f9', place: 'Scriptorium' },
  testing: { label: 'Testing', color: '#22c55e', place: 'The Arena' },
  debugging: { label: 'Debugging', color: '#84cc16', place: 'Apothecary' },
  researching: { label: 'Reading code', color: '#a78bfa', place: 'The Library' },
  browsing: { label: 'Browsing', color: '#38bdf8', place: 'Observatory' },
  reviewing: { label: 'Reviewing', color: '#facc15', place: 'Watchtower' },
  committing: { label: 'Git & PRs', color: '#fb923c', place: 'Rune Post' },
  installing: { label: 'Installing', color: '#fde047', place: 'The Mine' },
  deploying: { label: 'Deploying', color: '#c084fc', place: 'Sky Gate' },
  waiting: { label: 'Waiting for you', color: '#fb4f6b', place: 'Town Hall' },
  remembering: { label: 'Remembering', color: '#67e8f9', place: 'Well of Memory' },
  idle: { label: 'Idle', color: '#94a3b8', place: 'Campfire' },
};
