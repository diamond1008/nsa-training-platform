import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "users"
  | "teacher"
  | "book"
  | "school"
  | "calendar"
  | "check"
  | "chart"
  | "award"
  | "menu"
  | "close"
  | "logout"
  | "search"
  | "plus"
  | "arrow-left"
  | "arrow-right"
  | "clock"
  | "location"
  | "bell"
  | "sparkles"
  | "alert"
  | "info"
  | "chevron-right"
  | "sidebar"
  | "sidebar-collapse"
  | "sidebar-expand";

const paths: Record<IconName, JSX.Element> = {
  sidebar: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M9 3v18" />
    </>
  ),
  "sidebar-collapse": (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M9 3v18M15 15l-3-3 3-3" />
    </>
  ),
  "sidebar-expand": (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M9 3v18M13 9l3 3-3 3" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  teacher: (
    <>
      <path d="M3 3h18v13H3z" />
      <path d="m8 21 4-5 4 5M8 8h8M8 12h5" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
      <path d="M4 5.5v14" />
    </>
  ),
  school: (
    <>
      <path d="m3 10 9-5 9 5-9 5z" />
      <path d="M7 13v5l5 3 5-3v-5M21 10v6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  check: (
    <>
      <path d="m9 12 2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="m8.5 13-1 8 4.5-2 4.5 2-1-8" />
    </>
  ),
  menu: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="m15 18-6-6 6-6" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="m9 18 6-6-6-6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  location: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2zM5 15l.7 2.3L8 18l-2.3.7L5 21l-.7-2.3L2 18l2.3-.7zM19 14l.7 2.3 2.3.7-2.3.7L19 20l-.7-2.3L16 17l2.3-.7z" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2 21h20z" />
      <path d="M12 9v5M12 18h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  "chevron-right": (
    <>
      <path d="m9 18 6-6-6-6" />
    </>
  ),
};

export function Icon({ name, className, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "h-5 w-5"}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
