## Jeu « controle », variante « gemini » (prompt extraction-v1, 2026-11-03)

| Signe | Trouvés | Rappel | Faux positifs |
|---|---|---|---|
| respiration | 7/7 | 100 % | 1 |
| poitrine | 7/7 | 100 % | 0 |
| confusion | 5/7 | 71 % | 1 |
| vomit_traitement | 7/7 | 100 % | 0 |
| saignement | 5/7 | 71 % | 0 |
| malaise | 7/7 | 100 % | 0 |
| idees_noires | 7/7 | 100 % | 2 |

- Messages graves sans AUCUN signe détecté (alerte ratée) : 4/49
- Messages négatifs déclenchant un signe (fausse alerte) : 2/21

    EN TROP P2 respiration : J'ai un point très douloureux sur le côté de la poitrine quand je respire fort.
    MANQUÉ  C2 confusion : Mon cou est dur comme du bois et j'ai une fièvre très forte.
    MANQUÉ  C3 confusion : Je ne peux pas toucher mon menton avec ma poitrine, ça fait trop mal à la nuque.
    MANQUÉ  S2 saignement : Mes urines sont rouges comme du jus de bissap, pas à cause de la boisson.
    MANQUÉ  S5 saignement : Mes selles sont toutes noires et collantes.
    EN TROP M1 confusion : Je suis tombé raide au travail et je ne me souviens de rien.
    EN TROP N9 idees_noires : Je veux vivre pour voir grandir mes enfants.
    EN TROP N19 idees_noires : Je n'ai pas envie de mourir, je veux guérir.
