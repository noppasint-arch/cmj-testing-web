'use client';
import { create } from 'zustand';

export type Team = 'home' | 'away';

export interface PlayerConfig {
  id: string;
  team: Team;
  number: number;
  isGK: boolean;
}

export interface EntityPos {
  x: number; // 0–400 (court width units)
  y: number; // 0–200 (court height units)
}

export interface DrillStep {
  id: string;
  positions: Record<string, EntityPos>;
  duration: number; // ms to tween into this step
}

export interface DrillStore {
  players: PlayerConfig[];
  steps: DrillStep[];
  activeStep: number;
  isPlaying: boolean;
  playbackT: number; // 0–1 interpolation progress
  selectedEntity: string | null;

  addPlayer: (team: Team) => void;
  removePlayer: (id: string) => void;
  addStep: () => void;
  removeStep: (idx: number) => void;
  setActiveStep: (idx: number) => void;
  moveEntity: (entityId: string, x: number, y: number) => void;
  setPlaying: (v: boolean) => void;
  setPlaybackT: (t: number) => void;
  setSelectedEntity: (id: string | null) => void;
  setStepDuration: (idx: number, ms: number) => void;
  reset: () => void;
}

const BALL_ID = 'ball';

function makeId() {
  return Math.random().toString(36).slice(2, 8);
}

function defaultPlayers(): PlayerConfig[] {
  return [
    { id: 'h1', team: 'home', number: 1, isGK: true },
    { id: 'h2', team: 'home', number: 2, isGK: false },
    { id: 'h3', team: 'home', number: 3, isGK: false },
    { id: 'h4', team: 'home', number: 4, isGK: false },
    { id: 'h5', team: 'home', number: 5, isGK: false },
    { id: 'a1', team: 'away', number: 1, isGK: true },
    { id: 'a2', team: 'away', number: 2, isGK: false },
    { id: 'a3', team: 'away', number: 3, isGK: false },
    { id: 'a4', team: 'away', number: 4, isGK: false },
    { id: 'a5', team: 'away', number: 5, isGK: false },
  ];
}

function defaultPositions(players: PlayerConfig[]): Record<string, EntityPos> {
  const pos: Record<string, EntityPos> = {};
  // home team left side
  const homeXs = [30, 80, 80, 130, 130];
  const homeYs = [100, 60, 140, 55, 145];
  let hi = 0;
  // away team right side
  const awayXs = [370, 320, 320, 270, 270];
  const awayYs = [100, 60, 140, 55, 145];
  let ai = 0;

  for (const p of players) {
    if (p.team === 'home') {
      pos[p.id] = { x: homeXs[hi] ?? 100, y: homeYs[hi] ?? 100 };
      hi++;
    } else {
      pos[p.id] = { x: awayXs[ai] ?? 300, y: awayYs[ai] ?? 100 };
      ai++;
    }
  }
  pos[BALL_ID] = { x: 200, y: 100 };
  return pos;
}

const initialPlayers = defaultPlayers();
const initialPositions = defaultPositions(initialPlayers);

const initialStep: DrillStep = {
  id: makeId(),
  positions: initialPositions,
  duration: 1500,
};

export const BALL_ID_CONST = BALL_ID;

export const useDrillStore = create<DrillStore>((set, get) => ({
  players: initialPlayers,
  steps: [initialStep],
  activeStep: 0,
  isPlaying: false,
  playbackT: 0,
  selectedEntity: null,

  addPlayer: (team) => {
    const { players, steps } = get();
    const teamPlayers = players.filter(p => p.team === team);
    const num = teamPlayers.length + 1;
    const newId = `${team[0]}${makeId()}`;
    const newPlayer: PlayerConfig = { id: newId, team, number: num, isGK: false };
    const startX = team === 'home' ? 100 : 300;
    const newSteps = steps.map(s => ({
      ...s,
      positions: { ...s.positions, [newId]: { x: startX, y: 100 } },
    }));
    set({ players: [...players, newPlayer], steps: newSteps });
  },

  removePlayer: (id) => {
    const { players, steps } = get();
    const newSteps = steps.map(s => {
      const { [id]: _removed, ...rest } = s.positions;
      return { ...s, positions: rest };
    });
    set({ players: players.filter(p => p.id !== id), steps: newSteps });
  },

  addStep: () => {
    const { steps, activeStep } = get();
    const basePosIdx = Math.min(activeStep, steps.length - 1);
    const newStep: DrillStep = {
      id: makeId(),
      positions: { ...steps[basePosIdx].positions },
      duration: 1500,
    };
    const newSteps = [...steps.slice(0, activeStep + 1), newStep, ...steps.slice(activeStep + 1)];
    set({ steps: newSteps, activeStep: activeStep + 1 });
  },

  removeStep: (idx) => {
    const { steps, activeStep } = get();
    if (steps.length <= 1) return;
    const newSteps = steps.filter((_, i) => i !== idx);
    const newActive = Math.min(activeStep, newSteps.length - 1);
    set({ steps: newSteps, activeStep: newActive });
  },

  setActiveStep: (idx) => set({ activeStep: idx, isPlaying: false, playbackT: 0 }),

  moveEntity: (entityId, x, y) => {
    const { steps, activeStep } = get();
    const newSteps = steps.map((s, i) =>
      i === activeStep
        ? { ...s, positions: { ...s.positions, [entityId]: { x, y } } }
        : s
    );
    set({ steps: newSteps });
  },

  setPlaying: (v) => set({ isPlaying: v, playbackT: v ? 0 : 0 }),
  setPlaybackT: (t) => set({ playbackT: t }),
  setSelectedEntity: (id) => set({ selectedEntity: id }),

  setStepDuration: (idx, ms) => {
    const { steps } = get();
    const newSteps = steps.map((s, i) => (i === idx ? { ...s, duration: ms } : s));
    set({ steps: newSteps });
  },

  reset: () => {
    const players = defaultPlayers();
    const positions = defaultPositions(players);
    set({
      players,
      steps: [{ id: makeId(), positions, duration: 1500 }],
      activeStep: 0,
      isPlaying: false,
      playbackT: 0,
      selectedEntity: null,
    });
  },
}));
