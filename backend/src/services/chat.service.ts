import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import * as patientService from './patient.service';
import type { Gravite } from '../models/Signalement';
import { genererContenu, geminiConfigure, type GeminiTour } from '../ia/gemini.client';

const client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

const MODEL = 'claude-opus-5';
const MAX_ITERATIONS = 4;

const SYSTEM_PROMPT_PATIENT = `Tu es l'assistant de santé et de signalement de symptômes de VIHEPAT, plateforme nationale de suivi du VIH et des hépatites virales au Bénin.

Ton rôle :
- Aider le patient avec empathie, bienveillance et dans un français simple et clair.
- Si le patient décrit un symptôme ou un malaise, pose UNE seule question à la fois pour clarifier (intensité, durée, gêne).
- Dès que le symptôme est clair, utilise l'outil "file_signalement" pour l'enregistrer dans son dossier médical. N'attends pas trop d'échanges.
- Si le patient présente des signes d'urgence vitale (douleur thoracique intense, détresse respiratoire, perte de connaissance, saignements graves), classe en gravité "severe", enregistre le signalement et oriente vers les urgences (166 / 112 ou centre le plus proche).
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

/** Chat avec Gemini quand aucune clé Anthropic n'est configurée. */
async function sendChatGemini(userId: number | null | undefined, role: string | null | undefined, history: ChatTurn[]): Promise<ChatResult> {
  const isPatient = role === 'patient' && !!userId;
  const contents = versTours(history);
  if (!contents.length || contents[contents.length - 1]!.role !== 'user') {
    return { reply: 'Message bien reçu.', signalementCreated: false };
  }
  const g = await genererContenu({
    system: (isPatient ? SYSTEM_PROMPT_PATIENT : SYSTEM_PROMPT_PUBLIC)
      .replace(/utilise l'outil "file_signalement" pour l'enregistrer/g, "remplis le champ « signalement » pour l'enregistrer")
      .replace(/enregistre le signalement/g, 'remplis le champ « signalement »') + CONSIGNE_JSON_GEMINI,
    contents,
    schema: isPatient ? SCHEMA_GEMINI_PATIENT : SCHEMA_GEMINI_PUBLIC,
    temperature: 0.3,
    responseMimeType: 'application/json',
  });
  const r = JSON.parse(g.text) as { reponse?: string; signalement?: { symptome: string; gravite: Gravite; notes?: string } | null };
  let reply = (r.reponse ?? '').trim() || 'Message bien reçu.';
  let signalementCreated = false;

  const dejaSignale = history.some((h) => h.role === 'assistant' && h.content.includes(CONFIRMATION_SIGNALEMENT));
  const s = r.signalement;
  if (isPatient && s && !dejaSignale && s.symptome?.trim() && ['leger', 'modere', 'severe'].includes(s.gravite)) {
    await patientService.createSignalement(userId!, {
      symptome: s.symptome.trim().slice(0, 150),
      gravite: s.gravite,
      notes: `${s.notes?.trim() ? `${s.notes.trim()}\n` : ''}Signalement proposé par l'assistant conversationnel (Gemini).`,
    });
    signalementCreated = true;
    reply = `${reply}\n\n${CONFIRMATION_SIGNALEMENT}`;
  }
  return { reply, signalementCreated };
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
