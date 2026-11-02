# Livello Linguistico Adattivo e Valutazione Continua

Un sistema didattico adattivo intelligente per Maestro Italiano che supera la classificazione statica B1, calibrando e memorizzando permanentemente la competenza linguistica dello studente (scala continua 0–100 con stadi in italiano) attraverso la valutazione dell'IA durante le conversazioni vocali e il feedback immediato post-chiamata.

## Decisioni Confermate & Scelte Chiave

> [!IMPORTANT]
> In base alle preferenze confermate nella Fase 1 di consultazione:
> - **Scala di competenza**: Punteggio progressivo da 0 a 100 con stadio descrittivo in lingua italiana (*In calibrazione* per i nuovi utenti, *Principiante*, *Elementare*, *Intermedio*, *Avanzato*, *Fluente*).
> - **Feedback di difficoltà post-chiamata**: 3 pulsanti interattivi ben visibili subito dopo aver riagganciato (`Troppo difficile`, `Perfetto`, `Troppo facile`).
> - **Avvio iniziale**: Partenza a calibrazione aperta senza vincoli o etichette pregresse, con un approccio accogliente e calibrato in tempo reale sulle risposte verbali dello studente.
> - **Integrazione con la Memoria Permanente**: Il punteggio di competenza, la cronologia degli aggiustamenti e le note di livello vengono memorizzati nel `userProfile` permanente e inviati al tutor prima di ogni conversazione.

---

## 1. Visione & Obiettivi Didattici

### Cosa Cambia
1. **Eliminazione del vincolo "B1"**: Tutte le diciture fisse "B1" nell'interfaccia (titoli, badge nella barra superiore, descrizioni di argomenti, cassetto delle frasi, prompt di sistema del server) vengono sostituite da indicatori dinamici basati sul livello effettivo dello studente.
2. **Stato Iniziale Aperto (Tabula Rasa)**: Quando l'utente inizia per la prima volta, il suo profilo è in modalità `In calibrazione`. Andrea (il tutor vocale) accoglie lo studente con un italiano caldo e limpido, osservando la scioltezza, il lessico e la struttura delle frasi.
3. **Valutazione congiunta IA + Utente**: Al termine di ogni chiamata vocale o sessione:
   - L'utente seleziona con un tocco la percezione soggettiva: `Troppo difficile`, `Perfetto` o `Troppo facile`.
   - L'IA analizza i turni di conversazione, la complessità grammaticale emersa e il riscontro dell'utente, ricalcolando il punteggio (0–100) e registrando una sintetica nota didattica.
4. **Adattamento del Maestro ad Ogni Sessione**: All'avvio di una nuova telefonata (Live API o chat), il server trasmette ad Andrea il livello corrente (es. `Livello di competenza: 62/100 · Intermedio solido`), guidando ritmo, complessità lessicale e densità delle spiegazioni.

---

## 2. Esperienza Utente & Design Visivo

### A. Badge di Competenza Dinamico nell'Header
- Sostituzione del vecchio chip statico `Livello B1` con un indicatore interattivo di competenza linguistica:
  - Nuovo utente: `🌱 In calibrazione` (tonalità neutro/ambra delicata).
  - Utente con livello stimato: `📈 Livello: 58 · Intermedio` con visualizzazione pulita e apertura della scheda profilo al clic.
- Nessuna chiusura a pillola decorativa arbitraria: tipografia nitida con cifre tabulari (`font-mono tabular-nums`) e gerarchia Fraunces / Plus Jakarta Sans.

