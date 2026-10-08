const RARITY_PATTERNS = [
  'MANGA',
  'ALT ART',
  'SECRET RARE',
  'ULTRA RARE',
  'SPECIAL ART RARE',
  'HYPER RARE',
  'SAR',
  'UR',
  'SEC',
  'CSR',
  'CHR',
  'SR',
  'AR',
  'RRR',
  'RR',
  'PR',
  'P',
  'R',
  'U',
  'C',
]

const SEALED_PRODUCT_PATTERN =
  /(?:^|\s)(?:box|case|carton|ブースター|ボックス|カートン)\s*$/i

const SEALED_TITLE_PATTERN =
  /\b(?:elite\s+trainer\s+box|etb|binder\s+collection|display\s+box|collection\s+box|starter\s+deck|theme\s+deck)\b/i

const META_BRACKET_PATTERN =
  /^(?:en|jp|ja|jpn|eng|sc|cn|kr|opened|unopen|unopened|no\s*shrink)$/i

const ERROR_CARD_PATTERN =
  /\b(?:printing\s+error|text\s+error|error\s+ver\.?|error\s+version|misprint|miscut|error\s+card)\b|エラー|ミスプリント/i

const PACK_TYPE_RE =
  /(?:High\s*Class\s*Pack|Enhanced\s*Expansion\s*Pack|Expansion\s*Pack|Booster\s*Pack|Premium\s+Booster(?:\s*Pack)?|Precious\s*Booster\s*Pack|Special\s*Pack|Basic\s*Pack|Concept\s*Pack|Limited\s*Pack|Deck\s*Build\s*Pack|Character\s*Premium\s*Pack|ハイクラスパック|強化拡張パック|拡張パック|ブースターパック|プレミアムブースター|スペシャルパック|ベーシックパック)/gi

const GAME_PREFIX_RE =
  /^(?:(?:Pokémon|Pokemon)\s+Card\s+Game(?:\s+MEGA)?(?:\s+Sword\s*&\s*Shield)?(?:\s+Scarlet\s*&\s*Violet)?(?:\s+Sun\s*&\s*Moon)?|ONE\s*PIECE\s+Card\s+Game|Yu-Gi-Oh!?(?:\s*OCG)?(?:\s+Duel\s+Monsters)?|Weiss\s+Schwarz|DRAGON\s+BALL\s+SUPER\s+CARD\s+GAME(?:\s+FUSION\s+WORLD)?|UNION\s+ARENA|GUNDAM\s+CARD\s+GAME|Duel\s+Masters(?:\s+TCG)?|ポケモンカードゲーム(?:MEGA)?|ワンピースカードゲーム|遊戯王\s*OCG(?:\s*デュエルモンスターズ)?|ヴァイスシュヴァルツ|デュエルマスターズ(?:\s*TCG)?)\s+/i

const TYPE_TOKEN_PREFIX_RE =
  /^(?:pokemoncardgame|onepiececardgame|yugiohocgduelmonsters|yugiohocg|yugioh|weissschwarz|dragonballsupercardgame|fusionworld|unionarena|gundamcardgame|duelmasterstcg|duelmasters|expansionpack|enhancedexpansionpack|highclasspack|boosterpack|premiumboosterpack|premiumbooster|preciousboosterpack|specialpack|specialbox|basicpack|conceptpack|limitedpack|deckbuildpack|promotionalcards|promotionalcard)+/

const TYPE_TOKEN_SUFFIX_RE =
  /(?:1)?(?:bonus|assist|expansion)pack$|limitedpack$|jpedition$|firstedition$|1stedition$|secondedition$|2ndedition$/

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeMatchToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[「」『』"'“”‘’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

export function extractQuotedNames(text) {
  const source = String(text || '')
  const names = []
  const patterns = [
    /「([^」]{2,80})」/g,
    /『([^』]{2,80})』/g,
    /"([^"]{2,80})"/g,
    /“([^”]{2,80})”/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = normalizeText(match[1])
      if (value) names.push(value)
    }
  }
  return names
}

