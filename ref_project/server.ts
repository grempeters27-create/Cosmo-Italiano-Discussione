import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import dotenv from 'dotenv';
import { CURATED_TOPICS, getRandomTopicForCategory, getRandomTopic } from './src/data/curatedTopics.ts';
import type { TopicCategoryId } from './src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json({ limit: '25mb' }));

// Server-side Gemini client with User-Agent header
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

interface ChatRequestBody {
  messages: ChatMessage[];
  currentPhase: 1 | 2 | 3 | 4;
  phaseTurns: number;
  topic?: string;
  requestedLanguageForExplanation?: 'it';
}

const SYSTEM_INSTRUCTION = `Sei "Andrea", un amico e tutor madrelingua italiano simpatico, caloroso, rilassato e autentico.
In italiano il nome "Andrea" si adatta perfettamente sia al maschile che al femminile e rispecchia la voce scelta dallo studente (maschile o femminile).
Sei prima di tutto un amico fidato con cui fare una conversazione viva e piacevole, e un tutor attento che aiuta a migliorarsi con naturalezza.

Regole fondamentali di personalità e stile:
- COMPORTATI DA VERO AMICO, NON DA FAN ESAGERATO: Evita categoricamente lodi enfatiche o continue come "fantastico!", "bravissimo!", "straordinario!". Un amico normale non ti loda a ogni frase, ma dialoga in modo spontaneo, sincero e rilassato.
- SUGGERIMENTI COSTRUTTIVI E AMICHEVOLI: Dai consigli amichevoli e pratici per migliorare la naturalezza espressiva e la grammatica quando opportuno, senza pedanteria né lezioni pesanti.
- ADATTAMENTO DEL RITMO E DELLA LINGUA: Se il livello è basso, parla a ritmo notevolmente più lento, con pause distese e frasi semplici ed essenziali. Se il livello è più alto, conversa con scioltezza e naturalezza.
- Risposte brevi e discorsive (massimo 2-3 frasi).
- Non rimproverare mai lo studente e non accusarlo mai di non parlare in italiano; esprimi con garbo se non hai capito e proponi con simpatia una formulazione alternativa.`;

// Schema for structured chat responses
const chatResponseSchema = {
  type: Type.OBJECT,
  properties: {
    text: {
      type: Type.STRING,
      description: 'Il messaggio vocale/testuale principale che Andrea pronuncia allo studente (in italiano).',
    },
    currentPhase: {
      type: Type.INTEGER,
      description: 'La fase attuale della lezione (1, 2, 3 o 4).',
    },
    phaseTitle: {
      type: Type.STRING,
      description: 'Nome breve della fase attuale in italiano (es. "Conversazione del Giorno", "Feedback & Analisi", "Esercizio Pratico", "Chiusura & Curiosità").',
    },
    phaseTransition: {
      type: Type.BOOLEAN,
      description: 'Vero se questo messaggio segna il passaggio a una nuova fase.',
    },
    feedbackItems: {
      type: Type.ARRAY,
      description: 'In Fase 2 (o fine Fase 1), i 2-3 errori o punti di miglioramento analizzati.',
      items: {
        type: Type.OBJECT,
        properties: {
          original: {
            type: Type.STRING,
            description: 'La frase o formulazione originale usata dallo studente.',
          },
          correction: {
            type: Type.STRING,
            description: 'La forma corretta o "più naturale" in italiano.',
          },
          explanation: {
            type: Type.STRING,
            description: 'Breve spiegazione amichevole in italiano chiaro e stimolante per lo studente.',
          },
          category: {
            type: Type.STRING,
            description: 'Categoria dell\'errore: Grammatica, Lessico, o Più naturale.',
          },
        },
        required: ['original', 'correction', 'explanation'],
      },
    },
    exercises: {
      type: Type.ARRAY,
      description: 'In Fase 3, 1 o 2 brevi esercizi interattivi.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: {
            type: Type.STRING,
            description: 'Tipo di esercizio: fill-blank, translation, o rewrite.',
          },
          question: {
            type: Type.STRING,
            description: 'Il testo della domanda o della frase con lo spazio da riempire.',
          },
          hint: {
            type: Type.STRING,
            description: 'Un piccolo suggerimento didattico.',
          },
          expectedAnswer: {
            type: Type.STRING,
            description: 'La risposta ideale attesa.',
          },
        },
        required: ['id', 'question', 'expectedAnswer'],
      },
    },
    culturalTip: {
      type: Type.STRING,
      description: 'In Fase 4, un proverbio italiano o una curiosità culturale (con spiegazione).',
    },
    suggestedReplies: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 o 3 suggerimenti di risposta breve in italiano chiaro per aiutare lo studente se è bloccato.',
    },
  },
  required: ['text', 'currentPhase', 'phaseTitle', 'phaseTransition'],
};

// Helper to call Gemini models with resilient fallback
async function generateContentWithFallback(params: any) {
  // Use gemini-3.1-flash-lite as primary (fast and high availability) with gemini-3.8-flash fallback
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastErr: any = null;

  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        ...params,
        model,
      });
      return res;
    } catch (err: any) {
      console.warn(`Model ${model} failed, trying fallback:`, err?.message || err);
      lastErr = err;
    }
  }

  throw lastErr;
}

// Endpoint: Chat with Marco
app.post('/api/chat', async (req, res) => {
  const {
    messages = [],
    currentPhase = 1,
    phaseTurns = 0,
    topic = "L'impatto dell'Intelligenza Artificiale nella vita quotidiana e nel lavoro",
    requestedLanguageForExplanation = 'it',
  } = req.body as ChatRequestBody;

  try {
    const formattedContents = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    // If starting a fresh session without messages, provide a seed request: brief greeting first
    if (formattedContents.length === 0) {
      formattedContents.push({
        role: 'user',
        parts: [
          {
            text: `Inizia la nostra lezione salutando SOLO brevemente e calorosamente come Andrea con i consueti convenevoli amichevoli (es. "Ciao! Come stai oggi? Tutto bene?"). NON proporre ancora il tema di oggi ("${topic}"), limitati al breve saluto iniziale per permettere allo studente di salutare e rispondere a sua volta.`,
          },
        ],
      });
    }

    const phaseInstructions = `CONTESTO LEZIONE:
- Tema previsto per oggi: "${topic}"
- Fase pedagogica attuale: Fase ${currentPhase}
- Numero di scambi dell'utente in questa fase: ${phaseTurns}
- Lingua per le spiegazioni di feedback: Italiano (chiaro, amichevole e naturale)

REGOLE DI AVVIO:
- Se la conversazione è appena iniziata e c'è stato solo il primo scambio di saluti, proponi il tema "${topic}" chiedendo esplicitamente se per lo studente va bene o se preferisce parlare di altro.

ISTRUZIONI DI TRANSIZIONE:
- Se currentPhase == 1 e phaseTurns >= 3: puoi concludere la discussione del giorno con una frase di apprezzamento e annunciare il passaggio alla Fase 2 (currentPhase: 2, phaseTransition: true). Includi nel JSON feedbackItems con 2-3 frasi pronunciate dallo studente da rendere più naturali.
- Se currentPhase == 2 e lo studente ha letto o confermato il feedback: passa alla Fase 3 (currentPhase: 3, phaseTransition: true) e fornisci 1 o 2 esercizi mirati nel campo "exercises".
- Se currentPhase == 3 e lo studente ha risposto all'esercizio: valida la risposta e passa alla Fase 4 (currentPhase: 4, phaseTransition: true) chiedendo se ha dubbi o domande.
- Se currentPhase == 4 e lo studente ringrazia o dice di non avere domande: congedati calorosamente con un proverbio o curiosità culturale in "culturalTip".`;

    const response = await generateContentWithFallback({
      contents: formattedContents,
      config: {
        systemInstruction: `${SYSTEM_INSTRUCTION}\n\n${phaseInstructions}`,
        responseMimeType: 'application/json',
        responseSchema: chatResponseSchema,
        temperature: 0.7,
      },
    });

    const rawText = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(rawText);
    } catch {
      parsedData = {
        text: rawText,
        currentPhase,
        phaseTitle: `Fase ${currentPhase}`,
        phaseTransition: false,
      };
    }

    res.json(parsedData);
  } catch (error) {
    console.warn('Fallback response triggered in /api/chat due to upstream error:', error);
    // Graceful pedagogical fallback so user never encounters an error
    res.json({
      text:
        currentPhase === 1
          ? `Ciao! Che piacere sentirti oggi! Sono Andrea. Come stai? Tutto bene?`
          : `Ottima osservazione! Continuiamo il nostro percorso didattico: hai altre considerazioni su questo punto?`,
      currentPhase: currentPhase || 1,
      phaseTitle: `Fase ${currentPhase || 1}`,
      phaseTransition: false,
      suggestedReplies: [
        'Ciao Andrea! Tutto bene, grazie, e tu come stai?',
        'Sto bene! Di cosa parliamo oggi?',
        'Tutto a posto, felice di risentirti!',
      ],
    });
  }
});

