import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import * as patientService from './patient.service';
import type { Gravite } from '../models/Signalement';
import { genererContenu, geminiConfigure, type GeminiTour } from '../ia/gemini.client';
import { detecterSignesGraves, type SigneGrave } from '../ia/signes-graves';

const client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

const MODEL = 'claude-opus-5';
const MAX_ITERATIONS = 4;

const SYSTEM_PROMPT_PATIENT = `Tu es l'assistant de santé et de signalement de symptômes de VIHEPAT, plateforme nationale de suivi du VIH et des hépatites virales au Bénin.

Ton rôle :
- Aider le patient avec empathie, bienveillance et dans un français simple et clair.
- Si le patient décrit un symptôme ou un malaise, pose UNE seule question à la fois pour clarifier (intensité, durée, gêne).
- Dès que le symptôme est clair, utilise l'outil "file_signalement" pour l'enregistrer dans son dossier médical. N'attends pas trop d'échanges.
- Signes de gravité (les mêmes que le triage de l'application) : difficulté à respirer, douleur ou serrement dans la poitrine, confusion ou somnolence anormale ou nuque raide avec fièvre, vomissement du traitement (le patient ne garde pas ses comprimés ou ses ARV), saignement (sang dans les selles, les urines, les crachats ou les vomissements, selles noires, saignement qui ne s'arrête pas), malaise ou perte de connaissance, idées de mort ou de se faire du mal. Dès qu'un de ces signes est décrit, classe en gravité "severe", enregistre le signalement SANS poser d'abord de question, et oriente sans attendre : centre de santé le plus proche ou urgences (166 / 112). Un traitement vomi n'est pas absorbé : c'est un signe de gravité, même sans autre symptôme.
- Tu n'es PAS médecin, tu ne poses aucun diagnostic et ne modifies aucun traitement. Reste concis (1 à 3 phrases).`;

const SYSTEM_PROMPT_PUBLIC = `Tu es l'assistant d'information et d'orientation de VIHEPAT, la plateforme nationale béninoise dédiée à la prise en charge et au suivi du VIH et des hépatites virales (B et C).

Ton rôle :
- Répondre avec clarté, bienveillance et rigueur aux questions sur la prévention, la transmission, le dépistage et les traitements des hépatites et du VIH au Bénin.
- Rappeler que le dépistage est rapide, confidentiel et accessible dans les centres de santé et hôpitaux du Bénin (CHU Cotonou, HZ Calavi, etc.).
- Encourager la consultation auprès des professionnels de santé. Ne poser aucun diagnostic personnalisé.`;

const FILE_SIGNALEMENT_TOOL: Anthropic.Tool = {
  name: 'file_signalement',
  description:
    "Enregistre un signalement de symptôme structuré pour l'équipe soignante, une fois que le symptôme et sa gravité sont clairs.",
  input_schema: {
    type: 'object',
    properties: {
      symptome: {
        type: 'string',
        description: 'Description courte du symptôme (ex. "fièvre et fatigue depuis 2 jours")',
      },
      gravite: {
        type: 'string',
        enum: ['leger', 'modere', 'severe'],
        description: 'Estimation de la gravité du symptôme',
      },
      notes: {
        type: 'string',
        description: "Détails complémentaires utiles pour le soignant (contexte, durée, autres symptômes associés)",
      },
    },
    required: ['symptome', 'gravite'],
  },
};

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  reply: string;
  signalementCreated: boolean;
}

function isToolUseBlock(block: Anthropic.ContentBlock): block is Anthropic.ToolUseBlock {
  return block.type === 'tool_use';
}

function isTextBlock(block: Anthropic.ContentBlock): block is Anthropic.TextBlock {
  return block.type === 'text';
}

/**
 * Assistant de secours intelligent lorsque la clé API Anthropic n'est pas renseignée.
 * Assure une réponse médicale empathique et enregistre les signalements des patients connectés.
 */
