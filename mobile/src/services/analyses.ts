// Analysis history for the Analyze tab (spec §5/§6). Every clip the user has
// sent for analysis, in-flight or finished, so leaving the status screen never
// loses track of a run. Sourced from `analysis_jobs` (covers queued/running/
// failed too, not just completed reports); RLS scopes rows to the video owner.

import type { JobStatus } from '@climbiq/shared';

import { supabase } from '@/lib/supabase';

export interface AnalysisListItem {
  id: string;
  status: JobStatus;
  report_id: string | null;
  created_at: string;
  video: { id: string; climb_id: string | null; duration_s: number | null } | null;
}

export async function listAnalyses(): Promise<AnalysisListItem[]> {
  const { data, error } = await supabase
    .from('analysis_jobs')
    .select('id, status, report_id, created_at, video:videos(id, climb_id, duration_s)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as unknown as AnalysisListItem[];
}
