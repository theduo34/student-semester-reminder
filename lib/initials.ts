// First + last word only, regardless of how many name parts exist — "Kwame Nkrumah
// Ofori-Atta" is "KO", not "KNO". A single-word name falls back to its one initial.
// Used anywhere an avatar shows initials (Settings, profile detail, Home) — don't
// inline this per screen.
export function getInitials(name: string | undefined | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}
