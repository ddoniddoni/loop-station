const iconPaths = {
  wave: <path d="M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4" />,
  tracks: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  folder: <path d="M3 7V5a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
  mixer: <><path d="M5 3v5m0 4v9m7-18v10m0 4v4m7-18v3m0 4v11" /><path d="M2 8h6v4H2zm7 5h6v4H9zm7-7h6v4h-6z" /></>,
  settings: <><path d="m9 3-.7 2.2-2 .9-2.2-.5-1.7 2.8L4 10v3l-1.6 1.6 1.7 2.8 2.2-.5 2 .9L9 20h4l.7-2.2 2-.9 2.2.5 1.7-2.8L18 13v-3l1.6-1.6-1.7-2.8-2.2.5-2-.9L13 3Z" /><circle cx="11" cy="11.5" r="3" /></>,
  play: <path d="m8 5 11 7-11 7V5Z" />,
  stop: <rect x="5" y="5" width="14" height="14" rx="2" />,
  undo: <><path d="m9 5-5 5 5 5M4 10h10a6 6 0 0 1 0 12" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  loop: <><path d="M17 3l4 4-4 4M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4m14 0v2a2 2 0 0 1-2 2H3" /></>,
  upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></>,
  power: <><path d="M12 2v10M6.4 5.6a9 9 0 1 0 11.2 0" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
} as const;

export type StudioIconName = keyof typeof iconPaths;

export function StudioIcon({ name, size = 20 }: { name: StudioIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="station-icon">
      {iconPaths[name]}
    </svg>
  );
}