### B. Modale o Scheda Post-Chiamata (Feedback di Difficoltà)
Subito dopo l'aggancio della telefonata vocale (`callState === 'ended'`), prima o insieme alla scheda didattica riassuntiva:
```
┌─────────────────────────────────────────────────────────────┐
│  Com'è andata questa conversazione?                         │
│  Aiuta Andrea a calibrare il ritmo e la difficoltà ideale    │
│                                                             │
│  ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐  │
│  │ 🔴 Troppo       │ │ 🎯 Perfetto   │ │ 🔵 Troppo       │  │
│  │    difficile    │ │    (Giusto)   │ │    facile       │  │
│  └─────────────────┘ └───────────────┘ └─────────────────┘  │
│                                                             │
│  Livello attuale stimato: 55/100 · Intermedio                │
└─────────────────────────────────────────────────────────────┘
```
- **Feedback Immediato**: Al clic su uno dei 3 pulsanti:
  - Compare una breve notifica visiva in italiano (es. *"Grazie! Livello aggiornato a 58/100 · Andrea adatterà il prossimo dialogo."*).
  - Il nuovo punteggio viene memorizzato immediatamente nel profilo permanente `localStorage` e sincronizzato con il server.
  - L'IA combina il feedback con l'analisi didattica della sessione (`call-feedback`).

### C. Sezione Livello nel "Profilo Permanente" (`MemoryModal.tsx`)
All'interno del modale della memoria permanente dello studente:
- Sezione dedicata: **Competenza Linguistica Adattiva**:
  - Barra di avanzamento discreta (0-100) con indicatore di progresso.
  - Denominazione dello stadio:
    - `0–20`: Principiante (A1)
    - `21–40`: Elementare (A2)
    - `41–60`: Intermedio (B1)
    - `61–80`: Intermedio Superiore (B2)
    - `81–95`: Avanzato (C1)
    - `96–100`: Fluente / Madrelingua
  - Possibilità per l'utente di reimpostare la calibrazione o aggiustare manualmente il livello con uno slider se lo desidera.