// Schema for structured call feedback
const callFeedbackSchema = {
  type: Type.OBJECT,
  properties: {
    praise: {
      type: Type.STRING,
      description: 'Riscontro positivo amichevole, sobrio e sincero (NON usare aggettivi enfatici esagerati come "fantastico" o "straordinario", ma un commento amichevole e concreto su cosa ha funzionato bene nella conversazione).',
    },
    hasMajorErrors: {
      type: Type.BOOLEAN,
      description: 'Vero solo se lo studente ha commesso errori grossolani o formulazioni molto innaturali, falso altrimenti.',
    },
    errors: {
      type: Type.ARRAY,
      description: 'Al massimo 2 errori o punti di miglioramento formulati in modo amichevole e costruttivo (vuoto se nessuno o solo imprecisioni minime).',
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING, description: 'La frase o formulazione usata dallo studente' },
          correction: { type: Type.STRING, description: 'La forma corretta o naturale in italiano' },
          explanation: { type: Type.STRING, description: 'Spiegazione sintetica, amichevole e costruttiva (1 frase)' },
        },
        required: ['original', 'correction', 'explanation'],
      },
    },
    vocabularyAndPhrases: {
      type: Type.ARRAY,
      description: 'I 3 o 4 vocaboli o espressioni chiave più utili emerse dalla conversazione (in sintesi).',
      items: {
        type: Type.OBJECT,
        properties: {
          phrase: { type: Type.STRING, description: 'Parola o espressione italiana' },
          meaning: { type: Type.STRING, description: 'Breve significato in italiano o traduzione chiara' },
        },
        required: ['phrase', 'meaning'],
      },
    },
    grammarTip: {
      type: Type.STRING,
      description: 'Un consiglio pratico sintetico (massimo 1 frase) utile per parlare con maggiore naturalezza.',
    },
    estimatedProficiencyScore: {
      type: Type.INTEGER,
      description: 'Stima del livello dello studente da 0 a 100 in base alla complessità e scioltezza mostrata.',
    },
  },
  required: ['praise', 'hasMajorErrors', 'errors', 'vocabularyAndPhrases', 'grammarTip', 'estimatedProficiencyScore'],
};

// Endpoint: Generate structured textual call feedback on demand
app.post('/api/call-feedback', async (req, res) => {
  const { topic = "Conversazione spontanea", transcriptSnippets = [], callDurationSeconds = 0, currentScore = null } = req.body;
  try {
    const prompt = `Analizza questa conversazione vocale in lingua italiana tra lo studente e l'amico/tutor Andrea.
Argomento / Spunto: "${topic}"
Durata della chiamata: ${Math.round(callDurationSeconds)} secondi.
Punteggio attuale stimato dello studente: ${currentScore !== null ? `${currentScore}/100` : 'In calibrazione iniziale (aperto)'}
Trascrizioni o battute registrate:
${transcriptSnippets && transcriptSnippets.length > 0 ? transcriptSnippets.join('\n') : "(Conversazione audio libera spontanea)"}

REGOLE RIGIDE PER IL FEEDBACK DI ANDREA:
1. RISCONTRO AMICHEVOLE E SOBRIO: Evita categoricamente lodi esagerate, teatrali o vuote (niente "fantastico!", "eccezionale!", "meraviglioso!"). Comportati come un vero amico madrelingua: commenta con naturalezza e sincerità cosa ha funzionato bene nella conversazione (es. la chiarezza del messaggio, la spontaneità o la capacità di farsi capire).
2. PUNTI DI MIGLIORAMENTO COSTRUTTIVI (MASSIMO 2): Se lo studente ha commesso errori o usato formule innaturali, segnalane AL MASSIMO 2 (due), mai di più. Spiega con garbo e semplicità come suona più naturale per un italiano. Se non ci sono stati errori evidenti, il campo "errors" DEVE essere [] e "hasMajorErrors" false.
3. VOCABOLARIO E FRASI CHIAVE: Elenca in estrema sintesi 3 o 4 vocaboli, espressioni idiomatiche o frasi più utili legate a questa conversazione per arricchire la propria competenza.
4. CONSIGLIO PRATICO: Un unico consiglio sintetico (massimo 1 frase) per parlare in modo più sciolto.
5. STIMA LIVELLO (0-100): Assegna un punteggio da 0 a 100 proporzionato alla scioltezza, ricchezza di vocaboli e padronanza sintattica dimostrata (circa 20-35 per principiante/elementare, 40-65 per intermedio, 70-85 per avanzato, 86+ per fluente).`;

    const response = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: 'Sei Andrea, un amico e tutor madrelingua italiano simpatico, rilassato e autentico. Non fai lodi esagerate, offri consigli costruttivi e parli in modo naturale. Rispondi in JSON rispettando rigorosamente lo schema fornito.',
        responseMimeType: 'application/json',
        responseSchema: callFeedbackSchema,
        temperature: 0.6,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    // Ensure errors is strictly max 2
    if (parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 2) {
      parsed.errors = parsed.errors.slice(0, 2);
    }
    res.json(parsed);
  } catch (error) {
    console.warn('Fallback response triggered in /api/call-feedback:', error);
    res.json({
      praise: 'È stata una bella chiacchierata! Ti sei fatto capire chiaramente e abbiamo scambiato idee in modo spontaneo, che è la cosa più importante per fare progressi.',
      hasMajorErrors: false,
      errors: [],
      vocabularyAndPhrases: [
        { phrase: 'Fare due chiacchiere', meaning: 'Conversare in modo amichevole e rilassato' },
        { phrase: 'Secondo me...', meaning: 'Formula eccellente per esprimere la propria opinione' },
        { phrase: 'Mettersi in gioco', meaning: 'Affrontare una sfida con coraggio e determinazione' },
      ],
      grammarTip: 'Continua così: concentrati sulla naturalezza e sull\'accordo di genere e numero tra soggetto e aggettivo.',
    });
  }
});

// Schema for session memory and permanent personal fact extraction
const sessionMemoryAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    sessionSummary: {
      type: Type.STRING,
      description: 'Breve sintesi di 1 o 2 frasi in italiano chiaro di cosa si è discusso, opinioni o aneddoti condivisi dallo studente e impressione pedagogica.',
    },
    keyPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 o 3 punti chiave sintetici degli argomenti affrontati.',
    },
    discoveredName: {
      type: Type.STRING,
      description: 'Il nome proprio dello studente se pronunciato o confermato esplicitamente nella conversazione (es. "Marco"), altrimenti stringa vuota.',
    },
    discoveredFacts: {
      type: Type.ARRAY,
      description: 'Eventuali nuove informazioni personali PERMANENTI dello studente emerse (città, lavoro, passioni, hobby, famiglia, animali, progetti in Italia, obiettivi di studio). Non duplicare dati già noti. Massimo 3 o 4 fatti rilevanti. Vuoto se non ne sono emersi.',
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            description: 'Categoria del dato: name, location, profession, interests, learning_goals, family_or_pets, o other.',
          },
          label: {
            type: Type.STRING,
            description: 'Etichetta breve del dato (es. "Città", "Lavoro", "Hobby", "Famiglia", "Obiettivo").',
          },
          value: {
            type: Type.STRING,
            description: 'Il valore specifico (es. "Berlino", "Ingegnere", "Chitarra e cucina", "Vuole viaggiare a Firenze").',
          },
        },
        required: ['category', 'label', 'value'],
      },
    },
  },
  required: ['sessionSummary', 'keyPoints', 'discoveredFacts'],
};

