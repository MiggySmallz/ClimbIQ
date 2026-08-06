/**
 * ClimbIQ design system — tokens transcribed from the "ClimbIQ Mockups" design comp.
 *
 * Athletic-performance direction: heavy display type (Space Grotesk), mono numbers
 * (JetBrains Mono), blue primary / warm-orange data accent, grade-ramp color coding,
 * traffic-light severity. Light + dark palettes.
 */

export type Palette = {
  /** page background behind cards */
  bg: string;
  /** primary card surface */
  card: string;
  /** secondary / inset surface */
  card2: string;
  /** primary text */
  ink: string;
  /** secondary text */
  ink2: string;
  /** tertiary / hint text */
  ink3: string;
  /** hairline borders */
  line: string;
  /** primary blue */
  accent: string;
  /** warm-orange data accent */
  accent2: string;
  good: string;
  warn: string;
  bad: string;
  /** neutral chip fill */
  chip: string;
  /** outermost canvas (behind bg) */
  canvas: string;
  /** shadow color for elevation */
  shadowColor: string;
};

export const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    bg: '#f2f2ef',
    card: '#ffffff',
    card2: '#f7f7f4',
    ink: '#0c0d10',
    ink2: '#6a6d76',
    ink3: '#9b9ea6',
    line: '#e4e4df',
    accent: '#3D81DC',
    accent2: '#F0803C',
    good: '#17a05a',
    warn: '#e8a600',
    bad: '#e0322a',
    chip: '#f0f0ec',
    canvas: '#e9e9e6',
    shadowColor: 'rgba(12,13,16,1)',
  },
  dark: {
    bg: '#0a0a0c',
    card: '#15161a',
    card2: '#1c1d22',
    ink: '#f6f6f4',
    ink2: '#9a9ca5',
    ink3: '#6d707a',
    line: '#272930',
    accent: '#5B9AEB',
    accent2: '#FF9552',
    good: '#2bbd74',
    warn: '#f0b429',
    bad: '#f0554c',
    chip: '#23252b',
    canvas: '#121215',
    shadowColor: 'rgba(0,0,0,1)',
  },
};

/**
 * Grade-ramp hues (easy → hard). These are theme-independent brand colors — the
 * same V5 blue reads on light and dark. Used for grade badges, pyramid bars and
 * the est-grade tile.
 */
export const GRADE_COLORS: Record<string, string> = {
  VB: '#14b8a6',
  V0: '#14b8a6',
  V1: '#10b981',
  V2: '#22a06b',
  V3: '#65a30d',
  V4: '#0e7490',
  V5: '#1d4ed8',
  V6: '#4f46e5',
  V7: '#7c3aed',
  V8: '#9333ea',
  V9: '#ff4d1c',
  V10: '#f43f2e',
  V11: '#dc2626',
  V12: '#dc2626',
};

/** Color for an arbitrary grade string (e.g. "V5", "v5", "5", "VB"). */
export function gradeColor(grade: string | number | null | undefined): string {
  if (grade === null || grade === undefined) return '#9b9ea6';
  const raw = String(grade).trim().toUpperCase();
  const key = raw.startsWith('V') ? raw : `V${raw}`;
  if (GRADE_COLORS[key]) return GRADE_COLORS[key];
  // Clamp numeric grades above the ramp to the hardest hue.
  const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  if (!Number.isNaN(n)) return n >= 12 ? GRADE_COLORS.V12 : GRADE_COLORS.V0;
  return '#9b9ea6';
}

/** Matches the shared report contract's severity vocabulary. */
/** Numeric rank for a V-grade (VB=0, V0=1, V1=2, …) for computing deltas. */
export function gradeRank(grade: string | null | undefined): number | null {
  if (!grade) return null;
  const raw = String(grade).trim().toUpperCase();
  if (raw === 'VB') return 0;
  const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(n) ? null : n + 1;
}

export type Severity = 'high' | 'medium' | 'low';

/** Severity → { fg (text/dot), bg (chip fill) } resolved against the palette. */
export function severityColors(sev: Severity, p: Palette): { fg: string; bg: string } {
  switch (sev) {
    case 'high':
      return { fg: p.bad, bg: 'rgba(224,50,42,0.14)' };
    case 'medium':
      return { fg: p.warn, bg: 'rgba(232,166,0,0.16)' };
    case 'low':
      return { fg: p.good, bg: 'rgba(23,160,90,0.14)' };
  }
}

/** Short uppercase label for a severity chip. */
export function severityLabel(sev: Severity): string {
  return sev === 'medium' ? 'MED' : sev.toUpperCase();
}

/** Corner radii used across the system. */
export const radius = {
  chip: 999,
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  card: 18,
} as const;

/** Standard elevated-card shadow, resolved against the palette. */
export function cardShadow(p: Palette) {
  return {
    shadowColor: p.shadowColor,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: p === palettes.dark ? 0.5 : 0.12,
    shadowRadius: 24,
    elevation: 8,
  };
}
