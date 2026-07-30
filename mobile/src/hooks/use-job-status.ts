// Live analysis-job status via Supabase realtime (spec §6, M3.16). Fetches the
// current row once, then subscribes to UPDATEs on it (queued → posted → running
// → done | error | timeout). RLS scopes the stream to the video owner.

import type { AnalysisJob } from '@climbiq/shared';
import { useEffect, useState } from 'react';

import { uniqueTopic } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';

export interface JobStatusState {
  job: AnalysisJob | null;
  /** True until the initial fetch resolves. */
  loading: boolean;
  error: boolean;
}

export function useJobStatus(jobId: string): JobStatusState {
  const [state, setState] = useState<JobStatusState>({ job: null, loading: true, error: false });

  useEffect(() => {
    let active = true;

    supabase
      .from('analysis_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setState({ job: (data as AnalysisJob) ?? null, loading: false, error: Boolean(error) });
      });

    const channel = supabase
      .channel(uniqueTopic(`job-${jobId}`))
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'analysis_jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          if (active) setState((s) => ({ ...s, job: payload.new as AnalysisJob, loading: false }));
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [jobId]);

  return state;
}
