"""Piste fon : reconnaissance vocale MMS (fon) -> traduction NLLB-200 (fon -> français)
-> extraction Gemini (même prompt que l'application, entrée texte) -> moteur de règles.

Modèles (vérifiés le 06/10/2026) :
- facebook/mms-1b-all, adaptateur « fon » (reconnaissance vocale, ~4 Go)
- facebook/nllb-200-distilled-600M, code langue « fon_Latn » (traduction, ~2,5 Go)
Prévu pour Colab (GPU T4) : trop lourd pour un PC avec peu de mémoire libre.
"""
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np

MMS = "facebook/mms-1b-all"
NLLB = "facebook/nllb-200-distilled-600M"
# Variantes de traduction comparées (06-07/10/2026) ; la 3.3B pèse 17 Go et peut saturer Colab gratuit
NLLB_VARIANTES = {
    "nllb-600M": "facebook/nllb-200-distilled-600M",
    "nllb-1.3B": "facebook/nllb-200-distilled-1.3B",
    "nllb-3.3B": "facebook/nllb-200-3.3B",
}


def charger_audio_16k(chemin):
    """Décode n'importe quel format (webm, ogg, m4a…) en mono 16 kHz via ffmpeg (présent sur Colab)."""
    with tempfile.NamedTemporaryFile(suffix=".f32") as tmp:
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(chemin), "-ac", "1", "-ar", "16000",
                        "-f", "f32le", tmp.name], check=True)
        return np.fromfile(tmp.name, dtype=np.float32)


class TranscripteurFon:
    def __init__(self, device):
        from transformers import AutoProcessor, Wav2Vec2ForCTC
        self.device = device
        self.processor = AutoProcessor.from_pretrained(MMS, target_lang="fon")
        self.model = Wav2Vec2ForCTC.from_pretrained(MMS, target_lang="fon", ignore_mismatched_sizes=True).to(device)

    def __call__(self, audio):
        import torch
        entree = self.processor(audio, sampling_rate=16000, return_tensors="pt").to(self.device)
        with torch.no_grad():
            logits = self.model(**entree).logits
        return self.processor.decode(torch.argmax(logits, dim=-1)[0]).strip()


class TraducteurFonFr:
    def __init__(self, device, modele=NLLB):
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        self.device = device
        self.tok = AutoTokenizer.from_pretrained(modele, src_lang="fon_Latn")
        # Demi-précision sur GPU : divise la mémoire par deux (indispensable pour les grosses variantes)
        dtype = torch.float16 if device == "cuda" else torch.float32
        self.model = AutoModelForSeq2SeqLM.from_pretrained(modele, torch_dtype=dtype, low_cpu_mem_usage=True).to(device)

    def __call__(self, texte):
        import torch
        entree = self.tok(texte, return_tensors="pt").to(self.device)
        with torch.no_grad():
            sortie = self.model.generate(**entree, forced_bos_token_id=self.tok.convert_tokens_to_ids("fra_Latn"),
                                         max_new_tokens=128, num_beams=4)
        return self.tok.batch_decode(sortie, skip_special_tokens=True)[0].strip()


def chronometre(fn, *args):
    t0 = time.perf_counter()
    r = fn(*args)
    return r, (time.perf_counter() - t0) * 1000
