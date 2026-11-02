import type { DailyTopic, TopicCategory, TopicCategoryId } from '../types/index.ts';

export const TOPIC_CATEGORIES: TopicCategory[] = [
  {
    id: 'cultura',
    title: 'Cultura Italiana',
    titleIt: 'Cultura Italiana',
    titleDe: 'Cultura Italiana',
    description: 'Stile di vita, tradizioni, cucina, arte e quotidianità in Italia',
    descriptionIt: 'Stile di vita, tradizioni, cucina, arte e quotidianità in Italia',
    descriptionDe: 'Stile di vita, tradizioni, cucina, arte e quotidianità in Italia',
    icon: '🏛️',
    badgeColor: 'amber',
  },
  {
    id: 'geografia',
    title: 'Geografia & Territorio',
    titleIt: 'Geografia & Territorio',
    titleDe: 'Geografia & Territorio',
    description: 'Regioni, borghi nascosti, isole, coste e meraviglie naturali',
    descriptionIt: 'Regioni, borghi nascosti, isole, coste e meraviglie naturali',
    descriptionDe: 'Regioni, borghi nascosti, isole, coste e meraviglie naturali',
    icon: '🗺️',
    badgeColor: 'emerald',
  },
  {
    id: 'notizie',
    title: 'Notizie & Attualità Europea',
    titleIt: 'Notizie & Attualità Europea',
    titleDe: 'Notizie & Attualità Europea',
    description: 'Società, ambiente, economia, cultura e tendenze della settimana',
    descriptionIt: 'Società, ambiente, economia, cultura e tendenze della settimana',
    descriptionDe: 'Società, ambiente, economia, cultura e tendenze della settimana',
    icon: '📰',
    badgeColor: 'sky',
  },
  {
    id: 'giochi',
    title: 'Giochi Linguistici',
    titleIt: 'Giochi Linguistici',
    titleDe: 'Giochi Linguistici',
    description: 'Indovina la parola, 20 domande, giochi di ruolo e associazioni',
    descriptionIt: 'Indovina la parola, 20 domande, giochi di ruolo e associazioni',
    descriptionDe: 'Indovina la parola, 20 domande, giochi di ruolo e associazioni',
    icon: '🎲',
    badgeColor: 'violet',
  },
  {
    id: 'grammatica',
    title: 'Esercizi di Grammatica',
    titleIt: 'Esercizi di Grammatica',
    titleDe: 'Esercizi di Grammatica',
    description: 'Congiuntivo, Passato vs Imperfetto, Condizionale e Pronomi',
    descriptionIt: 'Congiuntivo, Passato vs Imperfetto, Condizionale e Pronomi',
    descriptionDe: 'Congiuntivo, Passato vs Imperfetto, Condizionale e Pronomi',
    icon: '✍️',
    badgeColor: 'rose',
  },
];

