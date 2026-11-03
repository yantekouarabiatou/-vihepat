## Jeu « controle », variante « mots-cles » (prompt extraction-v2, 2026-11-03)

| Signe | Trouvés | Rappel | Faux positifs |
|---|---|---|---|
| respiration | 6/7 | 86 % | 1 |
| poitrine | 7/7 | 100 % | 1 |
| confusion | 6/7 | 86 % | 0 |
| vomit_traitement | 6/7 | 86 % | 1 |
| saignement | 7/7 | 100 % | 0 |
| malaise | 7/7 | 100 % | 0 |
| idees_noires | 7/7 | 100 % | 0 |

- Messages graves sans AUCUN signe détecté (alerte ratée) : 2/49
- Messages négatifs déclenchant un signe (fausse alerte) : 1/21

    MANQUÉ  R1 respiration : Je n'arrive plus à finir mes phrases sans reprendre de l'air.
    EN TROP P2 respiration : J'ai un point très douloureux sur le côté de la poitrine quand je respire fort.
    MANQUÉ  C3 confusion : Je ne peux pas toucher mon menton avec ma poitrine, ça fait trop mal à la nuque.
    EN TROP C3 poitrine : Je ne peux pas toucher mon menton avec ma poitrine, ça fait trop mal à la nuque.
    MANQUÉ  V3 vomit_traitement : Le médicament ne tient pas, je le vomis presque aussitôt.
    EN TROP N6 vomit_traitement : Je garde bien mes comprimés, aucun vomissement.
