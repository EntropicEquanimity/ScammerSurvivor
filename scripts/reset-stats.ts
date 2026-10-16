// Zeroes the live About counter: Firestore doc stats/global goes back to zero counts, nothing else.
// The doc holds counts only (no message, day id or player), so a reset loses no player data.
// Run before freeze: GOOGLE_CLOUD_PROJECT=<project> node scripts/reset-stats.ts
// A running instance keeps the total it read at boot until it restarts, so redeploy or restart after.
import type { Firestore } from '@google-cloud/firestore';
import { DOC, EMPTY } from '../server/routes/stats.ts';

// The slice of Firestore this needs, so the test passes a fake.
export type StatsDb = Pick<Firestore, 'doc'>;

export async function resetGlobalStats(db: StatsDb): Promise<void> {
  // A full set, not a merge: every country count goes, not only the ones named here.
  await db.doc(DOC).set({ ...EMPTY, scamsCaught: { ...EMPTY.scamsCaught }, realTrusted: { ...EMPTY.realTrusted }, countries: {} });
}

async function main(): Promise<void> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT is not set');
  const { Firestore } = await import('@google-cloud/firestore');
  await resetGlobalStats(new Firestore({ projectId }));
  console.log(`${DOC} reset to zero`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('reset-stats failed:', (error as Error).name);
    process.exitCode = 1;
  });
}
