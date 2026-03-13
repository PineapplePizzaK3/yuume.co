/**
 * LegalLanguageContext - Language state for legal pages (JA | PT-BR | EN).
 * JA is default. Persists preference in localStorage.
 */
import { createContext, useContext, useState, useEffect } from 'react'

const STORAGE_KEY = 'legal-lang'

const LegalLanguageContext = createContext({ lang: 'ja', setLang: () => {} })

export function LegalLanguageProvider({ children }) {
  const [lang, setLangState] = useState('ja')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'ja' || stored === 'pt-BR' || stored === 'en') setLangState(stored)
  }, [])

  const setLang = (l) => {
    if (l !== 'ja' && l !== 'pt-BR' && l !== 'en') return
    setLangState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  return (
    <LegalLanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LegalLanguageContext.Provider>
  )
}

export function useLegalLanguage() {
  const ctx = useContext(LegalLanguageContext)
  if (!ctx) throw new Error('useLegalLanguage must be used within LegalLanguageProvider')
  return ctx
}
