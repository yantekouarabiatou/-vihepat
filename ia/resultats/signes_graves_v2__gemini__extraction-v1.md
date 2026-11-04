## Variante « gemini » (prompt extraction-v1, 2026-11-03)

| Signe | Trouvés | Rappel | Faux positifs |
|---|---|---|---|
| respiration | 13/13 | 100 % | 1 |
| poitrine | 12/12 | 100 % | 2 |
| confusion | 8/12 | 67 % | 0 |
| vomit_traitement | 12/12 | 100 % | 0 |
| saignement | 11/15 | 73 % | 0 |
| malaise | 13/13 | 100 % | 2 |
| idees_noires | 11/11 | 100 % | 0 |

- Messages graves sans AUCUN signe détecté (alerte ratée) : 7/80
- Messages négatifs déclenchant un signe (fausse alerte) : 1/30

    EN TROP R04 poitrine : Ma poitrine siffle et j'ai l'impression de manquer d'air depuis trois jours.
    EN TROP R05 malaise : La nuit je me réveille en cherchant mon air, c'est la panique.
    EN TROP R08 poitrine : Respirer me fait mal et je suis vite à bout de souffle en marchant.
    EN TROP P07 respiration : Ça pique fort dans ma cage thoracique à chaque inspiration.
    MANQUÉ  C02 confusion : J'ai la nuque raide et très mal à la tête, je supporte pas la lumière.
    MANQUÉ  C03 confusion : Je n'arrive pas à baisser la tête, mon cou est tout bloqué, et j'ai de la fièvre.
    MANQUÉ  C04 confusion : Je m'endors partout, même en mangeant, je n'arrive pas à rester éveillé.
    MANQUÉ  C07 confusion : J'ai le cou raide et je vomis, la tête va exploser.
    MANQUÉ  S01 saignement : Il y a du sang dans mes selles depuis deux jours.
    MANQUÉ  S06 saignement : Mes selles sont noires comme du goudron.
    MANQUÉ  S08 saignement : Il y a du rouge dans mon pipi.
    MANQUÉ  X06 saignement : Sang dans les selles et j'ai fait un malaise en me levant.
    EN TROP N21 malaise : Ma tête tourne un peu quand je me lève vite, sans tomber.
