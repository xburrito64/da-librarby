// Texts a theme may replace with its own (see `extras.copy` in themes.ts).
import { useThemeInfo } from "./theme";

export interface Copy {
  /** The search box, empty. */
  searchPlaceholder: string;
  /** A search that found nothing. */
  searchNone: string;
  /** No library folders yet. */
  emptyTitle: string;
  emptyText: string;
  /** Folders added, but no videos found (yet). */
  emptyScanTitle: string;
  emptyScanText: string;
  /** Shown in the navigation while folders are scanned; `place` is the folder, or "". */
  scanning: (place: string) => string;
  /** Lines shown, one at random, at the end of the home screen. None by default. */
  homeEnd: string[];
  /** Used instead of `homeEnd` between midnight and 5 in the morning. */
  lateNight: string[];
  /** Added to `homeEnd` in December. */
  december: string[];
  /** Searching for exactly one of these words (lower case) shows its message. */
  searchSecrets: Record<string, string>;
  /** Clicking the app's name while already on Home says these, one after another. */
  brandLines: string[];
}

export const COPY: Copy = {
  searchPlaceholder: "Search",
  searchNone: "Nothing found. Try another word.",
  emptyTitle: "Your library is empty",
  emptyText: "Add the folders or drives where your anime, shows and movies live, and they'll appear here.",
  emptyScanTitle: "Nothing here yet",
  emptyScanText: "No videos were found in your folders so far. If a scan is running, they'll show up in a moment.",
  scanning: (place) => `Scanning${place ? ` ${place}` : ""}…`,
  homeEnd: [],
  lateNight: [],
  december: [],
  searchSecrets: {},
  brandLines: [],
};

export function useCopy(): Copy {
  const theme = useThemeInfo();
  return { ...COPY, ...theme?.extras?.copy };
}