// Endpoint: Analyze session memory & extract permanent facts upon call hang-up
app.post('/api/analyze-session-memory', async (req, res) => {
  const {
    topic = 'Conversazione spontanea',
    transcriptSnippets = [],
    callDurationSeconds = 0,
    currentProfile = {},
  } = req.body;

  try {
    const prompt = `Analizza questa conversazione vocale in lingua italiana appena conclusa tra lo studente e il tutor Andrea.
Argomento / Spunto iniziale: "${topic}"
Durata della chiamata: ${Math.round(callDurationSeconds)} secondi.
Trascrizioni e battute registrate della sessione:
${transcriptSnippets && transcriptSnippets.length > 0 ? transcriptSnippets.join('\n') : '(Conversazione audio libera spontanea)'}

Dati personali attuali dello studente già noti nel profilo:
${JSON.stringify(currentProfile, null, 2)}

COMPITI:
1. SINTESI DELLA SESSIONE ("sessionSummary"):
   - Scrivi una sintesi breve e concisa di massimo 1-2 frasi (in italiano chiaro) su cosa si è parlato, cosa ha raccontato o espresso lo studente e come è andata la sessione.
   - Questa sintesi entrerà nella cronologia a rotazione FIFO (limitata a poche sessioni) che Andrea rileggerà all'inizio delle prossime chiamate per garantire continuità.

2. PUNTI CHIAVE ("keyPoints"):
   - Elenca 2 o 3 punti chiave molto brevi (sotto forma di stringhe sintetiche, es. "Ha parlato del suo lavoro e del cane", "Opinioni sulla mobilità sostenibile").

3. NOME DELLO STUDENTE ("discoveredName"):
   - Presta MASSIMA ATTENZIONE a qualsiasi momento in cui lo studente menziona o conferma il proprio nome proprio:
     * Formulazioni come: "Mi chiamo Peter", "Sono Peter", "Il mio nome è Peter", "Piacere, Peter", o semplicemente "Peter"
   - Estrai qui il nome proprio esatto dello studente (es. "Peter").
   - Se invece lo studente NON ha mai detto o confermato alcun nome proprio, lascia una stringa vuota "".
   - Se estrai il nome, inseriscilo OBBLIGATORIAMENTE anche nell'elenco "discoveredFacts" con category: "name", label: "Nome", value: [il nome].

4. NUOVI DATI PERSONALI PERMANENTI ("discoveredFacts"):
   - Estrai TUTTE le informazioni personali PERMANENTI emerse sullo studente durante questa conversazione che valga la pena ricordare per sempre:
     * Nome proprio (se emerso: category: "name", label: "Nome", value: [nome])
     * Dove vive o abita (es. città, paese o regione: "Monaco di Baviera", "Berlino", "Svizzera")
     * Professione, lavoro, studi (es. "Ingegnere", "Insegnante", "Pensionato")
     * Hobby, passioni, interessi (es. "Cucina italiana", "Escursionismo", "Chitarra")
     * Famiglia, figli, partner, animali domestici (es. "Ha un cane di nome Max", "Due figli")
     * Viaggi in programma o preferiti in Italia (es. "Andrà a Roma a maggio", "Ama la Toscana")
     * Livello e motivazioni di studio dell'italiano.
   - Per ciascun dato, fornisci:
     * category: 'name' | 'location' | 'profession' | 'interests' | 'learning_goals' | 'family_or_pets' | 'other'
     * label: etichetta breve (es. "Nome", "Città", "Lavoro", "Hobby", "Animali")
     * value: valore chiaro e sintetico (es. "Peter", "Monaco", "Ingegnere")
   - Non duplicare dati identici già noti in currentProfile. Se non sono emersi nuovi dati, restituisci lista vuota [].`;

    const response = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction:
          'Sei Andrea, un insegnante e amico italiano esperto. Estrai la sintesi della sessione e le informazioni personali in JSON rigoroso rispettando lo schema fornito. Se lo studente ha detto il suo nome o dettagli sulla propria vita, estraili sempre.',
        responseMimeType: 'application/json',
        responseSchema: sessionMemoryAnalysisSchema,
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const discName = (parsed.discoveredName || '').trim();
    let facts = Array.isArray(parsed.discoveredFacts) ? parsed.discoveredFacts : [];

    // Ensure discoveredName is always included in discoveredFacts for UI presentation
    if (discName && !facts.some((f: any) => f.category === 'name' || f.label?.toLowerCase() === 'nome')) {
      facts = [{ category: 'name', label: 'Nome', value: discName }, ...facts];
    }

    res.json({
      sessionSummary:
        parsed.sessionSummary ||
        `Sessione incentrata su "${topic}". Lo studente ha conversato attivamente in italiano.`,
      keyPoints:
        Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0
          ? parsed.keyPoints
          : [`Conversazione su "${topic}"`],
      discoveredName: discName,
      discoveredFacts: facts,
    });
  } catch (error) {
    console.warn('Fallback in /api/analyze-session-memory:', error);
    res.json({
      sessionSummary: `Conversazione su "${topic}". Lo studente ha praticato l'italiano orale per ${Math.round(callDurationSeconds)} secondi.`,
      keyPoints: [`Pratica orale su ${topic}`],
      discoveredName: '',
      discoveredFacts: [],
    });
  }
});


// Helper to extract JSON from Gemini response
function extractJsonFromText(rawText: string): any {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText.trim());
  } catch (_) {}

  const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {}
  }

  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
    } catch (_) {}
  }

  return null;
}

