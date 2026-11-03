# ElevenLabs Scribe sur les vraies notes vocales (2026-11-03)

Chaîne de production : ElevenLabs (scribe_v2) -> Gemini (prompt extraction-v2) -> union avec le lexique -> règles. 18 notes, **un seul locuteur**.

- **Français** : taux d'erreur de mots 16.0 % (23/144 mots) ; niveau de triage correct 8/9 ; alertes ratées 1/9
- **Fon** : notes correctement écartées (jamais prises pour du français) 9/9
- **Délai de transcription** : médiane 1208 ms, maximum 3352 ms

| Note | Langue | Langue détectée (probabilité) | Erreur de mots | Niveau obtenu | Niveau attendu | Délai |
|---|---|---|---|---|---|---|
| fon_L1_V016 | fon | vie (0.66) | — | abstention (correct) | alerte | 2197 ms |
| fon_L1_V039 | fon | cat (0.23) | — | abstention (correct) | alerte | 1811 ms |
| fon_L1_V097 | fon | vie (0.28) | — | abstention (correct) | alerte | 1853 ms |
| fon_L1_V098 | fon | vie (0.12) | — | abstention (correct) | alerte | 1137 ms |
| fon_L1_V103 | fon | vie (0.91) | — | abstention (correct) | alerte | 1190 ms |
| fon_L1_V125 | fon | cat (0.24) | — | abstention (correct) | alerte | 3352 ms |
| fon_L1_V126 | fon | cat (0.77) | — | abstention (correct) | alerte | 953 ms |
| fon_L1_V148 | fon | ita (0.95) | — | abstention (correct) | alerte | 1266 ms |
| fon_L1_V161 | fon | yor (0.25) | — | abstention (correct) | alerte | 1260 ms |
| fr_L1_V039 | fr | fra (0.99) | 0 % | alerte | alerte | 532 ms |
| fr_L1_V055 | fr | fra (1.00) | 0 % | alerte | alerte | 1590 ms |
| fr_L1_V097 | fr | fra (0.93) | 46 % | alerte | alerte | 1106 ms |
| fr_L1_V098 | fr | fra (1.00) | 6 % | alerte | alerte | 866 ms |
| fr_L1_V103 | fr | fra (1.00) | 0 % | alerte | alerte | 1208 ms |
| fr_L1_V125 | fr | fra (0.98) | 0 % | alerte | alerte | 1300 ms |
| fr_L1_V126 | fr | fra (0.99) | 91 % | alerte | alerte | 1036 ms |
| fr_L1_V148 | fr | fra (0.97) | 55 % | banal | alerte | 1117 ms |
| fr_L1_V161 | fr | fra (1.00) | 0 % | alerte | alerte | 890 ms |
