-- =============================================================================
-- VIHEPAT : données de démonstration de l'agenda (équivalent de scripts/seed-agenda.ts)
-- À exécuter dans phpMyAdmin > base VIHEPAT > onglet SQL > Exécuter.
--
-- - Ne touche QUE les patients de démonstration (e-mail en @example.com, codes VHP-2026-10000x).
-- - Rejouable : les rendez-vous de démonstration (note « [demo-agenda] ») sont d'abord supprimés,
--   puis recréés avec des dates calculées à partir d'aujourd'hui (heure du Bénin).
-- - Un bilan d'inclusion déjà saisi n'est jamais modifié.
-- - Aucun e-mail n'est envoyé : les rendez-vous passés sont marqués « rappel envoyé ».
--   Les rendez-vous de demain recevront le rappel automatique de la veille (adresses @example.com,
--   qui n'existent pas : sans conséquence).
-- Pour tout retirer : voir la section NETTOYAGE en bas du fichier.
-- =============================================================================

-- Aujourd'hui, heure du Bénin (UTC+1), comme l'API
SET @j0 = DATE(UTC_TIMESTAMP() + INTERVAL 1 HOUR);

-- 1. Retire les rendez-vous de démonstration existants
DELETE rv FROM rendez_vous rv
JOIN patients p ON p.id = rv.patient_id
JOIN users u ON u.id = p.user_id
WHERE u.email LIKE '%@example.com' AND rv.notes LIKE '[demo-agenda]%';

-- 2. Scénarios : jour relatif (0 = aujourd'hui), heure, motif, statut
DROP TEMPORARY TABLE IF EXISTS demo_agenda;
CREATE TEMPORARY TABLE demo_agenda (
  code VARCHAR(20), j INT, heure CHAR(5), motif VARCHAR(200),
  statut ENUM('prevu','confirme','effectue','manque','annule')
);
INSERT INTO demo_agenda (code, j, heure, motif, statut) VALUES
  -- Awa Mensah (VIH, risque élevé) : aucun rendez-vous à venir -> alerte « à planifier en priorité »
  ('VHP-2026-100001', -45, '09:00', 'Bilan annuel', 'effectue'),
  -- Kofi Agossou
  ('VHP-2026-100002', -84, '09:00', 'Bilan de suivi trimestriel', 'effectue'),
  ('VHP-2026-100002',  -2, '10:00', 'Charge virale', 'effectue'),
  ('VHP-2026-100002',   0, '15:00', 'Remise des résultats', 'confirme'),
  ('VHP-2026-100002',  88, '09:00', 'Bilan de suivi trimestriel', 'prevu'),
  -- Fatou Diallo
  ('VHP-2026-100003', -30, '11:00', 'Échographie hépatique', 'manque'),
  ('VHP-2026-100003',   1, '09:30', 'Contrôle des transaminases', 'prevu'),
  ('VHP-2026-100003', 180, '09:30', 'Suivi semestriel hépatite B', 'prevu'),
  -- Espoir Dossou (VIH + VHB, risque modéré)
  ('VHP-2026-100004', -14, '14:00', 'Début de traitement', 'effectue'),
  ('VHP-2026-100004',   1, '09:15', 'Contrôle J15', 'confirme'),
  ('VHP-2026-100004',  16, '09:00', 'Contrôle M1', 'prevu'),
  ('VHP-2026-100004',  76, '09:00', 'Contrôle M3', 'prevu'),
  -- Grâce Adjovi (VIH, risque faible)
  ('VHP-2026-100005', -60, '08:30', 'Renouvellement ARV', 'effectue'),
  ('VHP-2026-100005',  -7, '08:30', 'Renouvellement ARV', 'manque'),
  ('VHP-2026-100005',   3, '08:30', 'Rattrapage du rendez-vous manqué', 'prevu'),
  ('VHP-2026-100005',   5, '10:00', 'Consultation observance', 'annule'),
  -- Marcel Tossou
  ('VHP-2026-100006',   0, '10:30', 'Consultation de suivi', 'prevu'),
  ('VHP-2026-100006',   7, '11:00', 'Entretien avec la médiatrice', 'prevu'),
  ('VHP-2026-100006',  35, '11:00', 'Charge virale', 'prevu');

-- 3. Crée les rendez-vous, avec le soignant attribué au patient
INSERT INTO rendez_vous (patient_id, soignant_id, date_heure, motif, statut, notes, rappel_envoye_le, rappel_auto, created_at, updated_at)
SELECT
  p.id,
  (SELECT a.soignant_id FROM affectations a WHERE a.patient_id = p.id ORDER BY a.id LIMIT 1),
  TIMESTAMP(@j0 + INTERVAL d.j DAY, d.heure),
  d.motif,
  d.statut,
  '[demo-agenda] rendez-vous de démonstration',
  -- Passés : rappel déjà envoyé la veille ; à venir : rappel automatique prévu
  CASE WHEN TIMESTAMP(@j0 + INTERVAL d.j DAY, d.heure) < UTC_TIMESTAMP() + INTERVAL 1 HOUR AND d.statut <> 'annule'
       THEN TIMESTAMP(@j0 + INTERVAL d.j DAY, d.heure) - INTERVAL 1 DAY ELSE NULL END,
  1,
  NOW(), NOW()
FROM demo_agenda d
JOIN patients p ON p.code_patient = d.code
JOIN users u ON u.id = p.user_id AND u.email LIKE '%@example.com';

-- 4. Bilans d'inclusion (patients VIH sans bilan) : trois niveaux de risque de perte de suivi
INSERT INTO bilans_inclusion (patient_id, soignant_id, date_bilan, situation_matrimoniale, niveau_etudes, stade_oms, cd4, charge_virale,
                              alat, creatinine, hemoglobine, plaquettes, proteines_totales, uree, leucocytes, created_at, updated_at)
SELECT p.id, NULL, b.date_bilan, b.situation, b.etudes, b.stade, b.cd4, b.cv, b.alat, b.creat, b.hb, b.plaq, b.prot, b.uree, b.leuco, NOW(), NOW()
FROM (
  -- Awa : bilan très incomplet, hémoglobine basse -> risque élevé (~88 %)
  SELECT 'VHP-2026-100001' code, @j0 - INTERVAL 2 MONTH date_bilan, 'celibataire' situation, 'aucun' etudes,
         NULL stade, NULL cd4, NULL cv, NULL alat, NULL creat, 7 hb, NULL plaq, NULL prot, NULL uree, NULL leuco
  UNION ALL
  -- Espoir : risque modéré (~46 %)
  SELECT 'VHP-2026-100004', @j0 - INTERVAL 10 MONTH, 'separe', 'primaire', 2, 320, 12000, 35, 80, 11.5, NULL, NULL, NULL, NULL
  UNION ALL
  -- Grâce : bilan complet, charge virale indétectable -> risque faible (~21 %)
  SELECT 'VHP-2026-100005', @j0 - INTERVAL 48 MONTH, 'marie', 'superieur', 1, 720, 20, 22, 70, 13.8, 250, 72, 4.5, 6.2
) b
JOIN patients p ON p.code_patient = b.code
JOIN users u ON u.id = p.user_id AND u.email LIKE '%@example.com'
WHERE NOT EXISTS (SELECT 1 FROM bilans_inclusion x WHERE x.patient_id = p.id);

DROP TEMPORARY TABLE IF EXISTS demo_agenda;

-- 5. Contrôle : ce qui a été créé
SELECT p.code_patient, u.prenom, u.nom, COUNT(rv.id) AS rendez_vous,
       SUM(rv.date_heure >= UTC_TIMESTAMP() + INTERVAL 1 HOUR AND rv.statut IN ('prevu','confirme')) AS a_venir,
       (SELECT COUNT(*) FROM bilans_inclusion x WHERE x.patient_id = p.id) AS bilan
FROM patients p
JOIN users u ON u.id = p.user_id AND u.email LIKE '%@example.com'
LEFT JOIN rendez_vous rv ON rv.patient_id = p.id AND rv.notes LIKE '[demo-agenda]%'
GROUP BY p.id, p.code_patient, u.prenom, u.nom
ORDER BY p.code_patient;

-- =============================================================================
-- NETTOYAGE (à exécuter seul, pour retirer les données de démonstration) :
--
-- DELETE rv FROM rendez_vous rv JOIN patients p ON p.id = rv.patient_id JOIN users u ON u.id = p.user_id
--   WHERE u.email LIKE '%@example.com' AND rv.notes LIKE '[demo-agenda]%';
-- DELETE b FROM bilans_inclusion b JOIN patients p ON p.id = b.patient_id JOIN users u ON u.id = p.user_id
--   WHERE u.email LIKE '%@example.com' AND b.soignant_id IS NULL;
-- =============================================================================
