## Variante « mots-cles » (prompt extraction-v1, 2026-11-03)

| Signe | Trouvés | Rappel | Faux positifs |
|---|---|---|---|
| respiration | 5/13 | 38 % | 3 |
| poitrine | 6/12 | 50 % | 0 |
| confusion | 4/12 | 33 % | 0 |
| vomit_traitement | 2/12 | 17 % | 0 |
| saignement | 12/15 | 80 % | 2 |
| malaise | 8/13 | 62 % | 0 |
| idees_noires | 3/11 | 27 % | 0 |

- Messages graves sans AUCUN signe détecté (alerte ratée) : 45/80
- Messages négatifs déclenchant un signe (fausse alerte) : 5/30

    MANQUÉ  R02 respiration : Quand je monte les escaliers je m'étouffe, l'air ne passe plus bien.
    MANQUÉ  R04 respiration : Ma poitrine siffle et j'ai l'impression de manquer d'air depuis trois jours.
    MANQUÉ  R05 respiration : La nuit je me réveille en cherchant mon air, c'est la panique.
    MANQUÉ  R06 respiration : J'ai une grosse toux et je n'arrive plus à respirer correctement.
    MANQUÉ  R07 respiration : Mes lèvres deviennent bleues et je halète.
    MANQUÉ  R10 respiration : J'étouffe un peu quand je suis allongé, je dors assis.
    MANQUÉ  P02 poitrine : Ça me fait très mal au milieu du thorax depuis une heure.
    MANQUÉ  P04 poitrine : douleur thoracique forte quand je bouge
    MANQUÉ  P07 poitrine : Ça pique fort dans ma cage thoracique à chaque inspiration.
    MANQUÉ  P08 poitrine : Une douleur dans le torse qui me réveille la nuit.
    MANQUÉ  P10 poitrine : Mal au thorax, ça m'inquiète beaucoup.
    MANQUÉ  C01 confusion : Ma femme dit que je raconte n'importe quoi depuis hier et je ne reconnais plus bien les gens.
    MANQUÉ  C03 confusion : Je n'arrive pas à baisser la tête, mon cou est tout bloqué, et j'ai de la fièvre.
    MANQUÉ  C04 confusion : Je m'endors partout, même en mangeant, je n'arrive pas à rester éveillé.
    MANQUÉ  C05 confusion : Je me perds dans mon propre quartier, je ne sais plus où je suis.
    MANQUÉ  C06 confusion : mon frère est tout mélangé, il oublie son nom et il parle bizarre
    MANQUÉ  C07 confusion : J'ai le cou raide et je vomis, la tête va exploser.
    MANQUÉ  C08 confusion : Depuis ce matin j'ai l'esprit embrouillé, je ne comprends plus ce qu'on me dit.
    MANQUÉ  C09 confusion : Je suis désorienté, je ne sais plus quel jour on est.
    MANQUÉ  V01 vomit_traitement : Chaque fois que j'avale mes ARV je les vomis dix minutes après.
    MANQUÉ  V03 vomit_traitement : je rend mes medocs a chaque prise depuis 2 jours
    MANQUÉ  V04 vomit_traitement : Je n'arrive pas à garder le traitement, je vomis tout.
    MANQUÉ  V05 vomit_traitement : Après la prise du matin, tout ressort, même l'eau.
    MANQUÉ  V06 vomit_traitement : Mon estomac refuse les médicaments, ils remontent tout de suite.
    MANQUÉ  V07 vomit_traitement : Je vomis mes cachets du soir depuis lundi.
    MANQUÉ  V08 vomit_traitement : Dès que je prends le Dolutégravir je vomis.
    MANQUÉ  V09 vomit_traitement : Impossible de garder mes pilules, je les recrache en vomissant.
    MANQUÉ  V10 vomit_traitement : J'ai vomi ma dose de ce matin et celle d'hier.
    MANQUÉ  S06 saignement : Mes selles sont noires comme du goudron.
    MANQUÉ  S08 saignement : Il y a du rouge dans mon pipi.
    MANQUÉ  S11 saignement : Hémorragie après l'accouchement, ça coule encore beaucoup.
    MANQUÉ  M04 malaise : Mes jambes ont lâché et je me suis retrouvé par terre sans comprendre.
    MANQUÉ  M06 malaise : Ma vue s'est brouillée et je me suis effondré.
    MANQUÉ  M07 malaise : J'ai eu une syncope en me levant.
    MANQUÉ  M08 malaise : Je me suis réveillé allongé dans la douche sans savoir comment.
    MANQUÉ  M10 malaise : Je perds l'équilibre et je m'écroule depuis hier.
    MANQUÉ  I01 idees_noires : Je n'ai plus envie de vivre, à quoi bon continuer.
    MANQUÉ  I02 idees_noires : Je pense à mettre fin à mes jours.
    MANQUÉ  I04 idees_noires : J'ai envie de disparaître pour de bon.
    MANQUÉ  I05 idees_noires : je veux plus me reveiller le matin
    MANQUÉ  I06 idees_noires : Je garde des comprimés de côté pour tout prendre d'un coup.
    MANQUÉ  I07 idees_noires : Ma vie n'a plus de sens depuis le diagnostic.
    MANQUÉ  I09 idees_noires : Parfois je pense que la mort serait un soulagement.
    MANQUÉ  X02 vomit_traitement : J'ai vomi mes ARV et maintenant je crache du sang.
    MANQUÉ  X04 idees_noires : Je suis à bout, je ne veux plus vivre et je n'arrive plus à respirer la nuit.
    MANQUÉ  X04 respiration : Je suis à bout, je ne veux plus vivre et je n'arrive plus à respirer la nuit.
    MANQUÉ  X07 respiration : J'étouffe et j'ai une douleur au thorax.
    MANQUÉ  X07 poitrine : J'étouffe et j'ai une douleur au thorax.
    EN TROP N02 respiration : Je respire bien, c'est seulement une petite toux sèche.
    EN TROP N04 saignement : J'ai donné mon sang au centre de transfusion samedi, tout va bien.
    EN TROP N15 respiration : Le souffle de l'harmattan me dessèche la peau.
    EN TROP N17 saignement : Je me suis piqué le doigt en cuisinant, une goutte de sang, c'est déjà fini.
    EN TROP N18 respiration : J'ai couru pour le bus et j'étais essoufflé une minute, puis ça allait.