async function generateSmartFallback(
  userId: number | null | undefined,
  role: string | null | undefined,
  history: ChatTurn[]
): Promise<ChatResult> {
  const lastUserTurn = [...history].reverse().find((h) => h.role === 'user');
  const text = (lastUserTurn?.content || '').toLowerCase();

  // 1. Détection des urgences vitales
  const isUrgence = /(poitrine|thorax|difficulte a respirer|etouff|inconscient|evanou|saign|coma|suicid|convulsion)/i.test(text);
  if (isUrgence) {
    if (userId && role === 'patient') {
      try {
        await patientService.createSignalement(userId, {
          symptome: lastUserTurn?.content || 'Signes potentiellement urgents signalés via assistant',
          gravite: 'severe',
          notes: 'Signalement prioritaire généré automatiquement par le service d assistance.',
        });
        return {
          reply:
            "⚠️ ATTENTION : Vos propos évoquent des signes pouvant nécessiter une prise en charge urgente. Un signalement d'alerte maximale a été transmis à votre équipe médicale. Contactez sans attendre le 166 (SAMU) ou rendez-vous au service d'urgences le plus proche.",
          signalementCreated: true,
        };
      } catch {
        // En cas d'erreur de création, renvoyer la consigne d'urgence
      }
    }
    return {
      reply:
        "⚠️ ATTENTION : Ces symptômes peuvent représenter une urgence médicale. Veuillez contacter immédiatement les services d'urgence au 166 / 112 ou vous rendre dans le centre hospitalier le plus proche sans attendre.",
      signalementCreated: false,
    };
  }

  // 2. Détection de symptômes courants chez un patient connecté
  const hasSymptoms = /(fievre|chaud|mal de tete|cephalee|nausee|vomir|vomissement|fatigue|toux|diarrhee|bouton|eruption|vertige|douleur|ventre|courbature)/i.test(text);
  if (hasSymptoms && userId && role === 'patient') {
    const isModerateOrSevere = /(tres mal|insupportable|depuis plusieurs jours|depuis 3 jours|depuis une semaine|intense|fort|brulure)/i.test(text);
    const gravite: Gravite = isModerateOrSevere ? 'modere' : 'leger';

    try {
      await patientService.createSignalement(userId, {
        symptome: lastUserTurn?.content || 'Symptômes rapportés via assistant',
        gravite,
        notes: 'Transmis automatiquement par l assistant conversationnel VIHEPAT.',
      });

      return {
        reply: `J'ai bien pris en compte ce que vous ressentez (« ${lastUserTurn?.content} »). Votre équipe soignante a été notifiée dans votre dossier médical. Pensez à bien vous hydrater, prenez du repos et continuez scrupuleusement vos prises habituelles. Si la gêne s'amplifie, contactez votre centre référent.`,
        signalementCreated: true,
      };
    } catch {
      // Suite en cas d'impossibilité
    }
  }

  // 3. Oubli de traitement ou question posologie
  if (/(oubli|traitement|medicament|pilule|retard|posologie|prise|arv|comprime)/i.test(text)) {
    return {
      reply:
        "Si vous avez oublié une prise : prenez votre médicament dès que vous y pensez, sauf si l'heure de la prise suivante est très proche (ne doublez jamais les doses). La régularité de vos horaires est la clé pour garder le virus indétectable. Vous pouvez aussi valider votre prise du jour dans l'onglet Traitements.",
      signalementCreated: false,
    };
  }

  // 4. Questions sur le dépistage ou la transmission
  if (/(depistage|test|depister|transmission|attraper|contag|serologie|prix|gratuit|centre)/i.test(text)) {
    return {
      reply:
        "Le dépistage du VIH et des hépatites virales est simple, rapide et confidentiel au Bénin. Il est disponible dans tous les centres de santé de zone, hôpitaux départementaux et centres de référence (CHU Cotonou, HZ Calavi, Parakou...). Un dépistage régulier permet une prise en charge précoce et gratuite.",
      signalementCreated: false,
    };
  }

  // 5. Salutations / Accueil personnalisé selon le rôle
  if (/(bonjour|salut|bonsoir|aide|comment|qui es-tu|qui est tu|hello)/i.test(text)) {
    if (role === 'soignant' || role === 'admin') {
      return {
        reply:
          "Bonjour ! Je suis l'assistant VIHEPAT pour l'équipe soignante. Je peux vous renseigner sur les protocoles de suivi, l'interprétation des seuils de charge virale ou l'utilisation des outils de la plateforme.",
        signalementCreated: false,
      };
    }
    if (role === 'patient') {
      return {
        reply:
          "Bonjour ! Je suis là pour vous accompagner. Décrivez-moi ce que vous ressentez ou posez-moi vos questions sur votre suivi de santé. Vous pouvez aussi utiliser le micro pour me parler.",
        signalementCreated: false,
      };
    }
    return {
      reply:
        "Bonjour et bienvenue sur la plateforme nationale VIHEPAT ! Je suis votre assistant santé. Posez-moi vos questions sur le VIH, les hépatites virales B et C, le dépistage ou l'accès aux soins au Bénin.",
      signalementCreated: false,
    };
  }

  // 6. Réponse par défaut bienveillante
  return {
    reply:
      "J'ai bien reçu votre message. Pour toute question médicale spécifique ou symptôme persistant, votre équipe soignante reste votre interlocuteur de confiance. N'hésitez pas à me donner plus de précisions si vous souhaitez que je vous oriente.",
    signalementCreated: false,
  };
}

