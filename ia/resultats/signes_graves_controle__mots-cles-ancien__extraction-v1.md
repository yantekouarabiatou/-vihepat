## Jeu « controle », variante « mots-cles » (prompt extraction-v1, 2026-11-03)

| Signe | Trouvés | Rappel | Faux positifs |
|---|---|---|---|
| respiration | 4/7 | 57 % | 3 |
| poitrine | 1/7 | 14 % | 2 |
| confusion | 0/7 | 0 % | 1 |
| vomit_traitement | 0/7 | 0 % | 0 |
| saignement | 5/7 | 71 % | 2 |
| malaise | 2/7 | 29 % | 1 |
| idees_noires | 1/7 | 14 % | 0 |

- Messages graves sans AUCUN signe détecté (alerte ratée) : 34/49
- Messages négatifs déclenchant un signe (fausse alerte) : 7/21

    MANQUÉ  R1 respiration : Je n'arrive plus à finir mes phrases sans reprendre de l'air.
    MANQUÉ  R4 respiration : J'ai l'impression d'avoir un sac sur la tête, je manque d'oxygène.
    MANQUÉ  R6 respiration : Je tousse et je m'étrangle, l'air ne veut pas entrer.
    MANQUÉ  P1 poitrine : Une barre me serre au niveau du coeur depuis tout à l'heure.
    MANQUÉ  P2 poitrine : J'ai un point très douloureux sur le côté de la poitrine quand je respire fort.
    EN TROP P2 respiration : J'ai un point très douloureux sur le côté de la poitrine quand je respire fort.
    MANQUÉ  P3 poitrine : Ça brûle et ça serre derrière le sternum.
    MANQUÉ  P4 poitrine : mal dans le thorax qui monte vers la machoire
    MANQUÉ  P5 poitrine : Ma poitrine me fait souffrir depuis ce matin.
    MANQUÉ  P6 poitrine : Douleur au torse, comme si on appuyait dessus.
    MANQUÉ  C1 confusion : Mon père ne sait plus où il habite et il parle à des gens qui ne sont pas là.
    MANQUÉ  C2 confusion : Mon cou est dur comme du bois et j'ai une fièvre très forte.
    MANQUÉ  C3 confusion : Je ne peux pas toucher mon menton avec ma poitrine, ça fait trop mal à la nuque.
    EN TROP C3 poitrine : Je ne peux pas toucher mon menton avec ma poitrine, ça fait trop mal à la nuque.
    MANQUÉ  C4 confusion : Elle est très endormie, on n'arrive pas à la réveiller vraiment.
    MANQUÉ  C5 confusion : Je mélange tout, je confonds mes enfants.
    MANQUÉ  C6 confusion : Il est agité et il dit des choses sans sens depuis la fièvre.
    MANQUÉ  C7 confusion : j'ai la tete dans le brouillard je ne sais plus ce que je fais
    MANQUÉ  V1 vomit_traitement : Mes cachets de traitement remontent à chaque fois.
    MANQUÉ  V2 vomit_traitement : J'ai rejeté tous mes antirétroviraux depuis samedi.
    MANQUÉ  V3 vomit_traitement : Le médicament ne tient pas, je le vomis presque aussitôt.
    MANQUÉ  V4 vomit_traitement : Je dégueule mes comprimés du soir.
    MANQUÉ  V5 vomit_traitement : Impossible de prendre le TLD sans vomir.
    MANQUÉ  V6 vomit_traitement : Je vomis juste après chaque dose de mon traitement.
    MANQUÉ  V7 vomit_traitement : Mes pilules sortent avec le vomi.
    MANQUÉ  S2 saignement : Mes urines sont rouges comme du jus de bissap, pas à cause de la boisson.
    MANQUÉ  S5 saignement : Mes selles sont toutes noires et collantes.
    MANQUÉ  M2 malaise : J'ai eu un black-out et je me suis retrouvé au sol.
    MANQUÉ  M3 malaise : Ma soeur s'est effondrée dans la cour et ne répondait plus.
    MANQUÉ  M4 malaise : J'ai perdu conscience un instant en me levant du lit.
    MANQUÉ  M6 malaise : Tout a tourné et je me suis écroulé par terre.
    MANQUÉ  M7 malaise : j'ai fait une syncope au marché de Dantokpa
    MANQUÉ  I1 idees_noires : J'ai envie d'arrêter de vivre.
    MANQUÉ  I3 idees_noires : Je ne vois plus aucune raison de continuer à vivre.
    MANQUÉ  I4 idees_noires : Ma famille serait plus tranquille si je n'étais plus là.
    MANQUÉ  I5 idees_noires : Je veux dormir et ne jamais me réveiller.
    MANQUÉ  I6 idees_noires : J'ai acheté de quoi m'empoisonner.
    MANQUÉ  I7 idees_noires : je pense a me suicider depuis que je sais pour la maladie
    EN TROP N2 respiration : Ma respiration est normale, je n'ai aucun souci de ce côté.
    EN TROP N3 poitrine : Pas de douleur au coeur ni à la poitrine.
    EN TROP N4 saignement : J'ai fait une prise de sang pour la charge virale.
    EN TROP N8 malaise : Mon téléphone est tombé dans l'eau.
    EN TROP N11 respiration : Je suis un peu essoufflé après le football, c'est normal.
    EN TROP N18 saignement : Le moustique m'a piqué, il y a une petite goutte de sang.
    EN TROP N21 confusion : Je suis confus sur l'heure de mon rendez-vous, vous pouvez me la redonner ?
