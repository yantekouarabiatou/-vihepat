"""Modèle de référence sans IA générative : extraction par mots-clés + gestion simple des négations.

Il utilise le même vocabulaire familier que celui donné à Gemini dans le prompt,
pour que la comparaison porte sur la méthode et non sur le lexique.
Il tourne hors ligne, en quelques microsecondes.
"""
import re
import unicodedata


def _norm(t):
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[’']", " ", t)


LEXIQUE_SYMPTOMES = {
    "fievre": [r"fievre", r"corps (est |me )?(chaud|chauffe)", r"chaud chaud", r"\bpalu", r"temperature"],
    "toux": [r"tous+e", r"\btoux", r"\bkpe"],
    "diarrhee": [r"diarrhee", r"ventre (qui )?coule", r"ca coule", r"selles? liquide", r"selle liquide"],
    "nausees": [r"nausee", r"vomi", r"vomir", r"coeur se souleve", r"envie de vomir", r"rends? (les |mes )?comprimes"],
    "eruption": [r"bouton", r"eruption", r"plaques? sur la peau"],
    "jaunisse": [r"jaune", r"jauni"],
    "douleur_ventre": [r"mal (au|a mon) ventre", r"douleur.{0,15}ventre", r"ventre (me )?(fait mal|tord)", r"ventre me tord"],
    "fatigue": [r"fatigu", r"faible", r"pas (la|de) force", r"plus de force"],
    "maux_tete": [r"mal a la tete", r"maux de tete", r"tete (me )?tape", r"cephalee"],
    "amaigrissement": [r"maigri", r"perd(s|u)? du poids", r"perte de poids", r"habits flottent", r"kilos? de moins", r"maigre"],
    "urines_foncees": [r"urines?.{0,20}fonce", r"pipi.{0,20}(coca|fonce)"],
    "autre": [r"demangeaison", r"gratte", r"vertige", r"tete tourne", r"insomnie", r"fourmis", r"frisson",
              r"transpire", r"nez coule", r"rhume", r"articulation", r"plaies", r"coeur bat", r"triste",
              r"pas faim", r"appetit"],
}

LEXIQUE_GRAVES = {
    "respiration": [r"respir", r"souffle", r"suffoqu", r"air (me )?manque", r"air ne rentre"],
    "poitrine": [r"poitrine"],
    "confusion": [r"confus", r"nuque raide", r"somnolent", r"n importe comment", r"tete n est pas claire",
                  r"quel jour", r"choses bizarres", r"dort tout le temps"],
    "vomit_traitement": [r"vomi.{0,30}(comprime|medicament|traitement)", r"rends? (les |mes )?comprimes",
                         r"(comprimes|traitement).{0,30}(ressortent|ne restent pas|garder)"],
    "saignement": [r"saign", r"\bsang\b", r"regles coulent"],
    "malaise": [r"malaise", r"evanoui", r"perdu connaissance", r"tombe", r"reveille par terre", r"devenu noir"],
    "idees_noires": [r"tuer", r"en finir", r"me pendre", r"plus de sens", r"mieux sans moi", r"ne plus me reveiller",
                     r"me faire du mal", r"que tout s arrete"],
}

# Une négation juste avant le mot-clé (dans la même proposition) annule la détection
NEGATION = re.compile(r"(\bpas\b|\bplus\b|\bjamais\b|\baucun\w*|\brien\b|\bne\b|\bn |\bsans\b)[^.,;!?]{0,25}$")


def _cherche(texte, motifs):
    for m in motifs:
        for hit in re.finditer(m, texte):
            avant = texte[max(0, hit.start() - 30):hit.start()]
            if not NEGATION.search(avant):
                return True
    return False


def extraire(texte):
    t = _norm(texte)
    symptomes = [s for s, motifs in LEXIQUE_SYMPTOMES.items() if _cherche(t, motifs)]
    graves = [g for g, motifs in LEXIQUE_GRAVES.items() if _cherche(t, motifs)]
    # Douleur de poitrine décrite sans douleur ni intensité (« mon cœur bat vite... pas de douleur ») : le contexte suffit rarement
    if "poitrine" in graves and not re.search(r"douleur|mal|serre|poids", t):
        graves.remove("poitrine")

    if re.search(r"(depuis )?(ce matin|aujourd hui|cette nuit|hier|tout a l heure|ce soir|une heure)", t):
        duree = "aujourdhui"
    else:
        duree = "inconnue"
    m = re.search(r"(\d+|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze|quinze|vingt|une dizaine de) ?(jours?|semaines?|mois|nuits?)", t)
    if m:
        nb = {"deux": 2, "trois": 3, "quatre": 4, "cinq": 5, "six": 6, "sept": 7, "huit": 8, "neuf": 9, "dix": 10,
              "douze": 12, "quinze": 15, "vingt": 20, "une dizaine de": 10}.get(m.group(1))
        nb = nb if nb is not None else int(m.group(1))
        unite = m.group(2)
        jours = nb * (7 if unite.startswith("semaine") else 30 if unite == "mois" else 1)
        duree = "plus_semaine" if jours > 7 else "quelques_jours" if jours >= 2 else "aujourdhui"
    elif re.search(r"avant hier|quelques jours|semaine (passee|derniere)|une semaine", t):
        duree = "quelques_jours"
    elif re.search(r"des mois|un mois|plus d une semaine|des semaines|derniers mois", t):
        duree = "plus_semaine"

    if re.search(r"tres fort|insupportable|couche|au lit|allonge|ne peux (plus |pas |rien)|fort fort|mal mal|me tords?", t):
        intensite = "fort"
    elif re.search(r"gene|derange|difficile", t):
        intensite = "gene"
    elif re.search(r"un peu|leger|legere|ca va|rien de grave|supportable|pas grave|c est rien", t):
        intensite = "leger"
    else:
        intensite = "inconnue"

    return {"symptomes": symptomes, "duree": duree, "intensite": intensite, "signes_graves": graves}