/** Ajoutée à la réponse quand un signalement est créé : sert aussi à ne pas en créer un second. */
const CONFIRMATION_SIGNALEMENT = '✅ Votre signalement a été transmis à votre équipe soignante.';

const CONSIGNE_JSON_GEMINI = `

Format de réponse : un objet JSON.
- « reponse » : ton message au patient (1 à 3 phrases, français simple).
- « signalement » : rempli UNIQUEMENT quand le symptôme est assez clair pour être transmis à l'équipe soignante (symptôme, gravité, notes utiles), sinon null. Un seul signalement par conversation : si l'historique contient déjà « Votre signalement a été transmis », mets null.`;

const SCHEMA_GEMINI_PATIENT = {
  type: 'OBJECT',
  properties: {
    reponse: { type: 'STRING' },
    signalement: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        symptome: { type: 'STRING' },
        gravite: { type: 'STRING', enum: ['leger', 'modere', 'severe'] },
        notes: { type: 'STRING' },
      },
      required: ['symptome', 'gravite'],
    },
  },
  required: ['reponse'],
};
const SCHEMA_GEMINI_PUBLIC = { type: 'OBJECT', properties: { reponse: { type: 'STRING' } }, required: ['reponse'] };

/** Historique du widget -> conversation Gemini : commence et finit par l'utilisateur, rôles alternés. */
function versTours(history: ChatTurn[]): GeminiTour[] {
  const tours: GeminiTour[] = [];
  for (const h of history) {
    const role = h.role === 'assistant' ? 'model' : 'user';
    if (!tours.length && role === 'model') continue; // message d'accueil du widget
    const dernier = tours[tours.length - 1];
    if (dernier && dernier.role === role) dernier.parts.push({ text: h.content });
    else tours.push({ role, parts: [{ text: h.content }] });
  }
  return tours;
}

/**
 * Requête envoyée à Gemini pour le chat, isolée pour pouvoir l'évaluer telle quelle sans rien écrire
 * en base (backend/scripts/evaluer-assistant.ts). Null si le dernier tour n'est pas de l'utilisateur.
 */
export function requeteChatGemini(isPatient: boolean, history: ChatTurn[]) {
  const contents = versTours(history);
  if (!contents.length || contents[contents.length - 1]!.role !== 'user') return null;
  return {
    system: (isPatient ? SYSTEM_PROMPT_PATIENT : SYSTEM_PROMPT_PUBLIC)
      .replace(/utilise l'outil "file_signalement" pour l'enregistrer/g, "remplis le champ « signalement » pour l'enregistrer")
      .replace(/enregistre le signalement/g, 'remplis le champ « signalement »') + CONSIGNE_JSON_GEMINI,
    contents,
    schema: isPatient ? SCHEMA_GEMINI_PATIENT : SCHEMA_GEMINI_PUBLIC,
    temperature: 0.3,
    responseMimeType: 'application/json',
  };
}

