import { Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { getInitials } from '@/lib/initials';

export type AvatarSize = 'sm' | 'md' | 'lg';

// sm: reserved for any future compact-list usage, not used yet. md: the "compact
// identity" size shared by Home's header and Settings' profile card — previously two
// different ad hoc sizes (44px plain circle on Home, heroui's 64px "lg" preset on
// Settings); normalized to one so both read as the same avatar treatment. lg: the
// profile detail screen's hero size (previously a heroui Avatar manually stretched to
// 96px via className) — kept at that same 96px here.
const SIZE_PX: Record<AvatarSize, number> = { sm: 40, md: 44, lg: 96 };
const TEXT_SIZE_PX: Record<AvatarSize, number> = { sm: 14, md: 16, lg: 32 };

// Background/foreground pairs pulled entirely from existing global.css tokens — the
// same pairing already used for priority badges (vivid background + a darker/high-
// contrast foreground of the same hue) — rather than inventing new hues for the
// avatar specifically. `link` is included as the "second navy" option: in the light
// theme it's the same hue as `--accent` at a darker lightness (45% vs 50.2%), i.e. a
// genuinely different weight of the app's one navy, not a duplicate.
const PALETTE_TOKENS = [
  '--personal', '--personal-foreground',
  '--important', '--important-foreground',
  '--flexible', '--flexible-foreground',
  '--critical', '--critical-foreground',
  '--accent', '--accent-foreground',
  '--link',
] as const;

// djb2 — a stable, simple string hash. Same name always produces the same index into
// the palette, so a given user's avatar colour never changes between renders, screens,
// or sessions (no per-render randomness, which would just flicker between colours).
function hashString(input: string): number {
  let hash = 5381;
  for (let index = 0; index < input.length; index++) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return Math.abs(hash);
}

type AvatarProps = {
  /** Drives both the initials (via lib/initials.ts#getInitials) and the deterministic colour — pass the user's name, or their userId as a stand-in while name is still loading, so the colour doesn't jump once the name arrives. */
  name: string;
  size?: AvatarSize;
  className?: string;
};

// The one avatar — a stable, name-derived colour instead of a flat muted circle, so it
// reads as the student's own identity mark rather than a generic placeholder. See
// CLAUDE.md for where this is used (Home header, Settings profile card, profile detail
// screen) — reach for this anywhere else an avatar is needed too, not a new one-off.
export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const colors = useCSSVariable([...PALETTE_TOKENS]) as string[];
  const [personal, personalFg, important, importantFg, flexible, flexibleFg, critical, criticalFg, accent, accentFg, link] = colors;

  const palette = [
    { background: personal, foreground: personalFg },
    { background: important, foreground: importantFg },
    { background: flexible, foreground: flexibleFg },
    { background: critical, foreground: criticalFg },
    { background: accent, foreground: accentFg },
    { background: link, foreground: accentFg },
  ];

  const { background, foreground } = palette[hashString(name || 'student') % palette.length];
  const box = SIZE_PX[size];

  return (
    <View
      className={['items-center justify-center rounded-full', className].filter(Boolean).join(' ')}
      style={{ width: box, height: box, backgroundColor: background }}>
      <Text style={{ color: foreground, fontSize: TEXT_SIZE_PX[size] }} className="font-semibold">
        {getInitials(name) || '?'}
      </Text>
    </View>
  );
}
