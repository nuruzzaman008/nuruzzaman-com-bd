import { cn } from '@/lib/cn';

/**
 * The generated cover used when a post, course or product has no uploaded
 * image.
 *
 * An empty grey box reads as a broken image, so instead each topic gets a
 * blueprint-style line drawing of the thing the topic is about. The drawing is
 * decorative and inline (no network request, no layout shift), and it is chosen
 * from the record's own taxonomy rather than at random, so the same article
 * always looks the same.
 *
 * These are illustrations, not engineering drawings: they carry no dimensions,
 * no bar marks and no values, so nothing here can be mistaken for a detail to
 * build from.
 */

type Glyph = (accent: string) => React.ReactNode;

const stroke = {
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Isolated footing in section, with the column stub and the ground line. */
const footing: Glyph = (accent) => (
  <g {...stroke} strokeWidth={2}>
    <path d="M60 96h280" stroke="#ffffff" strokeOpacity={0.25} strokeDasharray="6 6" />
    <path d="M178 40v56M222 40v56" stroke="#ffffff" strokeOpacity={0.75} />
    <path d="M178 96h44" stroke="#ffffff" strokeOpacity={0.75} />
    <path d="M130 118h140v34H130zM110 152h180v22H110z" stroke={accent} strokeWidth={2.5} />
    <path d="M178 96v22M222 96v22" stroke={accent} strokeWidth={2.5} />
    <g stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.5}>
      <path d="M120 168h160" strokeDasharray="3 5" />
      <path d="M124 174v6M154 174v6M184 174v6M214 174v6M244 174v6M274 174v6" />
    </g>
  </g>
);

/** RCC beam elevation: two layers of bars and the stirrup spacing. */
const beam: Glyph = (accent) => (
  <g {...stroke} strokeWidth={2}>
    <path d="M70 84h260v58H70z" stroke={accent} strokeWidth={2.5} />
    <path d="M82 96h236M82 130h236" stroke="#ffffff" strokeOpacity={0.8} />
    <g stroke="#ffffff" strokeOpacity={0.45} strokeWidth={1.5}>
      <path d="M96 92v42M120 92v42M144 92v42M168 92v42M200 92v42M232 92v42M256 92v42M280 92v42M304 92v42" />
    </g>
    <path d="M56 84v58M344 84v58" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1.5} />
    <path d="M70 160h260" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="4 6" />
  </g>
);

/** Portal frame under lateral load. */
const frame: Glyph = (accent) => (
  <g {...stroke} strokeWidth={2.5}>
    <path d="M110 62h180M110 62v98M290 62v98" stroke={accent} />
    <path d="M92 160h36M272 160h36" stroke="#ffffff" strokeOpacity={0.7} strokeWidth={2} />
    <path d="M96 168l8-8M108 168l8-8M120 168l8-8M276 168l8-8M288 168l8-8M300 168l8-8" stroke="#ffffff" strokeOpacity={0.4} strokeWidth={1.5} />
    <path d="M110 110h180" stroke="#ffffff" strokeOpacity={0.25} strokeWidth={1.5} strokeDasharray="4 6" />
    <g stroke="#ffffff" strokeOpacity={0.8} strokeWidth={2}>
      <path d="M64 62h34M64 62l10-7M64 62l10 7" />
      <path d="M64 110h34M64 110l10-7M64 110l10 7" />
    </g>
  </g>
);

/** AutoCAD crosshair over a dimensioned rectangle. */
const cad: Glyph = (accent) => (
  <g {...stroke} strokeWidth={2}>
    <path d="M100 68h150v76H100z" stroke={accent} strokeWidth={2.5} />
    <path d="M100 162h150M100 156v12M250 156v12" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={1.5} />
    <path d="M276 68v76M270 68h12M270 144h12" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={1.5} />
    <path d="M175 44v128M56 106h268" stroke="#ffffff" strokeOpacity={0.3} strokeWidth={2} />
    <path d="M160 91h30v30h-30z" stroke="#ffffff" strokeOpacity={0.85} strokeWidth={2} />
  </g>
);

