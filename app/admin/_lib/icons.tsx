import type { ReactNode } from "react";

type IconProps = { s?: number; sw?: number; fill?: string; children?: ReactNode };

export function Icon({ s = 16, sw = 1.6, fill, children }: IconProps) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill={fill || "none"}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

export const I = {
  search: (p: IconProps = {}) => (
    <Icon {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  ),
  bell: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </Icon>
  ),
  help: (p: IconProps = {}) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.01" />
    </Icon>
  ),
  cog: (p: IconProps = {}) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.4l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </Icon>
  ),
  plus: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  ),
  doc: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8M8 17h6" />
    </Icon>
  ),
  download: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M12 4v12M6 12l6 6 6-6M4 21h16" />
    </Icon>
  ),
  up: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="m6 15 6-6 6 6" />
    </Icon>
  ),
  edit: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </Icon>
  ),
  trash: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
    </Icon>
  ),
  link: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.3 7" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7L12.7 17" />
    </Icon>
  ),
  mail: (p: IconProps = {}) => (
    <Icon {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 7 9-7" />
    </Icon>
  ),
  phone: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </Icon>
  ),
  cal: (p: IconProps = {}) => (
    <Icon {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </Icon>
  ),
  filter: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M3 5h18l-7 9v6l-4-2v-4L3 5Z" />
    </Icon>
  ),
  layers: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </Icon>
  ),
  refresh: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M4 12a8 8 0 0 1 14-5l2 2M20 4v5h-5" />
      <path d="M20 12a8 8 0 0 1-14 5l-2-2M4 20v-5h5" />
    </Icon>
  ),
  check: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="m5 12 5 5L20 7" />
    </Icon>
  ),
  flag: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M5 21V4M5 4h12l-2 4 2 4H5" />
    </Icon>
  ),
  user: (p: IconProps = {}) => (
    <Icon {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </Icon>
  ),
  clock: (p: IconProps = {}) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  ),
  alert: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 10v5M12 18v.01" />
    </Icon>
  ),
  ban: (p: IconProps = {}) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </Icon>
  ),
  invoice: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M9 9h6M9 13h6M9 17h4" />
    </Icon>
  ),
  factory: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M3 21V10l5 3V10l5 3V7l8 5v9H3Z" />
      <path d="M7 17h2M11 17h2M15 17h2" />
    </Icon>
  ),
  ruler: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M3 17 17 3l4 4L7 21Z" />
      <path d="m6 14 2 2M9 11l3 3M13 7l3 3" />
    </Icon>
  ),
  box: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5" />
      <path d="M12 13v8" />
    </Icon>
  ),
  wrench: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M14 7a4 4 0 0 1 5.7 4.6L21 13l-2 2-1.4-1.3a4 4 0 0 1-4.6.7l-7 7-3-3 7-7a4 4 0 0 1 .7-4.6L10 5l2-2 1.4 1.3A4 4 0 0 1 14 7Z" />
    </Icon>
  ),
  glass: (p: IconProps = {}) => (
    <Icon {...p}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M4 12h16M12 3v18" />
    </Icon>
  ),
  truck: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </Icon>
  ),
  arrow: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </Icon>
  ),
  arrowLeft: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M19 12H5M11 19l-7-7 7-7" />
    </Icon>
  ),
  pkg: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" />
      <path d="m3.3 8 8.7 5 8.7-5" />
      <path d="M12 13v8" />
    </Icon>
  ),
  team: (p: IconProps = {}) => (
    <Icon {...p}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </Icon>
  ),
  pln: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M7 4v16M7 4h6a4 4 0 0 1 0 8H7M4 14h11" />
    </Icon>
  ),
  shield: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6l-8-3Z" />
    </Icon>
  ),
  key: (p: IconProps = {}) => (
    <Icon {...p}>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12 21 2M17 6l3 3M14 9l3 3" />
    </Icon>
  ),
  lock: (p: IconProps = {}) => (
    <Icon {...p}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </Icon>
  ),
  chart: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 6-7" />
    </Icon>
  ),
  users: (p: IconProps = {}) => (
    <Icon {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M21 19c0-2.5-1.8-4.5-4.2-4.9" />
    </Icon>
  ),
  copy: (p: IconProps = {}) => (
    <Icon {...p}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
  ),
  archive: (p: IconProps = {}) => (
    <Icon {...p}>
      <rect x="3" y="3" width="18" height="5" rx="1" />
      <path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4" />
    </Icon>
  ),
  send: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </Icon>
  ),
  printer: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </Icon>
  ),
  save: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </Icon>
  ),
  paperclip: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="m21 11-9.5 9.5a5 5 0 0 1-7-7L13 5a3.5 3.5 0 0 1 5 5L8.5 19.5a2 2 0 0 1-3-3L14 8" />
    </Icon>
  ),
  signOut: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </Icon>
  ),
  x: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  ),
  pin: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="M12 22s7-7.6 7-13a7 7 0 0 0-14 0c0 5.4 7 13 7 13Z" />
      <circle cx="12" cy="9" r="2.5" />
    </Icon>
  ),
  map: (p: IconProps = {}) => (
    <Icon {...p}>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
      <path d="M9 3v15M15 6v15" />
    </Icon>
  ),
  grip: (p: IconProps = {}) => (
    <Icon {...p}>
      <circle cx="9" cy="6" r="1" fill="currentColor" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="9" cy="18" r="1" fill="currentColor" />
      <circle cx="15" cy="6" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="18" r="1" fill="currentColor" />
    </Icon>
  ),
  userPlus: (p: IconProps = {}) => (
    <Icon {...p}>
      <circle cx="10" cy="8" r="4" />
      <path d="M2 21c0-4 4-7 8-7s8 3 8 7" />
      <path d="M19 8v6M16 11h6" />
    </Icon>
  ),
  table: (p: IconProps = {}) => (
    <Icon {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18" />
    </Icon>
  ),
  rw: (p: IconProps = {}) => (
    <Icon {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </Icon>
  ),
};
