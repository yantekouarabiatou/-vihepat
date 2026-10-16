import i18n from "@/i18n";

/**
 * Locale des dates et nombres affichés : suit la langue choisie dans l'application
 * (et non celle du navigateur). Le fon n'a pas de locale Intl : on garde le format français.
 */
export function localeAffichage(langue: string = i18n.resolvedLanguage ?? i18n.language): string {
  return langue === "en" ? "en-GB" : "fr-FR";
}