/** Chat avec Gemini quand aucune clé Anthropic n'est configurée. */
async function sendChatGemini(userId: number | null | undefined, role: string | null | undefined, history: ChatTurn[]): Promise<ChatResult> {
  const isPatient = role === 'patient' && !!userId;
  const requete = requeteChatGemini(isPatient, history);
  if (!requete) return { reply: 'Message bien reçu.', signalementCreated: false };
  const g = await genererContenu(requete);
  const decision = deciderReponseGemini(isPatient, history, g.text);
  if (decision.signalement) await patientService.createSignalement(userId!, decision.signalement);
  return { reply: decision.reply, signalementCreated: !!decision.signalement };
}

type SignalementPropose = { symptome: string; gravite: Gravite; notes: string };

/**
 * Ce que l'assistant répond et le signalement à créer, à partir de la réponse JSON de Gemini.
 * Sans accès à la base : évalué tel quel par backend/scripts/evaluer-assistant*.ts.
 */
export function deciderReponseGemini(isPatient: boolean, history: ChatTurn[], texteGemini: string): { reply: string; signalement: SignalementPropose | null } {
  const r = JSON.parse(texteGemini) as { reponse?: string; signalement?: { symptome: string; gravite: Gravite; notes?: string } | null };
  let reply = (r.reponse ?? '').trim() || 'Message bien reçu.';
  let signalement: SignalementPropose | null = null;

  const dejaSignale = history.some((h) => h.role === 'assistant' && h.content.includes(CONFIRMATION_SIGNALEMENT));
  const s = r.signalement;
  if (isPatient && s && !dejaSignale && s.symptome?.trim() && ['leger', 'modere', 'severe'].includes(s.gravite)) {
    signalement = {
      symptome: s.symptome.trim().slice(0, 150),
      gravite: s.gravite,
      notes: `${s.notes?.trim() ? `${s.notes.trim()}\n` : ''}Signalement proposé par l'assistant conversationnel (Gemini).`,
    };
  }

  // Filet de sécurité déterministe : un signe grave reconnu par le lexique du triage impose un signalement
  // « severe » et une consigne d'orientation, même si Gemini l'a sous-estimé (rater une urgence coûte plus
  // cher qu'une alerte en trop ; lexique mesuré dans ia/RESULTATS_SIGNES_GRAVES.md).
  const dernier = [...history].reverse().find((h) => h.role === 'user')?.content ?? '';
  const graves = detecterSignesGraves(dernier);
  if (graves.length > 0) {
    if (isPatient && !dejaSignale) {
      signalement = {
        symptome: (signalement?.symptome ?? graves.map((g) => LIBELLE_SIGNE[g]).join(', ')).slice(0, 150),
        gravite: 'severe',
        notes: `${signalement?.notes ? `${signalement.notes}\n` : ''}Signe(s) de gravité détecté(s) : ${graves.map((g) => LIBELLE_SIGNE[g]).join(', ')}.`,
      };
    }
    if (!URGENCE_DANS_REPONSE.test(normaliser(reply))) reply = `${reply}\n\n${consigneUrgence(graves, isPatient)}`;
  }

  if (signalement) reply = `${reply}\n\n${CONFIRMATION_SIGNALEMENT}`;
  return { reply, signalement };
}

/** Sans IA : si le message décrit un signe grave, consigne d'orientation (et signalement « severe » pour un patient) */
async function reponseUrgenceSansIA(userId: number | null | undefined, role: string | null | undefined, history: ChatTurn[]): Promise<ChatResult | null> {
  const dernier = [...history].reverse().find((h) => h.role === 'user')?.content ?? '';
  const graves = detecterSignesGraves(dernier);
  if (graves.length === 0) return null;
  const isPatient = role === 'patient' && !!userId;
  const dejaSignale = history.some((h) => h.role === 'assistant' && h.content.includes(CONFIRMATION_SIGNALEMENT));
  let reply = consigneUrgence(graves, isPatient);
  let signalementCreated = false;
  if (isPatient && !dejaSignale) {
    await patientService.createSignalement(userId!, {
      symptome: graves.map((g) => LIBELLE_SIGNE[g]).join(', ').slice(0, 150),
      gravite: 'severe',
      notes: `Message du patient : « ${dernier.slice(0, 400)} »\nSigne(s) de gravité détecté(s) par l'assistant (sans IA, Gemini indisponible).`,
    });
    signalementCreated = true;
    reply = `${reply}\n\n${CONFIRMATION_SIGNALEMENT}`;
  }
  return { reply, signalementCreated };
}