/** A software window with a tool ribbon. */
const software: Glyph = (accent) => (
  <g {...stroke} strokeWidth={2}>
    <path d="M76 56h248v118H76z" stroke={accent} strokeWidth={2.5} />
    <path d="M76 82h248" stroke={accent} strokeWidth={2} />
    <g stroke="#ffffff" strokeOpacity={0.7} strokeWidth={2}>
      <path d="M96 100h44v34H96zM158 100h44v34h-44zM220 100h44v34h-44z" />
    </g>
    <g stroke="#ffffff" strokeOpacity={0.4} strokeWidth={1.5}>
      <path d="M96 152h168" />
      <path d="M92 69h10M110 69h10M128 69h10" />
    </g>
  </g>
);

/** A code volume with a checked clause. */
const code: Glyph = (accent) => (
  <g {...stroke} strokeWidth={2}>
    <path d="M200 62c-22-12-48-14-70-8v90c22-6 48-4 70 8 22-12 48-14 70-8V54c-22-6-48-4-70 8z" stroke={accent} strokeWidth={2.5} />
    <path d="M200 62v90" stroke={accent} strokeWidth={2} />
    <g stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.5}>
      <path d="M146 82h38M146 98h38M146 114h30M216 82h38M216 98h30" />
    </g>
    <path d="M214 122l10 10 22-24" stroke="#ffffff" strokeOpacity={0.9} strokeWidth={2.5} />
  </g>
);

/** Slump cone and a test cylinder. */
const quality: Glyph = (accent) => (
  <g {...stroke} strokeWidth={2}>
    <path d="M60 158h280" stroke="#ffffff" strokeOpacity={0.3} strokeWidth={1.5} />
    <path d="M140 158l22-84h34l22 84z" stroke={accent} strokeWidth={2.5} />
    <path d="M162 74h34" stroke={accent} strokeWidth={2.5} />
    <path d="M236 90h48v68h-48z" stroke="#ffffff" strokeOpacity={0.75} strokeWidth={2} />
    <path d="M236 90c0-6 11-10 24-10s24 4 24 10" stroke="#ffffff" strokeOpacity={0.75} strokeWidth={2} />
    <g stroke="#ffffff" strokeOpacity={0.4} strokeWidth={1.5}>
      <path d="M242 112h36M242 130h36" />
    </g>
    <path d="M96 132l12 12 26-30" stroke="#ffffff" strokeOpacity={0.85} strokeWidth={2.5} />
  </g>
);

/** A cadastral plot layout with a north arrow. */
const mouza: Glyph = (accent) => (
  <g {...stroke} strokeWidth={2}>
    <path d="M74 66l84-14 96 20 76-16v112l-76 16-96-20-84 14z" stroke={accent} strokeWidth={2.5} />
    <path d="M158 52v134M254 72v130" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.5} />
    <path d="M74 118l84-10 96 18 76-14" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.5} />
    <g stroke="#ffffff" strokeOpacity={0.85} strokeWidth={2}>
      <path d="M312 44v28M312 44l-7 10M312 44l7 10" />
    </g>
  </g>
);

/** A quantity take-off sheet with a totalled column. */
const estimate: Glyph = (accent) => (
  <g {...stroke} strokeWidth={2}>
    <path d="M108 48h184v130H108z" stroke={accent} strokeWidth={2.5} />
    <path d="M108 76h184M188 48v130M244 48v130" stroke={accent} strokeWidth={2} />
    <g stroke="#ffffff" strokeOpacity={0.45} strokeWidth={1.5}>
      <path d="M108 100h184M108 124h184M108 148h184" />
      <path d="M124 62h40M204 62h24M258 62h24" />
    </g>
    <path d="M258 160h26" stroke="#ffffff" strokeOpacity={0.9} strokeWidth={2.5} />
  </g>
);