// Endpoint: Dynamically generate or pick a fresh random topic by category
app.post('/api/generate-topic', async (req, res) => {
  const { categoryId = 'cultura', excludeTopicId } = req.body as {
    categoryId: TopicCategoryId;
    excludeTopicId?: string;
  };

  const validCategories: TopicCategoryId[] = ['cultura', 'geografia', 'notizie', 'giochi', 'grammatica'];
  const targetCategory: TopicCategoryId = validCategories.includes(categoryId) ? categoryId : 'cultura';

  try {
    // 3. NOTIZIE - Brief search of current Italian & European news using Google Search grounding
    if (targetCategory === 'notizie') {
      const newsPrompt = `Cerca brevemente le notizie più recenti e interessanti dall'Italia e dall'Europa (utilizza googleSearch).
Scegli un tema concreto, stimolante, innovativo o socialmente rilevante dalle notizie italiane o europee (es. cultura, ambiente, turismo sostenibile, mobilità, innovazioni nelle città, società, vita quotidiana).
Evita cronaca nera o catastrofi; seleziona un argomento di conversazione piacevole e costruttivo per una conversazione in lingua italiana.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (nessun testo prima o dopo):
{
  "title": "Titolo breve ed efficace in italiano (3-5 parole)",
  "italianHeadline": "Notizia o spunto chiaro in italiano (1 frase)",
  "description": "Breve spiegazione del tema in italiano chiaro e accessibile (1-2 frasi)",
  "starterPrompt": "Frase di apertura per il tutor Andrea che cita la notizia e chiede un'opinione allo studente (2-3 frasi in italiano chiaro e amichevole)"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: newsPrompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.8,
        },
      });

      const parsed = extractJsonFromText(response.text || '');
      if (parsed && parsed.title && parsed.italianHeadline) {
        return res.json({
          id: `notizie-dyn-${Date.now()}`,
          categoryId: 'notizie',
          category: 'Notizie & Attualità Europea',
          categoryDe: 'Notizie & Attualità Europea',
          title: parsed.title,
          italianHeadline: parsed.italianHeadline,
          description: parsed.description || parsed.italianHeadline,
          starterPrompt: parsed.starterPrompt || `Nelle ultime notizie si parla di "${parsed.title}". Tu ne hai sentito parlare? Cosa ne pensi?`,
          isNewsResearched: true,
        });
      }
    }

    // 4. GIOCHI - Language learning games
    else if (targetCategory === 'giochi') {
      const gameIdeas = [
        'Indovina la Parola (3 indizi per scoprire un oggetto, un piatto tipico o un monumento italiano)',
        'Il Gioco delle 20 Domande (20 domande con risposta Sì o No per indovinare un personaggio o una città)',
        'Due Verità e una Bugia (2 fatti veri e 1 simpatica bugia inventata sull\'Italia o su Andrea)',
        'Cosa Faresti Se...? (Un divertente gioco di ruolo con situazioni insolite in Italia)',
        'Catena di Parole e Associazioni (Associazioni rapide di idee e vocaboli in italiano)',
      ];
      const randomGameIdea = gameIdeas[Math.floor(Math.random() * gameIdeas.length)];

      const prompt = `Inventa un gioco linguistico concreto, creativo e divertente per una conversazione audio in lingua italiana.
Concetto del gioco: "${randomGameIdea}".
Scegli un tema casuale e concreto (es. un piatto tradizionale come il tiramisù o il risotto alla milanese, una città come Verona o Napoli, un oggetto tipico come la Vespa o la moka, o una celebrità italiana).

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (nessun testo prima o dopo):
{
  "title": "Titolo del gioco in italiano (es. Indovina: Un Simbolo Italiano)",
  "italianHeadline": "Motto o invito al gioco in italiano (1 frase)",
  "description": "Spiegazione semplice del gioco in italiano chiaro (1-2 frasi)",
  "starterPrompt": "Frase di apertura di Andrea che spiega il gioco con simpatia e fornisce subito il primo indizio o la prima mossa (2-3 frasi in italiano naturale)",
  "gameType": "Nome breve della tipologia di gioco",
  "gameRules": "Regola sintetica del gioco in 1 frase"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.9,
        },
      });

      const parsed = extractJsonFromText(response.text || '');
      if (parsed && parsed.title && parsed.italianHeadline) {
        return res.json({
          id: `giochi-dyn-${Date.now()}`,
          categoryId: 'giochi',
          category: 'Giochi Linguistici',
          categoryDe: 'Giochi Linguistici',
          title: parsed.title,
          italianHeadline: parsed.italianHeadline,
          description: parsed.description,
          starterPrompt: parsed.starterPrompt,
          gameType: parsed.gameType || 'Indovina la parola',
          gameRules: parsed.gameRules,
        });
      }
    }

    // 5. GRAMMATICA - Grammar exercises
    else if (targetCategory === 'grammatica') {
      const grammarTopics = [
        'Congiuntivo Presente per esprimere opinioni (Penso che sia..., Credo che abbia...)',
        'Passato Prossimo vs Imperfetto per raccontare aneddoti e ricordi (azioni puntuali vs descrizioni)',
        'Periodo Ipotetico della Possibilità (Se potessi viaggiare..., andrei a...)',
        'Condizionale di Cortesia e Desideri (Vorrei..., Mi piacerebbe..., Potresti...?)',
        'Pronomi Diretti e Indiretti nella vita quotidiana (Lo prendo, Le parlo, Ci vediamo)',
        'Connettivi e Marcatori del Discorso per argomentare (Inoltre, D’altra parte, Tuttavia)',
      ];
      const randomGrammarTopic = grammarTopics[Math.floor(Math.random() * grammarTopics.length)];

      const prompt = `Crea un'attività orale di grammatica concreta, giocosa e legata alla vita quotidiana per una conversazione in lingua italiana.
Focus grammaticale: "${randomGrammarTopic}".
Niente teoria astratta o noiosa, ma un compito di conversazione vivo e stimolante (es. un aneddoto di viaggio, uno scenario ipotetico, un'opinione personale o una situazione al ristorante).

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (nessun testo prima o dopo):
{
  "title": "Titolo dell'attività in italiano (es. Esprimere Opinioni col Congiuntivo)",
  "italianHeadline": "Motto o focus dell'esercizio in italiano (1 frase)",
  "description": "Spiegazione semplice dell'obiettivo in italiano chiaro (1-2 frasi)",
  "starterPrompt": "Frase di apertura di Andrea che introduce il tema con simpatia e pone una domanda aperta e stimolante (2-3 frasi in italiano naturale)",
  "grammarFocus": "${randomGrammarTopic}"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.85,
        },
      });

      const parsed = extractJsonFromText(response.text || '');
      if (parsed && parsed.title && parsed.italianHeadline) {
        return res.json({
          id: `gramm-dyn-${Date.now()}`,
          categoryId: 'grammatica',
          category: 'Esercizi di Grammatica',
          categoryDe: 'Esercizi di Grammatica',
          title: parsed.title,
          italianHeadline: parsed.italianHeadline,
          description: parsed.description,
          starterPrompt: parsed.starterPrompt,
          grammarFocus: parsed.grammarFocus || randomGrammarTopic,
        });
      }
    }

    // 1. CULTURA - Italian culture
    else if (targetCategory === 'cultura') {
      const prompt = `Scegli un tema concreto e affascinante della cultura italiana (es. una festa tradizionale, una ricetta regionale, il rito del caffè al bar, la gestualità italiana, l'abitudine dell'aperitivo, il cinema neorealista o contemporaneo, la canzone d'autore o l'artigianato).
Scegli in modo CASUALE un argomento stimolante, mai banale!

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (nessun testo prima o dopo):
{
  "title": "Titolo del tema in italiano (3-5 parole)",
  "italianHeadline": "Spunto chiave o curiosità in italiano (1 frase)",
  "description": "Breve descrizione in italiano chiaro e accessibile (1-2 frasi)",
  "starterPrompt": "Frase di apertura di Andrea per rompere il ghiaccio con simpatia (2-3 frasi in italiano chiaro)"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.9,
        },
      });

      const parsed = extractJsonFromText(response.text || '');
      if (parsed && parsed.title && parsed.italianHeadline) {
        return res.json({
          id: `cultura-dyn-${Date.now()}`,
          categoryId: 'cultura',
          category: 'Cultura Italiana',
          categoryDe: 'Cultura Italiana',
          title: parsed.title,
          italianHeadline: parsed.italianHeadline,
          description: parsed.description,
          starterPrompt: parsed.starterPrompt,
        });
      }
    }

    // 2. GEOGRAFIA - Italian geography
    else if (targetCategory === 'geografia') {
      const prompt = `Scegli un tema geografico affascinante e concreto dell'Italia (es. un borgo pittoresco medievale, le isole Eolie, la Costiera Amalfitana vs le Cinque Terre, il vulcano Etna, le Dolomiti, i grandi laghi del Nord, la Puglia, i parchi naturali o i contrasti tra Nord e Sud).
Scegli in modo CASUALE un argomento stimolante, mai banale!

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido (nessun testo prima o dopo):
{
  "title": "Titolo del tema in italiano (3-5 parole)",
  "italianHeadline": "Spunto o fascino del luogo in italiano (1 frase)",
  "description": "Breve descrizione geografica in italiano chiaro (1-2 frasi)",
  "starterPrompt": "Frase di apertura di Andrea per rompere il ghiaccio con entusiasmo e curiosità (2-3 frasi in italiano chiaro)"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.9,
        },
      });

      const parsed = extractJsonFromText(response.text || '');
      if (parsed && parsed.title && parsed.italianHeadline) {
        return res.json({
          id: `geo-dyn-${Date.now()}`,
          categoryId: 'geografia',
          category: 'Geografia & Territorio',
          categoryDe: 'Geografia & Territorio',
          title: parsed.title,
          italianHeadline: parsed.italianHeadline,
          description: parsed.description,
          starterPrompt: parsed.starterPrompt,
        });
      }
    }
  } catch (error) {
    console.warn(`Dynamic topic generation error for category ${targetCategory}:`, error);
  }

  // Resilient fallback to curated pool (always varied and immediate)
  const fallbackTopic = getRandomTopicForCategory(targetCategory, excludeTopicId);
  res.json(fallbackTopic);
});


// Server-side in-memory cache for generated TTS audio to save API quota and ensure instant playback
const serverTtsCache = new Map<string, string>();

// Helper sleep function for retries
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Endpoint: Text to Speech (Gemini 3.8 Flash Lite TTS with server-side cache and authentic Italian accent)
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice = 'Puck', speed = 'normal', score = null } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Testo mancante per la sintesi vocale' });
    }

    // Clean text: strip markdown stars, code tags, etc. for smooth audio output
    const cleanText = text
      .replace(/[*_#`[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return res.status(400).json({ error: 'Testo vuoto dopo la pulizia' });
    }

    const isSlowSpeed = speed === 'slow' || (typeof score === 'number' && score <= 35);

    // Determine target voice strictly: 'Kore' for female, 'Puck' for male
    const isFemale =
      voice === 'femminile' ||
      voice === 'Kore' ||
      voice === 'Aoede' ||
      voice === 'female';
    const chosenVoice: 'Kore' | 'Puck' = isFemale ? 'Kore' : 'Puck';

    // Check server cache first
    const cacheKey = `${chosenVoice}_${isSlowSpeed ? 'slow' : 'normal'}_${cleanText}`;
    const cachedAudio = serverTtsCache.get(cacheKey);
    if (cachedAudio) {
      return res.json({
        audio: cachedAudio,
        mimeType: 'audio/wav',
        fromCache: true,
      });
    }

    const ttsModels = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'];
    let base64Audio: string | null | undefined = null;
    let lastError: any = null;

    // Pronunciation style instruction ensuring authentic native Italian accent and calibrated tempo
    const styleInstruction = isFemale
      ? isSlowSpeed
        ? 'Madrelingua italiana di Roma o Milano. Voce femminile calda, chiara, ritmo notevolmente lento, scandito e rilassato con brevi pause tra le frasi per studenti principianti, pronuncia italiana pura e naturale al 100% senza alcun accento straniero.'
        : 'Madrelingua italiana di Roma o Milano. Voce femminile amichevole, spontanea, naturale e rilassata, pronuncia italiana impeccabile al 100% senza alcun accento straniero.'
      : isSlowSpeed
      ? 'Madrelingua italiana di Roma o Milano. Voce maschile calda, chiara, ritmo notevolmente lento, scandito e rilassato con brevi pause tra le frasi per studenti principianti, pronuncia italiana pura e naturale al 100% senza alcun accento straniero.'
      : 'Madrelingua italiana di Roma o Milano. Voce maschile amichevole, spontanea, naturale e rilassata, pronuncia italiana impeccabile al 100% senza alcun accento straniero.';

    for (const model of ttsModels) {
      // Allow up to 2 attempts per model with a brief backoff in case of temporary rate limit
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const ttsResponse = await ai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: cleanText,
                    speechMetadata: {
                      style: styleInstruction,
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: chosenVoice },
                },
              },
            },
          });

          base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Audio) break;
        } catch (err: any) {
          lastError = err;
          const isRateLimit =
            err?.status === 429 ||
            err?.message?.includes('429') ||
            err?.message?.includes('quota') ||
            err?.message?.includes('RESOURCE_EXHAUSTED');

          if (isRateLimit && attempt === 0) {
            // Wait 1.8 seconds before a retry
            await sleep(1800);
            continue;
          }
          console.warn(`TTS model ${model} attempt ${attempt} error:`, err?.message || err);
          break;
        }
      }

      if (base64Audio) break;
    }

    if (base64Audio) {
      // Store in server cache (cap at 300 items to manage memory)
      if (serverTtsCache.size > 300) {
        const firstKey = serverTtsCache.keys().next().value;
        if (firstKey) serverTtsCache.delete(firstKey);
      }
      serverTtsCache.set(cacheKey, base64Audio);

      return res.json({
        audio: base64Audio,
        mimeType: 'audio/wav',
      });
    }

    res.status(500).json({
      error: 'Nessun dato audio generato dal modello TTS',
      details: lastError?.message || String(lastError),
    });
  } catch (error) {
    console.error('Error in /api/tts:', error);
    res.status(500).json({
      error: 'Errore sintesi vocale',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Endpoint: Audio transcription
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioData, mimeType = 'audio/webm' } = req.body;
    if (!audioData) {
      return res.status(400).json({ error: 'Nessun file audio inviato per la trascrizione' });
    }

    // Call gemini-3.1-flash-lite with fallback to gemini-3.8-flash
    let rawText = '';
    const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    for (const model of models) {
      try {
        const transcribeResponse = await ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                mimeType,
                data: audioData,
              },
            },
            {
              text: 'Ascolta questo audio e trascrivi esattamente le parole pronunciate in italiano. Restituisci SOLO ed esclusivamente il testo trascritto, senza virgolette e senza alcuna parola aggiuntiva. Se l\'audio è silenzioso o incomprensibile, rispondi con stringa vuota.',
            },
          ],
        });
        rawText = transcribeResponse.text?.trim() || '';
        if (rawText) break;
      } catch (err: any) {
        console.warn(`Model ${model} transcription failed:`, err?.message || err);
      }
    }

    // Clean any leading/trailing quotes or markdown
    const transcript = rawText.replace(/^["'`]+|["'`]+$/g, '').trim();
    res.json({ transcript });
  } catch (error) {
    console.error('Error in /api/transcribe:', error);
    res.status(500).json({
      error: 'Errore trascrizione audio',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Setup HTTP & WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = request.url || '';
  if (url.startsWith('/api/live')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
  // Other upgrades are left unhandled so Vite or proxy can handle them
});

wss.on('connection', async (clientWs: WebSocket, request: any) => {
  const reqUrl = new URL(request?.url || '', 'http://localhost');
  const voiceParam = reqUrl.searchParams.get('voice');
  const topicParam = reqUrl.searchParams.get('topic') || "La cultura e lo stile di vita italiano";
  const categoryParam = reqUrl.searchParams.get('category') || '';
  const starterParam = reqUrl.searchParams.get('starter') || '';
  const gameTypeParam = reqUrl.searchParams.get('gameType') || '';
  const grammarFocusParam = reqUrl.searchParams.get('grammarFocus') || '';
  const gameRulesParam = reqUrl.searchParams.get('gameRules') || '';
  const memoryParam = reqUrl.searchParams.get('memory') || '';

  // Parse student memory (personal profile + FIFO session history)
  let parsedMemory: any = null;
  if (memoryParam) {
    try {
      parsedMemory = JSON.parse(decodeURIComponent(memoryParam));
    } catch (_) {
      try {
        parsedMemory = JSON.parse(memoryParam);
      } catch (err) {
        console.warn('Failed to parse memory parameter:', err);
      }
    }
  }

  const studentName = parsedMemory?.userProfile?.name?.trim() || '';
  const studentProficiency = parsedMemory?.userProfile?.proficiency;
  const profScore =
    typeof studentProficiency?.score === 'number' && !isNaN(studentProficiency.score)
      ? studentProficiency.score
      : null;
  const profStageLabel = studentProficiency?.stageLabel || (profScore === null ? 'In calibrazione' : 'Intermedio');

  const studentFacts: any[] = Array.isArray(parsedMemory?.userProfile?.facts)
    ? parsedMemory.userProfile.facts
    : [];
  const customNotes = parsedMemory?.userProfile?.customNotes?.trim() || '';
  const sessionHistory: any[] = Array.isArray(parsedMemory?.sessionHistory)
    ? parsedMemory.sessionHistory
    : [];

  // Build adaptive proficiency directive strictly linked to 0-100 score
  let proficiencyDirective = '';
  if (profScore === null) {
    proficiencyDirective = `LIVELLO LINGUISTICO DELLO STUDENTE: IN CALIBRAZIONE INIZIALE (LIVELLO APERTO).
- Non dare per scontato alcun livello fisso né etichette pregresse.
- Inizia la telefonata con tono amichevole e rilassato, pronuncia limpida e frasi accessibili ma naturali al 100%.
- RITMO E VELOCITÀ DI PARLATO: Parla a velocità moderata e calma. Ascolta con attenzione come lo studente risponde: se parla con facilità e ricchezza lessicale, mantieni un ritmo naturale; se invece esita, usa vocaboli essenziali o fatica a comprendere, RALLENTA SUBITO IL RITMO in modo percepibile, scandisci bene le sillabe e fai brevi pause rilassanti tra una frase e l'altra.`;
  } else if (profScore <= 35) {
    proficiencyDirective = `LIVELLO LINGUISTICO DELLO STUDENTE: ${profScore}/100 (${profStageLabel} - Base / Principiante).
- RITMO E VELOCITÀ DI PARLATO (REGOLA FONDAMENTALE E CRUCIALE):
  * PARLA IN MODO NOTEVOLMENTE LENTO, rilassato e molto scandito. Non avere fretta!
  * Fai brevi pause di respiro e silenzio naturale (1-2 secondi) tra una frase e l'altra per dare il tempo allo studente di assimilare i suoni e formulare i suoi pensieri.
  * Articola ogni sillaba con estrema chiarezza.
- SEMPLICITÀ LINGUISTICA (REGOLA FONDAMENTALE E CRUCIALE):
  * Usa solo un lessico quotidiano molto semplice ed essenziale di uso frequente.
  * Costruisci frasi brevi e coordinate (massimo 8-12 parole per frase).
  * Evita categoricamente subordinate complesse, espressioni idiomatiche ricercate o modi verbali arcaici (usa il presente, passato prossimo e costrutti lineari).
- ATTEGGIAMENTO: Massima pazienza, empatia e calore, incoraggiando ogni tentativo senza mai metterlo in soggezione.`;
  } else if (profScore <= 65) {
    proficiencyDirective = `LIVELLO LINGUISTICO DELLO STUDENTE: ${profScore}/100 (${profStageLabel} - Intermedio).
- RITMO E VELOCITÀ DI PARLATO: Parla a velocità moderata, naturale e rilassata. Non parlare troppo velocemente o a raffica.
- COMPLESSITÀ LINGUISTICA: Conversazione informale naturale, strutture grammaticali chiare, introduce espressioni idiomatiche comuni spiegandole con disinvoltura se necessario.`;
  } else {
    proficiencyDirective = `LIVELLO LINGUISTICO DELLO STUDENTE: ${profScore}/100 (${profStageLabel} - Avanzato / Fluente).
- RITMO E VELOCITÀ DI PARLATO: Parla a ritmo naturale da madrelingua, fluido ed espressivo.
- COMPLESSITÀ LINGUISTICA: Lessico ricco e sfumato, modi di dire autentici, giochi di parole e riflessioni approfondite.`;
  }

  // Build memory context string for Andrea to review before each call
  let memoryContext = '';
  if (studentName || profScore !== null || studentFacts.length > 0 || customNotes || sessionHistory.length > 0) {
    let profileSection = '';
    if (studentName) {
      profileSection += `- Nome dello studente: "${studentName}"\n`;
    }
    if (profScore !== null) {
      profileSection += `- Livello di competenza attuale registrato: ${profScore}/100 (${profStageLabel})\n`;
    } else {
      profileSection += `- Livello di competenza attuale: In fase di calibrazione iniziale (aperto)\n`;
    }
    if (studentFacts.length > 0) {
      profileSection += `- Dati personali permanenti dello studente (ricordali sempre):\n` +
        studentFacts.map((f: any) => `  * ${f.label || f.category}: ${f.value}`).join('\n') + '\n';
    }
    if (customNotes) {
      profileSection += `- Note specifiche sul profilo dello studente: ${customNotes}\n`;
    }

    let historySection = '';
    if (sessionHistory.length > 0) {
      historySection += `- Storico delle ultime sessioni svolte (in ordine FIFO, dalla meno recente all'ultima svolta):\n` +
        sessionHistory.map((s: any, idx: number) => {
          const d = s.date || s.dateFormatted || `Sessione ${idx + 1}`;
          const t = s.topic ? ` [Tema: ${s.topic}]` : '';
          const sum = s.summary || '';
          const pts = Array.isArray(s.keyPoints) && s.keyPoints.length > 0 ? ` (Punti salienti: ${s.keyPoints.join('; ')})` : '';
          const diff = s.difficultyFeedback ? ` [Difficoltà percepita: ${s.difficultyFeedback}]` : '';
          return `  ${idx + 1}. [${d}]${t}: ${sum}${pts}${diff}`;
        }).join('\n') + '\n';
    }

    memoryContext = `
======================================================
MEMORIA PERSONALE E STORICO DELLO STUDENTE (DA CONSULTARE PRIMA DI PARLARE):
${profileSection || '(Nessun dato anagrafico permanente salvato)'}
${historySection || '(Prima sessione registrata)'}

COME USARE QUESTA MEMORIA DURANTE QUESTA CHIAMATA:
1. SE CONOSCI IL NOME DELLO STUDENTE (${studentName ? `"${studentName}"` : 'non ancora noto'}):
   - Salutalo calorosamente per nome (es. "Ciao ${studentName}! Che piacere risentirti!") e usa il suo nome con spontaneità ed empatia.
2. CONTINUITÀ DIDATTICA ED EMPATICA (MEMORIA DELLE SESSIONI PASSATE):
   - Sei un vero amico e insegnante con una memoria affettuosa: ricordi le cose che vi siete detti nelle sessioni precedenti.
   - All'inizio o durante la chiacchierata, se pertinente, puoi fare un breve riferimento naturale a una cosa che ti ha raccontato o al tema passato (es. "Come vanno le cose con...?", "L'altra volta mi dicevi che...").
   - Non recitare la memoria come un elenco rigido: inserisci richiami spontanei come farebbe un amico sincero.
3. NUOVE INFORMAZIONI:
   - Se durante la telefonata lo studente condivide nuovi dettagli personali o il proprio nome, accoglili con interesse e spontaneità.
======================================================`;
  }

  // 'Kore' for female voice, 'Puck' for male voice
  const isFemale = voiceParam === 'femminile' || voiceParam === 'Kore';
  const chosenVoice = isFemale ? 'Kore' : 'Puck';
  console.log(`Client connected to Live voice WebSocket with voice: ${chosenVoice}, studentName: ${studentName || '(unknown)'}, historyCount: ${sessionHistory.length}, topic: ${topicParam}`);

  let liveSession: any = null;

  // Specific contextual guide based on category (to be proposed in Turn 2 after greetings)
  let categoryContext = '';
  if (categoryParam === 'giochi') {
    categoryContext = `
TEMA E ATTIVITÀ PREVISTA PER QUESTA SESSIONE: GIOCO LINGUISTICO INTERATTIVO (${gameTypeParam || 'Gioco in italiano'}).
- Spunto di gioco preparato: "${topicParam}".
- Regola o dinamica del gioco: ${gameRulesParam || 'Andrea dà indizi o pone domande divertenti allo studente'}.
- RICORDA IL FLUSSO D'INIZIO A DUE PASSAGGI:
  * Nel primo turno: SOLO un breve saluto amichevole di apertura. NON proporre il gioco nel primo turno!
  * Nel secondo turno (dopo che lo studente ha risposto al saluto): proponi con simpatia l'idea di iniziare con questo gioco ("${topicParam}"), spiegando in 1 frase la regola e chiedendo sempre se gli va bene o se preferisce parlare di altro.
- REGOLA D'ORO FONDAMENTALE: Se lo studente preferisce fermarsi, parlare della sua giornata, fare domande su altro o cambiare discorso, SEGUILO IMMEDIATAMENTE E CON PIACERE senza insistere sul gioco.`;
  } else if (categoryParam === 'grammatica') {
    categoryContext = `
TEMA E ATTIVITÀ PREVISTA PER QUESTA SESSIONE: PRATICA ORALE DI GRAMMATICA (${grammarFocusParam || 'Struttura grammaticale'}).
- Spunto didattico preparato: "${topicParam}".
- Focus grammaticale: ${grammarFocusParam || 'Uso vivo della struttura'}.
- RICORDA IL FLUSSO D'INIZIO A DUE PASSAGGI:
  * Nel primo turno: SOLO un breve saluto amichevole di apertura. NON proporre l'argomento nel primo turno!
  * Nel secondo turno (dopo che lo studente ha risposto al saluto): proponi l'idea di fare due chiacchiere incentrate su "${topicParam}" chiedendo espressamente se gli va bene o se preferisce parlare di un altro argomento.
- NIENTE LEZIONI NOIOSI DA LIBRO: mantieni una chiacchierata rilassata e simpatica tra amici, dove la lingua emerge spontaneamente.
- REGOLA D'ORO FONDAMENTALE: Se lo studente desidera parlare di tutt'altro, accetta con piacere il cambio di argomento senza forzare l'esercizio.`;
  } else if (categoryParam === 'notizie') {
    categoryContext = `
TEMA PREVISTO PER QUESTA SESSIONE: NOTIZIE & ATTUALITÀ RECENTE (ITALIA ED EUROPA).
- Notizia o tema di partenza preparato: "${topicParam}".
- RICORDA IL FLUSSO D'INIZIO A DUE PASSAGGI:
  * Nel primo turno: SOLO un breve saluto amichevole di apertura. NON proporre la notizia nel primo turno!
  * Nel secondo turno (dopo che lo studente ha risposto al saluto): accenna brevemente alla notizia ("${topicParam}") e chiedi espressamente se gli va di parlarne o se preferisce fare due chiacchiere su un altro tema.
- REGOLA D'ORO FONDAMENTALE: Se lo studente non è informato o preferisce parlare di altro, cambia subito discorso con naturalezza.`;
  } else if (categoryParam === 'geografia') {
    categoryContext = `
TEMA PREVISTO PER QUESTA SESSIONE: GEOGRAFIA & TERRITORIO ITALIANO.
- Spunto geografico preparato: "${topicParam}".
- RICORDA IL FLUSSO D'INIZIO A DUE PASSAGGI:
  * Nel primo turno: SOLO un breve saluto amichevole di apertura. NON proporre il viaggio nel primo turno!
  * Nel secondo turno (dopo che lo studente ha risposto al saluto): proponi l'idea di fare un viaggio virtuale a "${topicParam}" e chiedi espressamente se gli va bene come argomento o se preferisce parlare di altro.
- REGOLA D'ORO FONDAMENTALE: Lo studente può deviare la conversazione verso qualsiasi altro viaggio o argomento a piacere.`;
  } else {
    categoryContext = `
TEMA PREVISTO PER QUESTA SESSIONE: CULTURA & STILE DI VITA ITALIANO.
- Spunto culturale preparato: "${topicParam}".
- RICORDA IL FLUSSO D'INIZIO A DUE PASSAGGI:
  * Nel primo turno: SOLO un breve saluto amichevole di apertura. NON proporre il tema nel primo turno!
  * Nel secondo turno (dopo che lo studente ha risposto al saluto): introduci con calore l'idea di parlare di "${topicParam}" e chiedi espressamente se per lui va bene o se preferisce fare due chiacchiere su un altro argomento.
- REGOLA D'ORO FONDAMENTALE: Lo studente è libero di deviare verso qualunque altro argomento.`;
  }

  try {
    const savePermanentStudentDataTool = {
      functionDeclarations: [
        {
          name: 'savePermanentStudentData',
          description:
            'Chiama questo strumento SUBITO non appena lo studente dice o conferma il suo nome (es. "Peter", "Mi chiamo Peter", "Sono Peter"), o rivela informazioni personali importanti su di sé (dove vive/città, lavoro/professione, hobby/passioni, animali, famiglia, viaggi programmati in Italia, obiettivi di studio). Salva permanentemente questi dati nel profilo dello studente.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              studentName: {
                type: Type.STRING,
                description: 'Il nome proprio dello studente se menzionato (es. "Peter", "Marco", "Anna"). Lascia stringa vuota se non menzionato.',
              },
              newFacts: {
                type: Type.ARRAY,
                description: 'Elenco dei fatti personali permanenti emersi da salvare permanentemente.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: {
                      type: Type.STRING,
                      description: 'Categoria del dato: name, location, profession, interests, learning_goals, family_or_pets, o other.',
                    },
                    label: {
                      type: Type.STRING,
                      description: 'Etichetta breve del dato (es. "Nome", "Città", "Lavoro", "Hobby", "Animali", "Viaggi").',
                    },
                    value: {
                      type: Type.STRING,
                      description: 'Il valore specifico (es. "Peter", "Monaco di Baviera", "Ingegnere", "Cucina e nuoto").',
                    },
                  },
                  required: ['category', 'label', 'value'],
                },
              },
            },
          },
        },
      ],
    };

    liveSession = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [savePermanentStudentDataTool],
        systemInstruction: `Sei Andrea, ${
          isFemale
            ? "un'amica e tutor italiana madrelingua (donna, voce femminile italiana naturale, simpatica, rilassata, autentica e accogliente di Roma o Milano)"
            : "un amico e tutor italiano madrelingua (uomo, voce maschile italiana naturale, simpatico, rilassato, autentico e accogliente di Roma o Milano)"
        } per uno studente che sta praticando la conversazione in italiano.
Parla SEMPRE in italiano autentico, fluido e naturale, senza alcun accento straniero.

${proficiencyDirective}

${memoryContext}

${categoryContext}

REGOLE FONDAMENTALI SULLA PERSONALITÀ E LA DINAMICA DELLA CONVERSAZIONE:

0. REGOLA CRUCIALE SULL'AVVIO DELLA CONVERSAZIONE (FLUSSO A 2 TURNI):
   - TURNO 1 (PRIMISSIMO SALUTO):
     * All'inizio della chiamata, Andrea saluta SOLO brevemente lo studente con i consueti convenevoli amichevoli di rito (es. "Pronto! Ciao [Nome]! Come stai oggi? Tutto bene?" oppure "Pronto, ciao! Che piacere sentirti, come va oggi?").
     * DIVIETO ASSOLUTO: È SEVERAMENTE VIETATO introdurre, nominare o proporre il tema della sessione in questa prima battuta!
     * Andrea saluta brevemente (massimo 1 o 2 frasi di convenevoli) e SI FERMA SUBITO, lasciando allo studente il tempo e la piena opportunità di rispondere e ricambiare il saluto.
   - TURNO 2 (PROPOSTA DEL TEMA CON DOMANDA SE VA BENE):
     * Solo DOPO che lo studente ha risposto al saluto (nel secondo turno), Andrea accoglie con calore la risposta e propone lo spunto o tema della sessione: "${topicParam}".
     * DOMANDA OBBLIGATORIA: Quando propone il tema, Andrea DEVE SEMPRE chiedere esplicitamente se allo studente va bene trattare questo argomento o se preferisce parlare di qualcos'altro (es. "Oggi avevo pensato di fare due chiacchiere su ${topicParam}. Che ne dici, per te va bene o preferisci parlare di un altro argomento?").
     * Se lo studente accetta o dice di sì, si entra nel tema. Se invece preferisce parlare della sua giornata, di lavoro, di viaggi o di qualsiasi altro argomento, Andrea accetta immediatamente con entusiasmo e segue la preferenza dello studente!

1. PERSONALITÀ: UN AMICO NORMALE, NON UN FAN ESAGERATO (REGOLA CRUCIALE):
   - Comportati come un vero amico madrelingua con cui si fa una piacevole chiacchierata informale al bar o al telefono: amichevole, spontaneo, paziente e rilassato.
   - DIVIETO ASSOLUTO DI LODI ESAGERATE O IPERBOLICHE: Non riempire la conversazione di complimenti artificiosi o teatrali! È severamente VIETATO ripetere continuamente "Fantastico!", "Bravissimo!", "Meraviglioso!", "Incredibile!", "Che meraviglia!". Un amico vero non si entusiasma esageratamente per ogni singola frase elementare. Reagisci con spontaneità, semplicità ed empatia (es. "Chiaro", "Capito", "Hai ragione", "È vero", "Capita anche a me", "Ci sta", "Davvero?").
   - Esprimi apprezzamento solo quando è davvero motivato, in modo sobrio, sincero e contenuto.

2. SUGGERIMENTI COSTRUTTIVI E AMICHEVOLI NEL DIALOGO (COME UN VERO AMICO):
   - Come farebbe un buon amico italiano che vuole aiutarti a parlare in modo più naturale e corretto, dai consigli amichevoli e costruttivi DIRETTAMENTE nel flusso della conversazione:
     * Se lo studente fa un errore grammaticale, usa una parola imprecisa o una costruzione poco naturale per un italiano, offri l'alternativa naturale con garbo e spontaneità.
     * Esempi di tono amichevole:
       - "Ah, ho capito! Tra l'altro noi italiani diciamo spesso '...' per dirlo in modo più naturale. E tu invece...?"
       - "Chiaro! Piccola dritta: in questo caso si dice più spesso '...' invece di '...'. Comunque sono d'accordo con te!"
       - "Ah certo! Per dirlo proprio spontaneo puoi dire '...'; ma dimmi, poi com'è andata?"
     * Mantieni il suggerimento brevissimo (massimo 1 frase informale, senza fare lezioni pesanti o interrompere bruscamente) e fai subito proseguire il dialogo sul tema.

3. RITMO E COMPLESSITÀ LEGATI AL LIVELLO DI COMPETENZA (0-100):
   - Rispetta scrupolosamente le istruzioni di ritmo e complessità definite sopra per il punteggio dello studente:
     * Se il livello è basso (score <= 35), parla NOTEVOLMENTE PIÙ LENTO, fai pause di 1-2 secondi tra le frasi, scandisci le parole e usa frasi brevi e vocabolario basilare.
     * Risposte brevi: massimo 2 o 3 frasi per turno (circa 20-35 parole). Non fare mai monologhi lunghi.

4. IL TEMA È SOLO UN SEMPLICE SPUNTO (ICEBREAKER):
   - Usa "${topicParam}" soltanto come aggancio per la conversazione.
   - NON essere mai insistente o rigido su questo argomento.
   - Se lo studente cambia argomento, parla della propria giornata, della famiglia, del lavoro, di viaggi o di qualsiasi altra cosa, SEGUI IMMEDIATAMENTE E CON PIACERE il suo argomento!
   - Non forzare mai il ritorno al tema iniziale. L'unico scopo è mantenere una conversazione viva, piacevole e naturale in italiano.

5. NON TERMINARE OGNI INTERVENTO CON UNA DOMANDA:
   - È FONDAMENTALE evitare la sensazione di interrogatorio: NON chiudere artificialmente ogni tua frase con una domanda.
   - In una vera telefonata tra amici, spesso si esprime solo una reazione, un commento, un'opinione personale o una battuta, lasciando poi spontaneamente spazio all'altro.
   - Fai una domanda SOLO ED ESCLUSIVAMENTE quando la conversazione rischia di spegnersi o se lo studente sembra esitare.

6. COMPRENSIONE ED ESPRESSIONE DELLO STUDENTE (REGOLA CRUCIALE):
   - Se lo studente ha difficoltà a esprimersi, esita o se non capisci chiaramente ciò che ha pronunciato:
     * NON rimproverare o rimbrottare MAI lo studente.
     * NON insinuare o affermare MAI che lo studente "non sta parlando in italiano".
     * Chiarisci invece brevemente e con simpatia che ti è sfuggita l'ultima parola (es. "Scusami, non ho afferrato benissimo l'ultima parola...").
     * Formula subito una breve ipotesi amichevole su ciò che intendeva dire (es. "...intendevi forse dire che...?").

7. PULSANTE "FEEDBACK" (SE RICHIESTO ESPRESSAMENTE DALL'UTENTE):
   - Se lo studente preme espressamente il pulsante "Feedback", offri un riassunto costruttivo, amichevole e sobrio:
     * Segnala con simpatia al massimo 1 o 2 punti di miglioramento con spiegazione breve su come dirlo più naturalmente.
     * Cita 2 o 3 vocaboli o espressioni chiave utili emerse dal dialogo.
     * NON CHIUDERE MAI LA TELEFONATA DI TUA INIZIATIVA: rimani in linea con disponibilità per chiarimenti o per continuare la chiacchierata.

8. MEMORIA PERMANENTE DELLO STUDENTE (REGOLA CRUCIALE):
   Non appena lo studente dice o conferma il proprio nome (es. 'Mi chiamo Peter', 'Sono Peter', 'Peter') o condivide qualsiasi informazione personale permanente (città dove vive, professione/lavoro, passioni/hobby, famiglia, animali, viaggi in Italia, obiettivi di studio):
   * CHIAMA SUBITO lo strumento savePermanentStudentData passando il nome dello studente e i fatti emersi!
   * Rispondi subito con calore naturale chiamando lo studente per nome o commentando amichevolmente il fatto personale.`,
      },
      callbacks: {
        onmessage: async (message) => {
          // 1. Audio and text from model turn
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          const text = message.serverContent?.modelTurn?.parts?.find((p: any) => p.text)?.text;
          if (audio) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'audio', audio, text }));
            }
          }
          if (message.serverContent?.interrupted) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }
          }

          // 2. User spoken input transcription from Gemini
          const userTranscription = message.serverContent?.inputTranscription?.text;
          if (userTranscription && userTranscription.trim()) {
            const cleanText = userTranscription.trim();
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'user_transcript', text: cleanText }));
            }

            // Real-time regex detection of student name as an instant safety net
            const nameMatch = cleanText.match(
              /(?:mi\s+chiamo|io\s+sono|il\s+mio\s+nome\s+è|sono\s+io|sono|ich\s+hei(?:ß|ss)e|mein\s+name\s+ist|my\s+name\s+is)\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)/i
            );
            if (nameMatch && nameMatch[1]) {
              const rawName = nameMatch[1];
              const stopWords = ['un', 'uno', 'una', 'italiano', 'tedesco', 'inglese', 'contento', 'felice', 'pronto', 'bene', 'qui', 'molto'];
              if (!stopWords.includes(rawName.toLowerCase())) {
                const capitalName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'personal_fact_discovered',
                      name: capitalName,
                      facts: [{ category: 'name', label: 'Nome', value: capitalName }],
                    })
                  );
                }
              }
            }
          }

          // 3. Model output transcription from Gemini
          const modelTranscription = message.serverContent?.outputTranscription?.text;
          if (modelTranscription && modelTranscription.trim()) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'model_transcript', text: modelTranscription.trim() }));
            }
          }

          // 4. Real-time Tool Call for permanent personal fact storage
          if (message.toolCall?.functionCalls && liveSession) {
            for (const call of message.toolCall.functionCalls) {
              if (call.name === 'savePermanentStudentData') {
                const args = (call.args || {}) as any;
                const sName = (args.studentName || '').trim();
                const sFacts = Array.isArray(args.newFacts) ? args.newFacts : [];

                if (sName || sFacts.length > 0) {
                  const factsToSend = [...sFacts];
                  if (sName && !factsToSend.some((f: any) => f.category === 'name' || f.label?.toLowerCase() === 'nome')) {
                    factsToSend.unshift({ category: 'name', label: 'Nome', value: sName });
                  }
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'personal_fact_discovered',
                        name: sName,
                        facts: factsToSend,
                      })
                    );
                  }
                }

                try {
                  await liveSession.sendToolResponse({
                    functionResponses: [
                      {
                        response: { output: { success: true, message: 'Dati memorizzati permanentemente nel profilo.' } },
                        id: call.id,
                      },
                    ],
                  });
                } catch (tErr) {
                  console.warn('Error sending tool response to liveSession:', tErr);
                }
              }
            }
          }
        },
        onclose: () => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'session_closed' }));
          }
        },
        onerror: (err) => {
          console.error('Gemini Live session error:', err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'error', message: String(err) }));
          }
        },
      },
    });

    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'connected' }));
      // Automatically trigger Andrea's initial call greeting (Turn 1: brief greeting only, no topic yet)
      try {
        const nameGreeting = studentName ? ` Ciao ${studentName}!` : ` Ciao! Sono Andrea.`;
        const welcomeBack = sessionHistory.length > 0 && studentName ? ` Che piacere risentirti!` : ` Che piacere fare due chiacchiere oggi!`;
        
        const greetingPrompt = `Inizia la telefonata con lo studente. Saluta SOLO brevemente con i consueti convenevoli amichevoli di rito (ad esempio: "Pronto!${nameGreeting}${welcomeBack} Come stai oggi? Tutto bene?").
REGOLA TASSATIVA E IMPERATIVA: NON nominare, NON anticipare e NON proporre assolutamente il tema o argomento della sessione in questa prima battuta! Limitati ESCLUSIVAMENTE al breve saluto cordiale di apertura, in modo che lo studente possa salutarti e rispondere a sua volta. Proporrai il tema solo nel turno successivo, dopo che lo studente avrà risposto al tuo saluto, chiedendogli se gli va bene.`;

        liveSession.sendRealtimeInput({
          text: greetingPrompt,
        });
      } catch (greetErr) {
        console.warn('Initial greeting trigger warning:', greetErr);
      }
    }

    clientWs.on('message', (messageBuffer) => {
      try {
        const payload = JSON.parse(messageBuffer.toString());
        if (payload.type === 'request_feedback' && liveSession) {
          liveSession.sendRealtimeInput({
            text: "Andrea, per favore dammi adesso il tuo feedback vocale sulla nostra conversazione! Ricorda le regole: evidenzia al massimo 2 errori gravi se presenti, altrimenti fammi semplicemente un caloroso complimento; poi cita in pochissime parole 2-3 vocaboli o frasi chiave della conversazione. Infine resta disponibile e non chiudere la telefonata, così posso farti altre domande o continuare a parlare se voglio.",
          });
        } else if (payload.audio && liveSession) {
          liveSession.sendRealtimeInput({
            audio: {
              data: payload.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (payload.text && liveSession) {
          liveSession.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch (err) {
        console.error('Error handling WebSocket message from client:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('Client WebSocket closed');
      if (liveSession) {
        try {
          liveSession.close();
        } catch (_) {}
      }
    });
  } catch (err) {
    console.error('Failed to establish Gemini Live session:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: 'Impossibile avviare la sessione Live in tempo reale. Assicurati che il microfono sia abilitato.',
        })
      );
    }
  }
});

// Mount Vite or static files
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Maestro Italiano in ascolto su http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server launch failed:', err);
});
