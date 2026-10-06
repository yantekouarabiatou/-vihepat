import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Enregistrement d'une note vocale (MediaRecorder). Contrairement à la dictée du
 * navigateur, il fonctionne sur tous les navigateurs récents, téléphones compris,
 * et produit un vrai fichier audio (webm/opus sur Chrome, mp4/aac sur Safari).
 */
export function useAudioRecorder(dureeMaxS = 60) {
  const [isSupported] = useState(
    () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined"
  );
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const resolveRef = useRef<((b: Blob | null) => void) | null>(null);

  const nettoyer = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    setIsRecording(false);
  }, []);

  useEffect(() => nettoyer, [nettoyer]);

  /** Arrête l'enregistrement ; la promesse renvoyée par start() reçoit alors le fichier. */
  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }, []);

  /** Démarre l'enregistrement. Résout avec le fichier audio à l'arrêt (null si annulé ou vide). */
  const start = useCallback(async (): Promise<Blob | null> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    const fichier = new Promise<Blob | null>((resolve) => {
      resolveRef.current = resolve;
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        nettoyer();
        resolve(blob.size > 0 ? blob : null);
      };
    });
    recorderRef.current = mr;
    mr.start(250);
    setIsRecording(true);
    setDuration(0);
    timerRef.current = window.setInterval(() => {
      setDuration((d) => {
        // Arrêt automatique : une note trop longue coûte cher et dépasse la limite du serveur
        if (d + 1 >= dureeMaxS) stop();
        return d + 1;
      });
    }, 1000);
    return fichier;
  }, [dureeMaxS, nettoyer, stop]);

  /** Annule sans produire de fichier. */
  const cancel = useCallback(() => {
    const r = recorderRef.current;
    if (r) {
      r.onstop = null;
      if (r.state !== "inactive") r.stop();
    }
    resolveRef.current?.(null);
    nettoyer();
  }, [nettoyer]);

  return { isSupported, isRecording, duration, start, stop, cancel };
}

export function blobVersBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
