import { create } from 'zustand';
import { CMJTest, getTests, saveTest, deleteTest, getAthleteTests } from '@/lib/db';

interface TestStore {
  tests: CMJTest[];
  load: () => Promise<void>;
  upsert: (t: CMJTest) => Promise<void>;
  remove: (id: string) => Promise<void>;
  getAthleteTests: (athleteId: string) => CMJTest[];
}

export const useTestStore = create<TestStore>((set, get) => ({
  tests: [],
  load: async () => {
    const tests = await getTests();
    set({ tests });
  },
  upsert: async (test) => {
    await saveTest(test);
    const tests = await getTests();
    set({ tests });
  },
  remove: async (id) => {
    await deleteTest(id);
    const tests = await getTests();
    set({ tests });
  },
  getAthleteTests: (athleteId) =>
    get().tests.filter((t) => t.athleteId === athleteId),
}));
