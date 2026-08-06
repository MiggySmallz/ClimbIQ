// Account deletion. Hits the orchestrator's DELETE /me, which sweeps the user's
// R2 objects + avatar and cascade-deletes every owned row. The caller signs out
// afterward to clear the now-invalid local session.

import { apiVoid } from '@/lib/api';

export async function deleteAccount(): Promise<void> {
  await apiVoid('/me', { method: 'DELETE' });
}
