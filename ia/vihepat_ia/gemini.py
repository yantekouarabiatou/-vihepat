"""Appels Gemini pour l'évaluation : même prompt et même schéma que l'application
(backend/src/ia/extraction.json), résultats mis en cache sur disque.

Chaque ligne du cache garde la réponse brute, la latence mesurée, les tokens,
la version exacte du modèle et l'erreur éventuelle : tous les chiffres du
notebook sont recalculables à partir de ces fichiers.
"""
import base64
import json
import os
import time
from pathlib import Path

import requests

RACINE = Path(__file__).resolve().parents[2]
PROMPT = json.loads((RACINE / "backend" / "src" / "ia" / "extraction.json").read_text(encoding="utf-8"))
URL = "https://generativelanguage.googleapis.com/v1beta/models/{modele}:generateContent"


def _corps(parts):
    return {
        "systemInstruction": {"parts": [{"text": PROMPT["system"]}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": PROMPT["generation"]["temperature"],
            "responseMimeType": PROMPT["generation"]["responseMimeType"],
            "responseSchema": PROMPT["schema"],
        },
    }


def appeler(modele, parts, cle, timeout=60):
    """Un appel, sans nouvelle tentative : on mesure le service tel qu'il est."""
    debut = time.perf_counter()
    try:
        r = requests.post(URL.format(modele=modele), headers={"x-goog-api-key": cle},
                          json=_corps(parts), timeout=timeout)
        latence = (time.perf_counter() - debut) * 1000
        j = r.json() if r.content else {}
    except requests.exceptions.Timeout:
        return {"ok": False, "erreur": "timeout", "latence_ms": timeout * 1000}
    except requests.exceptions.RequestException as e:
        return {"ok": False, "erreur": f"reseau: {e.__class__.__name__}", "latence_ms": (time.perf_counter() - debut) * 1000}

    if r.status_code != 200:
        return {"ok": False, "erreur": f"http_{r.status_code}", "message": j.get("error", {}).get("message", "")[:200],
                "latence_ms": latence}
    u = j.get("usageMetadata", {})
    details = {d["modality"]: d["tokenCount"] for d in u.get("promptTokensDetails", [])}
    texte = "".join(p.get("text", "") for p in j.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                    if not p.get("thought"))
    res = {"ok": True, "latence_ms": latence, "version_modele": j.get("modelVersion"),
           "tokens_entree": u.get("promptTokenCount", 0), "tokens_audio": details.get("AUDIO", 0),
           "tokens_sortie": u.get("candidatesTokenCount", 0), "tokens_reflexion": u.get("thoughtsTokenCount", 0),
           "brut": texte}
    try:
        res["extraction"] = json.loads(texte)
    except json.JSONDecodeError:
        res.update(ok=False, erreur="json_invalide")
    return res


def evaluer(vignettes, modele, cache, modalite="texte", dossier_audio=None, cle=None, pause_s=4.0,
            essais_max=3, limite=None):
    """Remplit le cache pour chaque vignette (texte ou audio). Les vignettes déjà réussies sont sautées ;
    les échecs (503, délai) sont retentés jusqu'à `essais_max` fois au total, chaque essai est journalisé."""
    cle = cle or os.environ.get("GEMINI_API_KEY")
    cache = Path(cache)
    cache.parent.mkdir(parents=True, exist_ok=True)
    lignes = [json.loads(l) for l in cache.read_text(encoding="utf-8").splitlines()] if cache.exists() else []
    reussis = {l["id"] for l in lignes if l["ok"]}
    essais = {}
    for l in lignes:
        essais[l["id"]] = essais.get(l["id"], 0) + 1

    a_faire = [v for v in vignettes if v["id"] not in reussis and essais.get(v["id"], 0) < essais_max]
    if limite:
        a_faire = a_faire[:limite]
    if a_faire and not cle:
        raise RuntimeError("GEMINI_API_KEY absente : seuls les résultats en cache sont utilisables.")
    with cache.open("a", encoding="utf-8") as f:
        for i, v in enumerate(a_faire):
            if modalite == "audio":
                audio = Path(dossier_audio) / f"{v['id']}.webm"
                parts = [{"inlineData": {"mimeType": "audio/webm",
                                         "data": base64.b64encode(audio.read_bytes()).decode()}},
                         {"text": PROMPT["user_audio"]}]
            else:
                parts = [{"text": PROMPT["user_text"] + v["texte"]}]
            r = appeler(modele, parts, cle)
            r.update(id=v["id"], modele=modele, modalite=modalite, prompt=PROMPT["version"],
                     horodatage=time.strftime("%Y-%m-%dT%H:%M:%S"))
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
            f.flush()
            print(f"[{modele}/{modalite}] {i + 1}/{len(a_faire)} {v['id']} "
                  f"{'ok' if r['ok'] else r['erreur']} {r['latence_ms']:.0f} ms", flush=True)
            time.sleep(pause_s)


def charger(cache):
    """Dernier résultat réussi par vignette + journal complet de tous les essais."""
    lignes = [json.loads(l) for l in Path(cache).read_text(encoding="utf-8").splitlines()]
    ok = {}
    for l in lignes:
        if l["ok"]:
            ok[l["id"]] = l
    return ok, lignes
