import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import * as patientService from './patient.service';
import type { Gravite } from '../models/Signalement';

const client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

const MODEL = 'claude-opus-5';
const MAX_ITERATIONS = 4;

const SYSTEM_PROMPT = `Tu es l'assistant de signalement de symptômes de VIHEPAT, une application de suivi pour des personnes vivant avec le VIH ou une hépatite virale au Bénin.

Ton rôle :
- Aider le patient à décrire un symptôme qu'il ressent, avec empathie et dans un français simple.
- Poser UNE seule question à la fois pour clarifier : de quel symptôme s'agit-il, depuis quand, à quel point c'est gênant ou inquiétant.
- Une fois que tu as un symptôme clair et une estimation de gravité (léger, modéré, sévère), appelle l'outil "file_signalement" pour l'enregistrer. N'attends pas d'avoir des dizaines de détails : 2-3 échanges suffisent.
- Après avoir enregistré le signalement, confirme au patient que son équipe soignante a été alertée, en une phrase brève et rassurante.
- Si le patient décrit des signes d'urgence vitale (douleur thoracique intense, difficulté à respirer, perte de connaissance, saignement important, idées suicidaires...), classe immédiatement en gravité "severe", enregistre le signalement, et dis-lui clairement de contacter les urgences ou de se rendre au centre de santé le plus proche sans attendre.

Règles strictes :
- Tu n'es PAS médecin et tu ne poses AUCUN diagnostic. Ne propose jamais de traitement.
- Reste bref : 1 à 3 phrases par message.
- Ne répète jamais une question à laquelle le patient a déjà répondu.`;

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

export async function sendChatMessage(userId: number, history: ChatTurn[]): Promise<ChatResult> {
  if (!client) {
    const e: any = new Error("L'assistant IA n'est pas configuré (ANTHROPIC_API_KEY manquant côté serveur)");
    e.status = 503;
    throw e;
  }

  const messages: Anthropic.MessageParam[] = history.map((h) => ({ role: h.role, content: h.content }));
  let finalText = '';
  let signalementCreated = false;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [FILE_SIGNALEMENT_TOOL],
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    const textBlock = response.content.find(isTextBlock);
    if (textBlock) finalText = textBlock.text;

    if (response.stop_reason === 'refusal') {
      finalText = "Désolé, je ne peux pas répondre à ce message. Vous pouvez contacter directement votre équipe soignante.";
      break;
    }

    const toolUse = response.content.find(isToolUseBlock);
    if (!toolUse) break;

    const input = toolUse.input as { symptome: string; gravite: Gravite; notes?: string };
    await patientService.createSignalement(userId, input);
    signalementCreated = true;

    messages.push({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: toolUse.id, content: 'Signalement enregistré avec succès dans le dossier du patient.' },
      ],
    });
  }

  return { reply: finalText, signalementCreated };
}
