## Jeu « controle », variante « union » (prompt extraction-v2, 2026-11-03)

| Signe | Trouvés | Rappel | Faux positifs |
|---|---|---|---|
| respiration | 7/7 | 100 % | 1 |
| poitrine | 7/7 | 100 % | 1 |
| confusion | 6/7 | 86 % | 0 |
| vomit_traitement | 7/7 | 100 % | 1 |
| saignement | 7/7 | 100 % | 0 |
| malaise | 7/7 | 100 % | 0 |
| idees_noires | 7/7 | 100 % | 0 |

- Messages graves sans AUCUN signe détecté (alerte ratée) : 0/49
- Messages négatifs déclenchant un signe (fausse alerte) : 1/21

    EN TROP P2 respiration : J'ai un point très douloureux sur le côté de la poitrine quand je respire fort.
    MANQUÉ  C3 confusion : Je ne peux pas toucher mon menton avec ma poitrine, ça fait trop mal à la nuque.
    EN TROP C3 poitrine : Je ne peux pas toucher mon menton avec ma poitrine, ça fait trop mal à la nuque.
    EN TROP N6 vomit_traitement : Je garde bien mes comprimés, aucun vomissement.
