// Small line icons used across the interface. They take the text colour.
const Icon = ({ d, fill }: { d: string; fill?: boolean }) => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" {...(fill ? { fill: "currentColor" } : { fill: "none", stroke: "currentColor" })}>
    <path d={d} />
  </svg>
);

export const PlayIcon = () => <Icon fill d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />;
export const BackIcon = () => <Icon d="M15 5l-7 7 7 7" />;
export const ChevronLeft = () => <Icon d="M15 5l-7 7 7 7" />;
export const ChevronRight = () => <Icon d="M9 5l7 7-7 7" />;
export const ChevronDown = () => <Icon d="M5 9l7 7 7-7" />;
export const SettingsIcon = () => (
  <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4z" />
);
export const RefreshIcon = () => <Icon d="M20 11a8 8 0 0 0-14.6-4.5M4 4v3h3M4 13a8 8 0 0 0 14.6 4.5M20 20v-3h-3" />;
export const CloseIcon = () => <Icon d="M6 6l12 12M18 6L6 18" />;
export const InfoIcon = () => <Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5" />;
export const FolderIcon = () => <Icon d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />;
export const CheckIcon = () => <Icon d="M5 12.5l4.5 4.5L19 7.5" />;
export const EditIcon = () => <Icon d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />;

// Player
export const PauseIcon = () => <Icon fill d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />;
export const NextIcon = () => <Icon fill d="M5.5 5.6v12.8a.8.8 0 0 0 1.2.7l9.3-6.4a.8.8 0 0 0 0-1.4L6.7 4.9a.8.8 0 0 0-1.2.7zM17 5h2.5v14H17z" />;
export const VolumeIcon = () => <Icon d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />;
export const VolumeLowIcon = () => <Icon d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6" />;
export const MuteIcon = () => <Icon d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5" />;
export const SubtitlesIcon = () => (
  <Icon d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17V7a1.5 1.5 0 0 1 1.5-1.5zM7 11.5h3M12.5 11.5H17M7 14.5h6.5M15.5 14.5H17" />
);
export const ChaptersIcon = () => <Icon d="M9 6h11M9 12h11M9 18h11M4.5 6h.5M4.5 12h.5M4.5 18h.5" />;
export const SpeedIcon = () => <Icon d="M5 18.5a8.5 8.5 0 1 1 14 0M12 13.5l4-4.5" />;
export const FullscreenIcon = () => <Icon d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />;
export const ExitFullscreenIcon = () => <Icon d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />;
/** A screen with a small picture in its corner: the mini player. */
export const MiniPlayerIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor">
    <path d="M20.5 11V6a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 6v12A1.5 1.5 0 0 0 5 19.5h5" />
    <rect x="13" y="13.5" width="8" height="6" rx="1" fill="currentColor" />
  </svg>
);
/** Back from the mini player to the big one. */
export const LeaveMiniIcon = () => <Icon d="M4 10V4h6M4 4l7 7M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V14" />;
export const EyeIcon = () => <Icon d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />;

/** Circular arrow with "10" inside: jump back (or forward) ten seconds. */
export const Skip10Icon = ({ forward }: { forward?: boolean }) => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" style={forward ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 3.5v3.7h3.7" fill="none" stroke="currentColor" />
    <text x="12" y="15.3" textAnchor="middle" fontSize="8" fontWeight="800" fill="currentColor" style={forward ? { transform: "scaleX(-1)", transformOrigin: "12px 12px" } : undefined}>
      10
    </text>
  </svg>
);

export const SearchIcon = () => <Icon d="M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM16 16l5 5" />;
export const DiceIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor">
    <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
    <g fill="currentColor" stroke="none">
      <circle cx="8.5" cy="8.5" r="1.6" />
      <circle cx="15.5" cy="8.5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="8.5" cy="15.5" r="1.6" />
      <circle cx="15.5" cy="15.5" r="1.6" />
    </g>
  </svg>
);
export const UndoIcon = () => <Icon d="M4 10h11a5 5 0 0 1 0 10h-3M4 10l4-4M4 10l4 4" />;
export const CameraIcon = () => (
  <Icon d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
);
