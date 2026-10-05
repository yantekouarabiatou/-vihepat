"""Portage Python du moteur de triage de l'application (frontend/src/lib/triage.ts).

La conformité avec la version TypeScript est vérifiée cas par cas sur
data/parite_ts.json (généré par scripts/export_parite.ts) : voir le notebook, section 2.
"""

ORDRE = {"banal": 0, "a_surveiller": 1, "alerte": 2}
NIVEAUX = ["banal", "a_surveiller", "alerte"]

SYMPTOMES = ["fievre", "toux", "diarrhee", "nausees", "eruption", "jaunisse", "douleur_ventre",
             "fatigue", "maux_tete", "amaigrissement", "urines_foncees", "autre"]
SIGNES_GRAVES = ["respiration", "poitrine", "confusion", "vomit_traitement", "saignement",
                 "malaise", "idees_noires"]
DUREES = ["aujourdhui", "quelques_jours", "plus_semaine"]
INTENSITES = ["leger", "gene", "fort"]


def evaluer_triage(symptomes, duree, intensite, signes_graves, traitement_recent=False):
    """Renvoie (niveau, raisons). Mêmes règles, même ordre que triage.ts."""
    niveau = "banal"
    raisons = []

    def monter(n, raison):
        nonlocal niveau
        if ORDRE[n] > ORDRE[niveau]:
            niveau = n
        if ORDRE[n] > 0:
            raisons.append(raison)

    a = lambda s: s in symptomes

    for s in signes_graves:
        monter("alerte", s)

    long = duree == "plus_semaine"
    plusieurs_jours = duree != "aujourdhui"
    fort = intensite == "fort"

    if a("jaunisse"):
        monter("alerte", "jaunisse")
    if a("eruption") and traitement_recent:
        monter("alerte", "eruption_traitement_recent")
    elif a("eruption"):
        monter("alerte" if fort else "a_surveiller", "eruption")

    if a("fievre"):
        if long:
            monter("alerte", "fievre_longue")
        elif a("maux_tete") and fort:
            monter("alerte", "fievre_cephalee_forte")
        else:
            monter("a_surveiller", "fievre")
    if a("toux"):
        if long and (a("fievre") or a("amaigrissement")):
            monter("alerte", "toux_prolongee_fievre_ou_poids")
        elif long:
            monter("a_surveiller", "toux_longue")
    if a("diarrhee"):
        if long or fort:
            monter("alerte", "diarrhee_importante")
        elif plusieurs_jours:
            monter("a_surveiller", "diarrhee_plusieurs_jours")
    if a("nausees") and (fort or long):
        monter("a_surveiller", "nausees_persistantes")
    if a("douleur_ventre"):
        monter("alerte" if fort else "a_surveiller", "douleur_ventre")
    if a("maux_tete") and fort:
        monter("a_surveiller", "cephalee_forte")
    if a("fatigue") and long and fort:
        monter("a_surveiller", "fatigue_longue")
    if a("amaigrissement"):
        monter("a_surveiller", "amaigrissement")
    if a("urines_foncees"):
        monter("a_surveiller", "urines_foncees")
    if a("autre") and fort:
        monter("a_surveiller", "autre_fort")

    if fort and plusieurs_jours:
        monter("a_surveiller", "fort_plusieurs_jours")

    return niveau, list(dict.fromkeys(raisons))


def niveau_depuis_extraction(x, traitement_recent=False):
    """Applique les valeurs par défaut de l'application (voice-triage.service.ts : versEntree)."""
    duree = x.get("duree", "inconnue")
    intensite = x.get("intensite", "inconnue")
    return evaluer_triage(
        set(x.get("symptomes", [])),
        "aujourdhui" if duree == "inconnue" else duree,
        "leger" if intensite == "inconnue" else intensite,
        list(dict.fromkeys(x.get("signes_graves", []))),
        traitement_recent,
    )[0]
