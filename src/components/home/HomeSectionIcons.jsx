const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Icon({ children, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${className || ''}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...stroke}
    >
      {children}
    </svg>
  )
}

export function IconJapan({ className } = {}) {
  return (
    <Icon className={className}>
      <path d="M12 3v3" />
      <path d="M5 8h14" />
      <path d="M7 8v5c0 3 2.2 5 5 5s5-2 5-5V8" />
      <path d="M4 21h16" />
      <path d="M8 13h8" />
    </Icon>
  )
}

export function IconWay({ className } = {}) {
  return (
    <Icon className={className}>
      <path d="M6 4v7a3 3 0 003 3h6a3 3 0 003-3V4" />
      <path d="M6 20V14" />
      <path d="M18 20v-6" />
      <circle cx="6" cy="4" r="1.4" />
      <circle cx="18" cy="4" r="1.4" />
      <circle cx="6" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
    </Icon>
  )
}

export function IconCards({ className } = {}) {
  return (
    <Icon className={className}>
      <rect x="4" y="6" width="11" height="14" rx="1.5" />
      <path d="M15 8h4.2A1.8 1.8 0 0121 9.8v10.4A1.8 1.8 0 0119.2 22H9" />
    </Icon>
  )
}

export function IconSearch({ className } = {}) {
  return (
    <Icon className={className}>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </Icon>
  )
}

export function IconBag({ className } = {}) {
  return (
    <Icon className={className}>
      <path d="M5 8h14l-1 12H6L5 8z" />
      <path d="M9 8V6a3 3 0 016 0v2" />
    </Icon>
  )
}

export function IconPackage({ className } = {}) {
  return (
    <Icon className={className}>
      <path d="M3 8l9-4 9 4-9 4-9-4z" />
      <path d="M3 8v8l9 4 9-4V8" />
      <path d="M12 12v8" />
    </Icon>
  )
}

export function IconCheckList({ className } = {}) {
  return (
    <Icon className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h5" />
      <path d="M8 17l1.5 1.5L13 15" />
    </Icon>
  )
}

export function IconUser({ className } = {}) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19c1.4-3 4-4.5 7-4.5S17.6 16 19 19" />
    </Icon>
  )
}

export function IconLayers({ className } = {}) {
  return (
    <Icon className={className}>
      <path d="M4 8l8-4 8 4-8 4-8-4z" />
      <path d="M4 12l8 4 8-4" />
      <path d="M4 16l8 4 8-4" />
    </Icon>
  )
}

export function IconCalc({ className } = {}) {
  return (
    <Icon className={className}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 8h8M8 12h3M13 12h3M8 16h3M13 16h3" />
    </Icon>
  )
}

export function IconHeart({ className } = {}) {
  return (
    <Icon className={className}>
      <path d="M12 19s-6.5-4.2-8.2-7.8C2.4 8.7 4 6 6.8 6c1.6 0 2.7.9 3.2 1.8C10.5 6.9 11.6 6 13.2 6c2.8 0 4.4 2.7 3 5.2C18.5 14.8 12 19 12 19z" />
    </Icon>
  )
}

export function IconBookmark({ className } = {}) {
  return (
    <Icon className={className}>
      <path d="M7 4h10v16l-5-3-5 3V4z" />
    </Icon>
  )
}

export function IconPin({ className } = {}) {
  return (
    <Icon className={className}>
      <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </Icon>
  )
}

export function IconChat({ className } = {}) {
  return (
    <Icon className={className}>
      <path d="M5 6h14v10H9l-4 4V6z" />
    </Icon>
  )
}

export function IconTag({ className } = {}) {
  return (
    <Icon className={className}>
      <path d="M4 12l8-8h8v8l-8 8-8-8z" />
      <circle cx="16" cy="8" r="1.3" />
    </Icon>
  )
}

export function IconRoute({ className } = {}) {
  return (
    <Icon className={className}>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M8 7h5a3 3 0 013 3v2" />
      <path d="M16 17H11a3 3 0 01-3-3v-2" />
    </Icon>
  )
}

export function IconPlay({ className } = {}) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 9.2l6 2.8-6 2.8V9.2z" />
    </Icon>
  )
}

export function IconStore({ className } = {}) {
  return (
    <Icon className={className}>
      <path d="M4 9l1.5-5h13L20 9" />
      <path d="M4 9h16v11H4V9z" />
      <path d="M9 20v-6h6v6" />
    </Icon>
  )
}

export function IconPeople({ className } = {}) {
  return (
    <Icon className={className}>
      <circle cx="9" cy="8" r="2.6" />
      <path d="M4.5 18c.8-2.6 2.6-4 4.5-4s3.7 1.4 4.5 4" />
      <circle cx="16.5" cy="9" r="2.2" />
      <path d="M14.2 18c.4-1.8 1.6-2.8 2.3-3.2" />
    </Icon>
  )
}

export function IconSpark({ className } = {}) {
  return (
    <Icon className={className}>
      <path d="M12 3l1.4 6.2L19 12l-5.6 2.8L12 21l-1.4-6.2L5 12l5.6-2.8L12 3z" />
    </Icon>
  )
}

export function HomeIconBadge({ children, className = 'mb-3' }) {
  return (
    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-earth-100 text-earth-800 transition group-hover:bg-earth-200 ${className}`}>
      {children}
    </span>
  )
}
