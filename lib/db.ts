import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Athlete {
  id: string;
  name: string;
  sport?: string;
  team?: string;
  dob?: string;
  bodyWeight?: number;
  profileImageUri?: string;
  createdAt: string;
}

export interface CMJTest {
  id: string;
  athleteId: string;
  videoBlob?: Blob;
  videoUrl?: string;
  takeoffFrame: number;
  landingFrame: number;
  movementStartFrame?: number;
  videoFPS: number;
  jumpHeight_cm: number;
  flightTime_ms: number;
  RSImod?: number;
  notes?: string;
  createdAt: string;
}

interface CMJSchema extends DBSchema {
  athletes: { key: string; value: Athlete };
  tests: { key: string; value: CMJTest; indexes: { 'by-athlete': string } };
}

let dbPromise: Promise<IDBPDatabase<CMJSchema>> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<CMJSchema>('cmj-app', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('athletes', { keyPath: 'id' });
          const testStore = db.createObjectStore('tests', { keyPath: 'id' });
          testStore.createIndex('by-athlete', 'athleteId');
        }
      },
    });
  }
  return dbPromise;
}

// ── Athletes ──────────────────────────────────────────────────────────────────
export async function getAthletes(): Promise<Athlete[]> {
  const db = await getDb();
  const all = await db.getAll('athletes');
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveAthlete(athlete: Athlete): Promise<void> {
  const db = await getDb();
  await db.put('athletes', athlete);
}

export async function deleteAthlete(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('athletes', id);
}

// ── Tests ─────────────────────────────────────────────────────────────────────
export async function getTests(): Promise<CMJTest[]> {
  const db = await getDb();
  const all = await db.getAll('tests');
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAthleteTests(athleteId: string): Promise<CMJTest[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('tests', 'by-athlete', athleteId);
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function saveTest(test: CMJTest): Promise<void> {
  const db = await getDb();
  await db.put('tests', test);
}

export async function deleteTest(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('tests', id);
}

export async function getTest(id: string): Promise<CMJTest | undefined> {
  const db = await getDb();
  return db.get('tests', id);
}