export function extractCardCollectionHints(name) {
  const source = String(name || '')
  const hints = extractQuotedNames(source)
  for (const match of source.matchAll(/\(([^)]{3,160})\)/g)) {
    const value = normalizeText(match[1])
    if (value) hints.push(value)
  }
  return [...new Set(hints)]
}

function stripGamePrefix(text) {
  return normalizeText(text)
    .replace(/^【\s*シュリンクなし\s*】\s*/gi, '')
    .replace(/^\[No shrink\]\s*/gi, '')
    .replace(GAME_PREFIX_RE, '')
    .trim()
}

function stripTrailingProductNoise(text) {
  return normalizeText(text)
    .replace(/\s*\((?:with\s+)?\+1[^)]*\)/gi, '')
    .replace(/\s*\+1(?:\s+Bonus|\s+Assist|\s+Expansion)?\s*Pack.*$/i, '')
    .replace(/\s*JP Edition.*$/i, '')
    .replace(/\s*(?:1st|First|2nd|Second)\s+Edition.*$/i, '')
    .replace(/\s*Box(?:es)?\s*$/i, '')
    .replace(/\s*パック\s*$/u, '')
    .replace(/\s*ボックス.*$/u, '')
    .replace(/\s*\([^)]{0,48}\)\s*$/g, '')
    .replace(/^["'「『,\s]+|["'」』]+$/g, '')
    .replace(/^,\s*/, '')
    .trim()
}

function uniqueLabels(values) {
  const seen = new Set()
  const out = []
  for (const value of values) {
    const text = normalizeText(value)
    if (text.length < 3 || text.length > 80) continue
    const token = normalizeMatchToken(text)
    if (token.length < 3 || seen.has(token)) continue
    seen.add(token)
    out.push(text)
  }
  return out
}

export function extractCollectionLabels(product) {
  const labels = []
  const parts = [product?.nameEn, product?.name, product?.collectionTitle]
  for (const part of parts) {
    labels.push(...extractQuotedNames(part))
  }

  for (const part of parts) {
    const cleaned = stripGamePrefix(part)
    if (!cleaned) continue
    labels.push(...extractQuotedNames(cleaned))
    const segments = cleaned
      .split(PACK_TYPE_RE)
      .map((item) => stripTrailingProductNoise(item))
      .filter(Boolean)
    if (segments.length) {
      labels.push(segments[segments.length - 1])
    } else {
      const fallback = stripTrailingProductNoise(cleaned)
      if (fallback) labels.push(fallback)
    }
  }

  return uniqueLabels(labels)
}

function stripIdentityNoise(token) {
  let value = String(token || '')
  while (TYPE_TOKEN_PREFIX_RE.test(value)) {
    value = value.replace(TYPE_TOKEN_PREFIX_RE, '')
  }
  value = value.replace(TYPE_TOKEN_SUFFIX_RE, '')
  return value
}

export function collectionIdentitiesEqual(cardHint, label) {
  const left = stripIdentityNoise(normalizeMatchToken(cardHint))
  const right = stripIdentityNoise(normalizeMatchToken(label))
  return Boolean(left && right && left === right)
}

function bracketInners(name) {
  return [...String(name || '').matchAll(/\[([^\]]+)\]/g)].map((match) => String(match[1] || '').trim())
}

function isMetaBracket(inner) {
  return META_BRACKET_PATTERN.test(String(inner || '').trim())
}

export function isEnglishCardListing(name) {
  return /\[EN\]|\benglish\s+version\b/i.test(String(name || ''))
}

export function looksLikeSingleCard(name) {
  const text = String(name || '')
  if (!text) return false
  const cardBrackets = bracketInners(text).filter((inner) => /\d/.test(inner) && !isMetaBracket(inner))
  if (!cardBrackets.length) return false
  if (SEALED_PRODUCT_PATTERN.test(text)) return false
  if (SEALED_TITLE_PATTERN.test(text)) return false
  if (ERROR_CARD_PATTERN.test(text)) return false
  return true
}

