import { isAxiosError } from "axios";
import i18n from "@/i18n";

/**
 * Message d'erreur à afficher pour une erreur de l'API VIHEPAT ({ error, code? }).
 * - `code` connu : message traduit (`errors.<code>`) ;
 * - sinon, en français : le message du serveur (rédigé en français) ;
 * - dans une autre langue : le message de repli, déjà traduit par l'appelant.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { error?: unknown; code?: unknown } | undefined;
    if (typeof data?.code === "string" && i18n.exists(`errors.${data.code}`)) {
      return i18n.t(`errors.${data.code}`);
    }
    const langue = i18n.resolvedLanguage ?? i18n.language;
    if (typeof data?.error === "string" && langue === "fr") return data.error;
  }
  return fallback;
}
