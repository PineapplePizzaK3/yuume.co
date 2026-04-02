/**
 * Bandeiras em SVG — funcionam no Windows onde emoji de bandeira vira "BR", "US", "JP".
 */
export function FlagIcon({ code, className = '', title, size = 18 }) {
  const h = Math.round((size * 2) / 3)
  const common = {
    width: size,
    height: h,
    className: `inline-block shrink-0 rounded-sm border border-earth-200/80 shadow-sm ${className}`,
    role: 'img',
    'aria-hidden': title ? undefined : true,
    'aria-label': title || undefined,
  }

  if (code === 'BR') {
    return (
      <svg {...common} viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg">
        <title>{title || 'Brasil'}</title>
        <rect width="22" height="15" fill="#009b3a" />
        <path fill="#fedf00" d="M11 2l8.5 5.5L11 13 2.5 7.5z" />
        <circle cx="11" cy="7.5" r="3.2" fill="#002776" />
      </svg>
    )
  }

  if (code === 'US') {
    const W = 19
    const H = 10
    const sh = H / 13
    const cantonW = W * 0.4
    const cantonH = sh * 7
    const whiteStripes = []
    for (let i = 1; i < 13; i += 2) {
      whiteStripes.push(<rect key={i} y={i * sh} width={W} height={sh} fill="#fff" />)
    }
    return (
      <svg {...common} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <title>{title || 'Estados Unidos'}</title>
        <rect width={W} height={H} fill="#b22234" />
        {whiteStripes}
        <rect width={cantonW} height={cantonH} fill="#3c3b6e" x="0" y="0" />
      </svg>
    )
  }

  if (code === 'JP') {
    return (
      <svg {...common} viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg">
        <title>{title || 'Japão'}</title>
        <rect width="3" height="2" fill="#fff" />
        <circle cx="1.5" cy="1" r="0.55" fill="#bc002d" />
      </svg>
    )
  }

  return null
}
