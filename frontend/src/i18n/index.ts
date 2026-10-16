import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import fr from './locales/fr.json';
import en from './locales/en.json';
import fon from './locales/fon.json';

/**
 * Langues locales prévues (ewe, baatonou…) : ajouter `./locales/<code>.json` avec les
 * mêmes clés, l'enregistrer ici et dans `supportedLngs`, puis dans le sélecteur de langue.
 * Toute clé absente retombe sur le français.
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      fon: { translation: fon },
    },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en', 'fon'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'vihepat_lang',
    },
  });

// Attribut lang du document : lecteurs d'écran et césure suivent la langue choisie
const appliquerLangDocument = (lng: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng === 'fon' ? 'fon' : lng;
};
appliquerLangDocument(i18n.resolvedLanguage ?? i18n.language ?? 'fr');
i18n.on('languageChanged', appliquerLangDocument);

export default i18n;
