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