### D. Ridenominazione e Riconversione dei Componenti Esistenti
- `B1HelpDrawer.tsx` $\to$ Trasformato in **Frasario di Supporto alla Conversazione** (senza etichette fisse B1, organizzato per situazioni: *Esprimere un'opinione*, *Chiedere chiarimenti*, *Prendere tempo*, *Accordo e disaccordo*).
- Rimozione di qualsiasi riferimento residuo al tedesco e alla dicitura statica "B1" in `index.html`, `metadata.json`, `curatedTopics.ts` e `App.tsx`.

---

## 3. Decisioni di Prodotto & Modello Dati

### Approccio Scelto per il Calcolo del Livello
- **Punteggio Continuo 0–100**:
  - Valore iniziale: `undefined` o `null` (mostrato come *In calibrazione* con valore implicito di partenza 45 per una conversazione neutrale e accogliente).
  - Regola di adattamento con feedback utente:
    - Se l'utente clicca `Troppo difficile`: decremento bilanciato (-4 o -6 punti) e consiglio di rallentare il ritmo.
    - Se l'utente clicca `Troppo facile`: incremento bilanciato (+4 o +6 punti) con arricchimento lessicale.
    - Se l'utente clicca `Perfetto`: consolidamento (+1 o +2 punti per premiare la pratica completata con successo).
  - Valutazione IA post-sessione (`/api/call-feedback` e `/api/evaluate-proficiency`):
    L'analisi della trascrizione valuta se lo studente ha impiegato tempi verbali complessi, connettivi, subordinate, oppure frasi elementari, ponderando il punteggio in una banda armonica.

---

## 4. Architettura Tecnica & Flusso Dati

```
┌──────────────────────────────────────────────────────────────────┐
│                          CLIENT (REACT)                          │
│                                                                  │
│  ┌────────────────┐     ┌─────────────────────────────────────┐  │
│  │   App.tsx      │     │            Header.tsx               │  │
│  │  (callState)   │────▶│ Badge dinamico: 55/100 · Intermedio │  │
│  └───────┬────────┘     └─────────────────────────────────────┘  │
│          │ (on call ended)                                       │
│          ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Modale / Card Feedback Difficoltà:                         │ │
│  │ [Troppo difficile]  |  [Perfetto]  |  [Troppo facile]       │ │
│  └───────┬─────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ memoryService.ts                                            │ │
│  │ - updateProficiencyLevel(newScore, feedbackChoice, notes)   │ │
│  │ - saveStoredMemory(updatedMemory)                           │ │
│  └───────┬─────────────────────────────────────────────────────┘ │
└──────────┼───────────────────────────────────────────────────────┘
           │
           │ query param / body: memory={ proficiency: { score: 55, stage: 'Intermedio' } }
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                         SERVER.TS                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ /api/live (WebSocket) & /api/call-feedback                  │ │
│  │ Andrea riceve il contesto:                                  │ │
│  │ "Livello studente: 55/100 (Intermedio).                     │ │
│  │ Adatta lessico, ritmo ed eventuali costrutti a questo        │ │
│  │ livello reale senza dare nulla per scontato."               │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Modifiche alle Strutture Dati (`src/types/index.ts`)
```typescript
export type ProficiencyStage =
  | 'calibrazione'
  | 'principiante'
  | 'elementare'
  | 'intermedio'
  | 'intermedio_superiore'
  | 'avanzato'
  | 'fluente';

export interface UserProficiency {
  score: number; // 0 - 100
  stage: ProficiencyStage;
  stageLabel: string; // "In calibrazione", "Principiante", "Elementare", "Intermedio", etc.
  lastAssessmentDate: number;
  totalAssessments: number;
  history: Array<{
    timestamp: number;
    score: number;
    feedbackChoice: 'difficile' | 'perfetto' | 'facile';
    topic?: string;
  }>;
}

export interface UserProfile {
  name: string;
  proficiency?: UserProficiency;
  facts: UserPersonalFact[];
  customNotes?: string;
  updatedAt: number;
}
```

### Prompting di Sistema Adattivo per Andrea (`server.ts`)
- Sostituzione delle istruzioni rigide per "B1" con una direttiva proporzionata al punteggio:
  - `score < 30`: Parla in modo molto chiaro, usa frasi brevi e coordinate, vocabolario fondamentale quotidiano, evita il congiuntivo o forme idiomatiche oscure, sii molto incoraggiante.
  - `30 <= score <= 60`: Dialogo naturale e amichevole, ritmo regolare, frasi di media complessità, introduci occasionalmente modi di dire spiegandoli con spontaneità.
  - `score > 60`: Dialogo fluente e ricco, ritmo nativo, uso libero di tempi composti, espressioni idiomatiche autentiche e riflessioni argomentative approfondite.
  - `score non ancora definito (In calibrazione)`: Inizia con calore e semplicità, poni una domanda aperta e osserva come lo studente risponde per sintonizzarti istantaneamente sulla sua frequenza espressiva.

---

## 5. Piano di Verifica & Collaudo

1. **Test Stato Iniziale (Nuovo Utente)**:
   - Verificare che all'azzeramento o prima apertura il badge indichi chiaramente l'avvio in calibrazione.
   - Verificare che Andrea avvii la conversazione con tono aperto e accogliente senza etichette rigide.
2. **Test Interazione Post-Chiamata**:
   - Simulare o concludere una chiamata: accertarsi che i 3 pulsanti (`Troppo difficile`, `Perfetto`, `Troppo facile`) compaiano in modo reattivo e gradevole.
   - Cliccare su ciascuna opzione e verificare l'aggiornamento istantaneo del punteggio sia nel badge dell'header che nel modale del profilo permanente.
3. **Test Persistenza & Continuità**:
   - Verificare che al ricaricamento della pagina (`F5`) il punteggio e la cronologia siano perfettamente conservati nel `localStorage`.
   - Verificare che la successiva chiamata passi al WebSocket il livello aggiornato.
4. **Verifica Linguistica Completa**:
   - Assicurarsi che ogni traccia di dicitura tedesca o vincolo statico "B1" sia eliminata da tutto il progetto.
   - Compilazione con `compile_applet`.
