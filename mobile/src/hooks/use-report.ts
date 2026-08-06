import type { ReportVisibility } from '@climbiq/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as reportsService from '@/services/reports';
import type { ReportDetail } from '@/services/reports';

const REPORT_KEY = ['report'];

export function useReport(id: string) {
  return useQuery({
    queryKey: [...REPORT_KEY, id],
    queryFn: () => reportsService.getReport(id),
  });
}

export function useReportArtifacts(id: string) {
  return useQuery({
    queryKey: [...REPORT_KEY, id, 'artifacts'],
    queryFn: () => reportsService.getReportArtifacts(id),
    // Artifacts are immutable once written; don't refetch on focus.
    staleTime: Infinity,
    retry: false,
  });
}

export function useSetReportVisibility(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visibility: ReportVisibility) =>
      reportsService.setReportVisibility(id, visibility),
    onSuccess: (_data, visibility) => {
      qc.setQueryData<ReportDetail>([...REPORT_KEY, id], (prev) =>
        prev ? { ...prev, report: { ...prev.report, visibility } } : prev,
      );
    },
  });
}

export function useDeleteReport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => reportsService.deleteReport(id),
    onSuccess: () => {
      // The report is gone everywhere it's derived from the reports table.
      qc.removeQueries({ queryKey: [...REPORT_KEY, id] });
      void qc.invalidateQueries({ queryKey: ['analyses'] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
      void qc.invalidateQueries({ queryKey: ['report-trends'] });
      void qc.invalidateQueries({ queryKey: ['analyzed-climb-ids'] });
    },
  });
}

export function useSetReportClimb(id: string, videoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (climbId: string | null) => reportsService.setReportClimb(id, videoId, climbId),
    onSuccess: (_data, climbId) => {
      qc.setQueryData<ReportDetail>([...REPORT_KEY, id], (prev) =>
        prev ? { ...prev, report: { ...prev.report, climb_id: climbId } } : prev,
      );
    },
  });
}