export function isErrorCardName(name) {
  return ERROR_CARD_PATTERN.test(String(name || ''))
}

export function matchesCollection(itemName, setCode, labels = [], extraKeywords = []) {
  const name = String(itemName || '')
  if (!name) return false

  const hints = extractCardCollectionHints(name)
  const identityLabels = [...labels, ...extraKeywords].map((item) => normalizeText(item)).filter(Boolean)

  if (hints.length && identityLabels.length) {
    return hints.some((hint) => identityLabels.some((label) => collectionIdentitiesEqual(hint, label)))
  }

  if (setCode) {
    const setNorm = normalizeMatchToken(setCode)
    if (setNorm.length >= 3) {
      const inBrackets = bracketInners(name).some((inner) => normalizeMatchToken(inner).includes(setNorm))
      if (inBrackets) return true
    }
  }

  return false
}

export function parseCardNumber(name = '') {
  const text = String(name || '')
  const bracketMatch = text.match(/\[([^\]]+)\]/)
  if (bracketMatch) {
    const parts = bracketMatch[1].split(/\s+/).filter(Boolean)
    const bySlash = parts.find((part) => /\d+\s*\/\s*\d+/.test(part) || /\d+\s*\/\s*[A-Z0-9-]+/i.test(part))
    if (bySlash) return bySlash.replace(/\s+/g, '')
    const byCode = parts.find((part) => /^[A-Z0-9]{1,6}-?\d{1,4}[A-Z]?$/i.test(part))
    if (byCode) return byCode.toUpperCase()
  }

  const slashMatch = text.match(/\b(\d{1,3}\s*\/\s*\d{2,3})\b/)
  if (slashMatch) return slashMatch[1].replace(/\s+/g, '')
  return ''
}

export function parseRarity(name = '') {
  const upper = String(name || '').toUpperCase()
  for (const rarity of RARITY_PATTERNS) {
    const pattern = new RegExp(`(?:\\b|\\(|\\[)${escapeRegex(rarity)}(?:\\b|\\)|\\])`, 'i')
    if (pattern.test(upper)) return rarity
  }
  return ''
}

export function filterTopCardsForCollection(
  cards = [],
  { setCode = '', labels = [], extraKeywords = [], allowEnglish = false } = {}
) {
  return (Array.isArray(cards) ? cards : []).filter((card) => {
    const name = card?.name || card?.nameEn || ''
    if (!looksLikeSingleCard(name)) return false
    if (isErrorCardName(name)) return false
    if (!allowEnglish && isEnglishCardListing(name)) return false
    return matchesCollection(name, setCode, labels, extraKeywords)
  })
}

export function collectionCardIdentity(card) {
  return [
    normalizeText(card?.cardNumber || '').toUpperCase(),
    normalizeText(card?.rarity || '').toUpperCase(),
    normalizeText(card?.name || '').toUpperCase(),
  ].join('|')
}

export function mergeCollectionTopCards(previousCards = [], fetched = []) {
  const fresh = Array.isArray(fetched) ? fetched : []
  const previous = Array.isArray(previousCards) ? previousCards : []
  const fetchedIds = new Set(fresh.map((row) => String(row?.snkrdunkId || '').trim()).filter(Boolean))
  const fetchedKeys = new Set(fresh.map((row) => collectionCardIdentity(row)).filter((key) => key !== '||'))
  const extras = previous.filter((row) => {
    const id = String(row?.snkrdunkId || '').trim()
    const key = collectionCardIdentity(row)
    if (id && fetchedIds.has(id)) return false
    if (key && key !== '||' && fetchedKeys.has(key)) return false
    return true
  })
  return [...fresh, ...extras]
}
