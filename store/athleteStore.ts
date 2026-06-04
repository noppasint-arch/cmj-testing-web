import { create } from 'zustand';
import { Athlete, getAthletes, saveAthlete, deleteAthlete } from '@/lib/db';

interface AthleteStore {
  athletes: Athlete[];
  load: () => Promise<void>;
  upsert: (a: Athlete) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useAthleteStore = create<AthleteStore>((set) => ({
  athletes: [],
  load: async () => {
    const athletes = await getAthletes();
    set({ athletes });
  },
  upsert: async (athlete) => {
    await saveAthlete(athlete);
    const athletes = await getAthletes();
    set({ athletes });
  },
  remove: async (id) => {
    await deleteAthlete(id);
    const athletes = await getAthletes();
    set({ athletes });
  },
}));
