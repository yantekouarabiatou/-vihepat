import { isAxiosError } from "axios";

/** Extrait le message d'erreur renvoyé par l'API VIHEPAT ({ error: "..." }). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { error?: unknown } | undefined;
    if (typeof data?.error === "string") return data.error;
  }
  return fallback;
}
