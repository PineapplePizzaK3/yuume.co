import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import translationPt from '../locales/pt-BR/translation.json'
import translationEn from '../locales/en/translation.json'

void i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: translationPt },
    en: { translation: translationEn },
  },
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  interpolation: { escapeValue: false },
})

export default i18n