export const CURATED_TOPICS: DailyTopic[] = [
  // 1. CULTURA ITALIANA
  {
    id: 'cultura-caffe',
    categoryId: 'cultura',
    title: 'Il Rito del Caffè al Bar',
    category: 'Cultura Italiana',
    categoryDe: 'Cultura Italiana',
    italianHeadline: 'Il caffè al banco: un rituale quotidiano e sociale unico al mondo',
    description: 'Dall’espresso veloce al mattino alle regole non scritte sul cappuccino dopo le 11.',
    starterPrompt: "Oggi esploriamo un rito sacro italiano: il caffè al banco! In Italia il bar non è solo un posto dove bere un espresso, ma una vera piazza sociale. Tu come prendi il caffè e quali abitudini hai la mattina?",
  },
  {
    id: 'cultura-cucina-unesco',
    categoryId: 'cultura',
    title: 'La Cucina delle Nonne & UNESCO',
    category: 'Cultura Italiana',
    categoryDe: 'Cultura Italiana',
    italianHeadline: 'La cucina tradizionale italiana candidata patrimonio immateriale UNESCO',
    description: 'La passione per gli ingredienti freschi, le ricette regionali e il pranzo domenicale in famiglia.',
    starterPrompt: "Parliamo di una bellissima tradizione culturale: la cucina casalinga e il pranzo domenicale con la famiglia. In Italia ogni regione ha i suoi segreti e difende le proprie ricette. Qual è il tuo piatto italiano preferito e ami cucinare a casa?",
  },
  {
    id: 'cultura-cinema-musica',
    categoryId: 'cultura',
    title: 'Cinema & Canzone d’Autore',
    category: 'Cultura Italiana',
    categoryDe: 'Cultura Italiana',
    italianHeadline: 'Dal Festival di Sanremo ai capolavori del cinema neorealista e moderno',
    description: 'Come la musica e il cinema raccontano l’anima, le passioni e la società italiana.',
    starterPrompt: "Vorrei condividere una curiosità su musica e cinema italiano: dal fenomeno del Festival di Sanremo ai grandi registi come Fellini o Sorrentino. Ti capita mai di ascoltare cantanti italiani o guardare film in lingua originale?",
  },
  {
    id: 'cultura-passeggiata',
    categoryId: 'cultura',
    title: 'L’Aperitivo e "La Passeggiata"',
    category: 'Cultura Italiana',
    categoryDe: 'Cultura Italiana',
    italianHeadline: 'Lo stile di vita rilassato: l’aperitivo al tramonto e la passeggiata sul corso',
    description: 'La famosa arte di "fare due passi" la sera per incontrare amici e salutare i vicini.',
    starterPrompt: "Oggi ti racconto una delle usanze più amate: l'aperitivo e la classica 'passeggiata' serale nel centro città per incontrare conoscenti prima di cena. Esiste un'abitudine simile dove vivi tu?",
  },

  // 2. GEOGRAFIA & TERRITORIO
  {
    id: 'geo-borghi',
    categoryId: 'geografia',
    title: 'I Borghi più Belli d’Italia',
    category: 'Geografia & Territorio',
    categoryDe: 'Geografia & Territorio',
    italianHeadline: 'Alla scoperta dei borghi medievali nascosti tra colline e montagne',
    description: 'Paesini incantati arroccati lontano dalle rotte turistiche di massa.',
    starterPrompt: "Facciamo un viaggio geografico tra i borghi nascosti d'Italia! Oltre a Roma, Firenze e Venezia, ci sono centinaia di piccoli borghi medievali meravigliosi dove il tempo sembra essersi fermato. Hai mai visitato un borgo storico italiano?",
  },
  {
    id: 'geo-nord-sud',
    categoryId: 'geografia',
    title: 'Contrasti tra Nord, Centro e Sud',
    category: 'Geografia & Territorio',
    categoryDe: 'Geografia & Territorio',
    italianHeadline: 'Dalle Alpi innevate alle coste mediterranee della Sicilia e della Puglia',
    description: 'Come la conformazione geografica della penisola ha plasmato dialetti, climi e tradizioni uniche.',
    starterPrompt: "L'Italia ha una conformazione geografica davvero incredibile: una penisola stretta e lunga, con le vette alpine al nord e il caldo mare africano al sud. Ti affascinano di più le montagne innevate o le coste assolate?",
  },
  {
    id: 'geo-isole-vulcani',
    categoryId: 'geografia',
    title: 'Isole & Vulcani: Sicilia, Sardegna ed Etna',
    category: 'Geografia & Territorio',
    categoryDe: 'Geografia & Territorio',
    italianHeadline: 'Il fascino selvaggio delle grandi isole e la maestosità dell’Etna',
    description: 'Terre di fuoco, mare cristallino e una storia millenaria al centro del Mediterraneo.',
    starterPrompt: "Oggi voliamo con l'immaginazione verso le isole italiane: la Sicilia con il maestoso vulcano Etna e la Sardegna con il suo mare caraibico e le sue rocce granitiche. Ti piacerebbe fare una vacanza su un'isola mediterranea?",
  },
  {
    id: 'geo-laghi-alpi',
    categoryId: 'geografia',
    title: 'I Grandi Laghi del Nord e le Dolomiti',
    category: 'Geografia & Territorio',
    categoryDe: 'Geografia & Territorio',
    italianHeadline: 'Lago di Garda, Como e le guglie rosa delle Dolomiti patrimonio UNESCO',
    description: 'Paesaggi alpini mozzafiato che incantano viaggiatori, escursionisti e scrittori.',
    starterPrompt: "Vorrei farti scoprire i laghi del Nord Italia, come il Lago di Como e il Garda, incorniciati dalle Alpi e dalle Dolomiti. Preferisci la tranquillità di una gita in battuta sul lago o una camminata panoramica in quota?",
  },

  // 3. NOTIZIE & ATTUALITÀ EUROPEA
  {
    id: 'notizie-treni-sostenibili',
    categoryId: 'notizie',
    title: 'Treni Notturni & Alta Velocità in Europa',
    category: 'Notizie & Attualità Europea',
    categoryDe: 'Notizie & Attualità Europea',
    italianHeadline: 'La rinascita dei treni veloci e notturni per collegare le capitali europee',
    description: 'Sempre più viaggiatori scelgono il treno al posto dell’aereo per ridurre le emissioni di CO2.',
    starterPrompt: "Nelle ultime notizie europee si parla molto del grande ritorno dei treni notturni e del potenziamento delle linee ad alta velocità tra Italia, Francia, Germania e Austria per ridurre le emissioni. Tu preferisci viaggiare in treno o in aereo quando ti sposti in Europa?",
    isNewsResearched: true,
  },
  {
    id: 'notizie-smart-working-borghi',
    categoryId: 'notizie',
    title: 'Smart Working e Ripopolamento dei Borghi',
    category: 'Notizie & Attualità Europea',
    categoryDe: 'Notizie & Attualità Europea',
    italianHeadline: 'Incentivi per nomadi digitali e giovani professionisti nei borghi italiani',
    description: 'Nuove leggi e progetti regionali per rivitalizzare i paesi interni offrendo fibra ultraveloce.',
    starterPrompt: "Un tema di grande attualità nei giornali italiani: molti comuni offrono incentivi a professionisti europei che lavorano da remoto per trasferirsi nei piccoli centri. Se potessi lavorare da ovunque con il computer, ti trasferiresti in un borgo italiano tranquillo?",
    isNewsResearched: true,
  },
  {
    id: 'notizie-turismo-venezia',
    categoryId: 'notizie',
    title: 'Turismo Sostenibile e Tutela delle Città Storiche',
    category: 'Notizie & Attualità Europea',
    categoryDe: 'Notizie & Attualità Europea',
    italianHeadline: 'La sperimentazione del contributo di accesso a Venezia per frenare l’overtourism',
    description: 'Il dibattito europeo su come proteggere le città storiche preservando la qualità della vita dei residenti.',
    starterPrompt: "Una notizia che fa molto discutere in tutta Europa: Venezia ha introdotto un biglietto d'accesso per i turisti giornalieri per combattere l'eccesso di turismo e tutelare la laguna. Secondo te è una misura giusta o limita la libertà di viaggiare?",
    isNewsResearched: true,
  },
  {
    id: 'notizie-energia-rinnovabile',
    categoryId: 'notizie',
    title: 'Energia Solare e Agrovoltaico nel Sud Italia',
    category: 'Notizie & Attualità Europea',
    categoryDe: 'Notizie & Attualità Europea',
    italianHeadline: 'L’Italia del Sud tra i leader europei per la crescita dell’energia solare e delle comunità energetiche',
    description: 'Nuovi progetti per combinare agricoltura biologica e pannelli solari innovativi.',
    starterPrompt: "Dalle notizie economiche e ambientali: il Sud Italia sta vivendo un vero boom dell'energia solare e delle comunità energetiche cittadine. Nel tuo paese come procede la transizione ecologica? Sei ottimista per il futuro dell'energia pulita?",
    isNewsResearched: true,
  },

  // 4. GIOCHI LINGUISTICI
  {
    id: 'gioco-worteraten',
    categoryId: 'giochi',
    title: 'Indovina la Parola',
    category: 'Giochi Linguistici',
    categoryDe: 'Giochi Linguistici',
    italianHeadline: '3 indizi per indovinare un oggetto, un piatto o una città italiana!',
    description: 'Andrea ti darà tre indizi misteriosi in italiano: prova a scoprire di cosa si tratta!',
    starterPrompt: "Giochiamo insieme a 'Indovina la Parola'! Io penso a una cosa tipicamente italiana (un cibo, un monumento o un oggetto) e ti darò 3 indizi curiosi in italiano. Tu puoi farmi domande per indovinare. Sei pronto a iniziare?",
    gameType: 'Indovina la parola',
    gameRules: 'Andrea sceglie una parola segreta e fornisce 3 indizi vivaci; lo studente fa ipotesi e domande in italiano.',
  },
  {
    id: 'gioco-venti-domande',
    categoryId: 'giochi',
    title: 'Il Gioco delle 20 Domande',
    category: 'Giochi Linguistici',
    categoryDe: 'Giochi Linguistici',
    italianHeadline: 'Pensa a un personaggio famoso italiano o scopri chi ho in mente io',
    description: 'Fai domande a cui si può rispondere solo con "Sì", "No" o "Forse" per svelare l’identità misteriosa.',
    starterPrompt: "Facciamo una sfida divertente: il gioco delle 20 domande! Ho in mente una celebrità italiana famosa in tutto il mondo (attore, cantante, artista o scienziato). Fammi delle domande a cui posso rispondere solo Sì o No per scoprire chi è!",
    gameType: '20 domande',
    gameRules: 'Domande e risposte rapide con Sì/No/Forse per allenare domande chiuse e vocabolario.',
  },
  {
    id: 'gioco-due-verita',
    categoryId: 'giochi',
    title: 'Due Verità e Una Bugia',
    category: 'Giochi Linguistici',
    categoryDe: 'Giochi Linguistici',
    italianHeadline: 'Andrea ti racconta 3 aneddoti su di sé o sull’Italia: uno è falso!',
    description: 'Allena l’ascolto critico, la deduzione e il sorriso scoprendo qual è l’affermazione inventata.',
    starterPrompt: "Oggi giochiamo a 'Due verità e una bugia'! Ti dirò 3 affermazioni curiose su di me e sull'Italia: due sono verissime, ma una è una simpatica bugia inventata. Ascolta bene e dimmi quale secondo te è quella falsa!",
    gameType: 'Due verità e una bugia',
    gameRules: '3 affermazioni da analizzare criticamente in italiano prima di indovinare la bugia.',
  },
  {
    id: 'gioco-cosa-faresti-se',
    categoryId: 'giochi',
    title: 'Cosa Faresti Se...? (Gioco di Ruolo)',
    category: 'Giochi Linguistici',
    categoryDe: 'Giochi Linguistici',
    italianHeadline: 'Situazioni curiose e imprevisti divertenti da risolvere insieme in italiano',
    description: 'Mettiti alla prova: dal treno perso a Roma alla vincita di un viaggio gastronomico da sogno.',
    starterPrompt: "Facciamo un gioco di ruolo e fantasia: 'Cosa faresti se...'! Immagina questa situazione: ti trovi alla stazione di Firenze, hai perso l'ultimo treno per Roma e ti restano solo 20 euro in tasca. Cosa faresti per risolvere la situazione?",
    gameType: 'Gioco di ruolo',
    gameRules: 'Improvvisazione e problem solving orale in italiano per simulare situazioni reali e divertenti.',
  },

  // 5. ESERCIZI DI GRAMMATICA
  {
    id: 'gramm-congiuntivo',
    categoryId: 'grammatica',
    title: 'Congiuntivo Presente nelle Opinioni',
    category: 'Esercizi di Grammatica',
    categoryDe: 'Esercizi di Grammatica',
    italianHeadline: 'Esprimere opinioni e dubbi: "Penso che sia...", "Credo che abbia..."',
    description: 'Pratica orale naturale sull’uso del congiuntivo presente senza paure o formule noiose.',
    starterPrompt: "Oggi alleniamo insieme una delle strutture più espressive della lingua italiana: il congiuntivo presente per formulare la tua opinione personale ('Penso che sia...', 'Credo che l'Italia abbia...'). Ti farò un paio di domande su argomenti intriganti e proveremo a usare queste formule naturali!",
    grammarFocus: 'Congiuntivo Presente (verbi regolari e irregolari: sia, abbia, possa, vada)',
  },
  {
    id: 'gramm-passato-imperfetto',
    categoryId: 'grammatica',
    title: 'Passato Prossimo vs Imperfetto',
    category: 'Esercizi di Grammatica',
    categoryDe: 'Esercizi di Grammatica',
    italianHeadline: 'Raccontare storie e ricordi: azioni puntuali ("Ieri ho fatto") vs descrizioni ("Da bambino andavo")',
    description: 'Impara a distinguere con scioltezza quando usare l’imperfetto per descrivere l’atmosfera.',
    starterPrompt: "Oggi facciamo pratica su un classico della conversazione italiana: la differenza tra Passato Prossimo e Imperfetto quando raccontiamo una storia. Raccontami un tuo ricordo felice di un viaggio o di un'estate passata: io ti aiuterò a scegliere i tempi ideali mentre parli!",
    grammarFocus: 'Passato Prossimo (azioni concluse nel tempo) vs Imperfetto (abitudini, descrizioni continue)',
  },
  {
    id: 'gramm-condizionale',
    categoryId: 'grammatica',
    title: 'Condizionale di Cortesia & Desideri',
    category: 'Esercizi di Grammatica',
    categoryDe: 'Esercizi di Grammatica',
    italianHeadline: 'Ordinare con eleganza ed esprimere desideri: "Vorrei...", "Mi piacerebbe...", "Potresti...?"',
    description: 'Formule autentiche per sembrare subito cortesi e padroneggiare le sfumature della lingua.',
    starterPrompt: "Mettiamo alla prova il condizionale presente! In italiano è fondamentale per esprimere desideri ('Vorrei visitare...', 'Mi piacerebbe vivere...') e per essere super gentili al bar o al ristorante ('Potrebbe portarmi il conto, per favore?'). Simuliamo una situazione insieme!",
    grammarFocus: 'Condizionale Presente (Vorrei, Mi piacerebbe, Potresti, Sarebbe bello)',
  },
  {
    id: 'gramm-periodo-ipotetico',
    categoryId: 'grammatica',
    title: 'Periodo Ipotetico della Possibilità',
    category: 'Esercizi di Grammatica',
    categoryDe: 'Esercizi di Grammatica',
    italianHeadline: '"Se potessi viaggiare nel tempo, andrei a Venezia nel Settecento!"',
    description: 'Combina "Se + congiuntivo imperfetto" con il "condizionale presente" per immaginare scenari fantastici.',
    starterPrompt: "Oggi ci divertiamo con il periodo ipotetico della possibilità: 'Se avessi un milione di euro, comprerei...' oppure 'Se potessi parlare con Leonardo da Vinci, gli chiederei...'. Completa questa frase: se potessi teletrasportarti adesso in qualsiasi città d'Italia, dove andresti?",
    grammarFocus: 'Se + Congiuntivo Imperfetto (fossi, avessi, potessi) + Condizionale Presente (andrei, farei)',
  },
];

/**
 * Get a random topic for a specific category ID (ensures variety)
 */
export function getRandomTopicForCategory(categoryId: TopicCategoryId, excludeId?: string): DailyTopic {
  const topicsInCategory = CURATED_TOPICS.filter((t) => t.categoryId === categoryId);
  if (topicsInCategory.length === 0) return CURATED_TOPICS[0];

  const pool = excludeId && topicsInCategory.length > 1
    ? topicsInCategory.filter((t) => t.id !== excludeId)
    : topicsInCategory;

  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

/**
 * Get a completely random topic from all categories
 */
export function getRandomTopic(excludeId?: string): DailyTopic {
  const pool = excludeId && CURATED_TOPICS.length > 1
    ? CURATED_TOPICS.filter((t) => t.id !== excludeId)
    : CURATED_TOPICS;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}