/** Rolled steel section with a bolted end plate. */
const steel: Glyph = (accent) => (
  <g {...stroke} strokeWidth={2}>
    <path d="M132 62h136M132 62v14h54v74h-54v14h136v-14h-54V76h54V62" stroke={accent} strokeWidth={2.5} />
    <path d="M296 54h22v116h-22z" stroke="#ffffff" strokeOpacity={0.75} strokeWidth={2} />
    <g fill="#ffffff" fillOpacity={0.75} stroke="none">
      <circle cx={307} cy={74} r={4} />
      <circle cx={307} cy={102} r={4} />
      <circle cx={307} cy={124} r={4} />
      <circle cx={307} cy={152} r={4} />
    </g>
    <path d="M96 62v102" stroke="#ffffff" strokeOpacity={0.4} strokeWidth={1.5} strokeDasharray="4 6" />
  </g>
);

/** Generic: a compass rose over the grid, for anything untagged. */
const generic: Glyph = (accent) => (
  <g {...stroke} strokeWidth={2}>
    <circle cx={200} cy={112} r={54} stroke={accent} strokeWidth={2.5} />
    <circle cx={200} cy={112} r={30} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1.5} />
    <path d="M200 46v132M134 112h132" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.5} />
    <path d="M200 62l14 50-14 50-14-50z" stroke="#ffffff" strokeOpacity={0.85} strokeWidth={2} />
  </g>
);

/**
 * Topic key -> drawing. Keys are the seeded category and course-track slugs;
 * anything unmatched falls through to `generic`, so a new topic renders a valid
 * cover on the day it is created rather than an empty box.
 */
const GLYPHS: Record<string, { glyph: Glyph; accent: string }> = {
  'foundation-geotechnical': { glyph: footing, accent: '#f6b73c' },
  'rcc-design-detailing': { glyph: beam, accent: '#4da3ff' },
  'structural-engineering': { glyph: frame, accent: '#5ad1c8' },
  'autocad-productivity': { glyph: cad, accent: '#f6b73c' },
  'engineering-software': { glyph: software, accent: '#4da3ff' },
  'bnbc-code-application': { glyph: code, accent: '#5ad1c8' },
  'construction-quality': { glyph: quality, accent: '#f6b73c' },
  'mouza-drawing-workflow': { glyph: mouza, accent: '#4da3ff' },
  'quantity-estimation': { glyph: estimate, accent: '#5ad1c8' },
  'steel-design': { glyph: steel, accent: '#f6b73c' },
};

export type CoverArtProps = {
  /** Category or track slug. Unknown values fall back to the generic drawing. */
  topic?: string | null;
  /** Shown inside the drawing so a wall of covers stays scannable. */
  label?: string | null;
  className?: string;
};

export function CoverArt({ topic, label, className }: CoverArtProps) {
  const { glyph, accent } = GLYPHS[topic ?? ''] ?? { glyph: generic, accent: '#4da3ff' };
  // Scopes the gradient and pattern ids so several covers on one page cannot
  // collide with each other.
  const id = `cover-${topic ?? 'generic'}`;

  return (
    <svg
      viewBox="0 0 400 225"
      className={cn('aspect-[16/9] w-full', className)}
      // Decorative: the card heading already names the article, so a
      // description here would only repeat it to a screen reader.
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#123059" />
          <stop offset="100%" stopColor="#0b1f3b" />
        </linearGradient>
        <pattern id={`${id}-grid`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0v20" fill="none" stroke="#ffffff" strokeOpacity={0.07} strokeWidth={1} />
        </pattern>
      </defs>

      <rect width="400" height="225" fill={`url(#${id}-bg)`} />
      <rect width="400" height="225" fill={`url(#${id}-grid)`} />

      {glyph(accent)}

      {label ? (
        <text
          x="20"
          y="207"
          fill="#ffffff"
          fillOpacity={0.55}
          fontSize="11"
          fontWeight="600"
          letterSpacing="0.08em"
        >
          {label}
        </text>
      ) : null}
    </svg>
  );
}
