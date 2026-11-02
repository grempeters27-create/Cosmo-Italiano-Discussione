# Piano di Implementazione: Carattere Amichevole & Controllo Dinamico del Ritmo/Livello

Miglioramento del comportamento relazionale del tutor Andrea e controllo granulare di ritmo e complessità linguistica in funzione della scala di competenza (0-100).

> [!IMPORTANT]
> **Decisioni confermate dall'utente nella Fase 1:**
> 1. **Stile di correzione e miglioramento linguistico:** Inserimento occasionale, spontaneo e informale di suggerimenti di formulazione direttamente nel dialogo ("come farebbe un amico"), senza interrompere bruscamente il flusso né aspettare solo il report finale.
> 2. **Sprechtempo bei niedrigem Sprachlevel (0-35):** Deutlich spürbare Reduzierung des Sprechtempos mit klarer Artikulation, kurzen Denkpausen und einfacher Satzstruktur.

---

## 1. Obiettivo & Visione Pedagogica

- **Carattere "Amico Italiano Autentico":** Eliminare l'enfasi e le lodi artificiose ("fantastico!", "bravissimo!", "straordinario!"). Andrea deve comportarsi come un caro amico madrelingua italiano: calmo, caloroso, interessato alle opinioni dell'utente, onesto e costruttivo.
- **Correzione Naturale & Costruttiva (Friendly Guidance):** Quando l'utente impiega un'espressione poco naturale o un costrutto zoppicante, Andrea non fa una lezione accademica ma offre con leggerezza l'alternativa idiomatica (es. *"Ah sì, capisco! Tra l'altro noi diciamo spesso '...' per rendere meglio l'idea, tu invece come hai vissuto quella situazione?"*).
- **Controllo Integrato del Ritmo di Conversazione (0-100):**
  - **Livello 0 - 35 (Base / Elementare):** Parlato lento, scandito, pause percettibili tra le frasi, lessico quotidiano ad alta frequenza, coordinate semplici.
  - **Livello 36 - 65 (Intermedio):** Parlato disteso e naturale, velocità moderata, introduzione graduale di espressioni idiomatiche con spiegazione contestuale.
  - **Livello 66 - 100 (Avanzato / Fluente):** Parlato nativo e spontaneo, velocità naturale di Roma/Milano, ricchezza idiomatica, umorismo e sfumature culturali.

---

## 2. Modifiche Architetturali & Prompt Engineering

```
┌────────────────────────────────────────────────────────┐
│               Memoria Studente (0 - 100)               │
│      profScore: 25 -> "Principiante / Base"            │
└───────────────────────────┬────────────────────────────┘
                            │
              Parametri passati a Live WS & TTS
                            │
   ┌────────────────────────┴───────────────────────────┐
   ▼                                                    ▼
┌───────────────────────────┐        ┌───────────────────────────┐
│ Gemini Live System Prompt │        │ Sintesi Audio / TTS       │
│ - Persona: Amico naturale │        │ - Speed directive: slow   │
│ - No lodi esagerate       │        │ - Pronuncia scandita      │
│ - Correzioni spontanee    │        │ - Pause adeguate          │
│ - Ritmo verbale modulato  │        └───────────────────────────┘
└───────────────────────────┘
```

### A. Aggiornamento Direttiva Gemini Live (`server.ts` & Live WS)
1. **Riformulazione del Profilo di Andrea:**
   - Vietare espressioni iperboliche ripetitive (*"fantastico", "meraviglioso", "bravissimo", "incredibile"*).
   - Impostare il tono di un vero amico italiano: pacato, empatico, curioso, che reagisce con naturalezza (*"Chiaro", "Capisco bene", "Hai ragione", "È successo anche a me"*).
   - Istruzione esplicita per **feedback costruttivi amichevoli**: proporre ogni tanto una formulazione migliore in modo fluido all'interno della risposta, senza bloccare la conversazione.
2. **Direttiva Dettagliata per Fascia di Punteggio (0-100):**
   - **0-35:** *Ritmo volutamente lento, sillabazione chiara, pause naturali di 1-2 secondi, vocabolario base, frasi di massimo 10-15 parole.*
   - **36-65:** *Ritmo medio naturale e rilassato, frasi chiare, ritmo tipico di una chiacchierata informale.*
   - **66-100:** *Ritmo nativo fluido, intercalari naturali, lessico ricco.*

### B. Aggiornamento del Servizio Sintesi Vocale (`/api/tts` & Fallback)
- Collegare il parametro `speed` allo score dello studente:
  - Se `profScore <= 35` o livello base: selezionare lo stile TTS con ritmo scandito, vocabolario didattico e cadenza lenta.
  - Se `profScore > 35`: velocità naturale da conversazione.

### C. Revisione del Prompt di Feedback Post-Chiamata (`/api/call-feedback`)
- Modificare il prompt affinché il feedback finale non sia adulante o pomposo, ma concreto, onesto e motivante in stile amichevole.

---

## 3. Piano di Verifica
1. **Verifica Compilazione:** Eseguire `compile_applet` per assicurare l'assenza di errori TypeScript o di sintassi.
2. **Test di Connessione & Prompt:** Verificare che i prompt di `server.ts` passino correttamente le istruzioni di ritmo, stile amichevole e modulazione della velocità in base allo score 0-100.
3. **Verifica Interfaccia:** Assicurarsi che nei controlli o nel display del livello lo studente possa percepire chiaramente che l'esperienza è calibrata sul proprio ritmo.
