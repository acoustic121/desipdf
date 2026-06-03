import { createContext, useContext, useState, useEffect } from 'react'

const I18nContext = createContext({ t: (k) => k, lang: 'en', setLang: () => {} })

// All locale JSONs — statically bundled by Next.js
const locales = {
  // Indian languages
  en:    require('../locales/en.json'),
  hi:    require('../locales/hi.json'),
  ta:    require('../locales/ta.json'),
  te:    require('../locales/te.json'),
  bn:    require('../locales/bn.json'),
  mr:    require('../locales/mr.json'),
  gu:    require('../locales/gu.json'),
  // International languages
  es:    require('../locales/es.json'),
  fr:    require('../locales/fr.json'),
  de:    require('../locales/de.json'),
  it:    require('../locales/it.json'),
  pt:    require('../locales/pt.json'),
  ja:    require('../locales/ja.json'),
  ru:    require('../locales/ru.json'),
  ko:    require('../locales/ko.json'),
  'zh-cn': require('../locales/zh-cn.json'),
  'zh-tw': require('../locales/zh-tw.json'),
  ar:    require('../locales/ar.json'),
  nl:    require('../locales/nl.json'),
  el:    require('../locales/el.json'),
  id:    require('../locales/id.json'),
  ms:    require('../locales/ms.json'),
  pl:    require('../locales/pl.json'),
  sv:    require('../locales/sv.json'),
  th:    require('../locales/th.json'),
  tr:    require('../locales/tr.json'),
  uk:    require('../locales/uk.json'),
  vi:    require('../locales/vi.json'),
  sw:    require('../locales/sw.json'),
}

// Dot-path accessor: t('tools.merge-pdf') → locales[lang].tools['merge-pdf']
function resolve(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? path
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState('en')

  useEffect(() => {
    const saved = localStorage.getItem('lang') || 'en'
    if (locales[saved]) setLangState(saved)
  }, [])

  const setLang = (code) => {
    if (!locales[code]) return
    setLangState(code)
    localStorage.setItem('lang', code)
  }

  const t = (key) => resolve(locales[lang] ?? locales.en, key)

  return (
    <I18nContext.Provider value={{ t, lang, setLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