const LIBELLE_SIGNE: Record<SigneGrave, string> = {
  respiration: 'difficulté à respirer',
  poitrine: 'douleur dans la poitrine',
  confusion: 'confusion, somnolence ou nuque raide',
  vomit_traitement: 'vomit son traitement',
  saignement: 'saignement',
  malaise: 'malaise ou perte de connaissance',
  idees_noires: 'idées de mort',
};
const URGENCE_DANS_REPONSE = /urgence|166|112|sans attendre|immediatement|tout de suite|au plus vite/;
const normaliser = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Consigne proportionnée au signe : urgences pour un danger vital, contact le jour même pour un traitement vomi */
function consigneUrgence(graves: SigneGrave[], isPatient: boolean) {
  const equipe = isPatient ? ' Votre équipe soignante est prévenue.' : '';
  if (graves.includes('idees_noires')) {
    return `Vous n'êtes pas seul(e). Parlez-en tout de suite à une personne de confiance et appelez le 166 ou rendez-vous au centre de santé le plus proche.${equipe}`;
  }
  if (graves.every((g) => g === 'vomit_traitement')) {
    return `Si vous ne gardez pas votre traitement, il ne vous protège plus : contactez votre centre de santé aujourd'hui, sans attendre votre prochain rendez-vous.${equipe}`;
  }
  return `Ces signes peuvent être graves : rendez-vous sans attendre au centre de santé le plus proche ou appelez le 166 (SAMU).${equipe}`;
}

export async function sendChatMessage(
  userId?: number | null,
  role?: string | null,
  history: ChatTurn[] = []
): Promise<ChatResult> {
  // Sans clé Anthropic : Gemini si configuré, sinon l'assistant médical embarqué
  if (!client) {
    if (geminiConfigure()) {
      try {
        return await sendChatGemini(userId, role, history);
      } catch (error) {
        console.warn('Échec du chat Gemini, utilisation du fallback médical :', (error as Error).message);
      }
    }
    // Gemini indisponible (surcharge, quota) : le filet de sécurité passe AVANT l'assistant de secours,
    // dont les réponses toutes faites ne conviennent pas à un signe grave (ex. traitement vomi)
    const urgence = await reponseUrgenceSansIA(userId, role, history);
    if (urgence) return urgence;
    return generateSmartFallback(userId, role, history);
  }

  const isPatient = role === 'patient' && !!userId;
  const systemPrompt = isPatient ? SYSTEM_PROMPT_PATIENT : SYSTEM_PROMPT_PUBLIC;
  const tools = isPatient ? [FILE_SIGNALEMENT_TOOL] : undefined;

  const messages: Anthropic.MessageParam[] = history.map((h) => ({ role: h.role, content: h.content }));
  let finalText = '';
  let signalementCreated = false;

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        ...(tools ? { tools } : {}),
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      const textBlock = response.content.find(isTextBlock);
      if (textBlock) finalText = textBlock.text;

      if (response.stop_reason === 'refusal') {
        finalText =
          "Désolé, je ne peux pas traiter cette demande. Pour toute préoccupation de santé, contactez directement votre centre médical.";
        break;
      }

      const toolUse = response.content.find(isToolUseBlock);
      if (!toolUse) break;

      if (isPatient && toolUse.name === 'file_signalement') {
        const input = toolUse.input as { symptome: string; gravite: Gravite; notes?: string };
        await patientService.createSignalement(userId!, input);
        signalementCreated = true;

        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: 'Signalement enregistré avec succès dans le dossier du patient.',
            },
          ],
        });
      }
    }

    return { reply: finalText || "Message bien reçu.", signalementCreated };
  } catch (error) {
    console.warn("Échec appel Claude Anthropic, utilisation du fallback médical :", error);
    return generateSmartFallback(userId, role, history);
  }
}
