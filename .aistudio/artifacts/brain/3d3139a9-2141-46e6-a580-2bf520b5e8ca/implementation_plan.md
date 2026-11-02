# 100% Themenfokussierte Presse-Recherche: Deutsche, Italienische & Europäische Perspektive

Dieser Plan behebt die thematische Abweichung bei den Recherche-Karten (z. B. Bürgergeld bei einer Folge über Gerhard Schröder) und richtet alle drei Karten kompromisslos und zu 100 % auf das konkrete Thema und den Protagonisten der jeweiligen Podcast-Episode aus. Gemäß Ihren Antworten wird jede Karte eine eigenständige geografisch-journalistische Perspektive abbilden (deutsche Presse, italienische Presse, europäische/internationale Presse) und die Live-Websuche erhält ein großzügiges Ladezeitfenster für fundierte Echtzeit-Recherchen.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Verbindliche Festlegungen aus Ihren Antworten:

- **Die 3 journalistischen Blickwinkel (Bestätigt)**:
  - **Karte 01 · Stampa Tedesca (Deutsche Leitmedien)**: Z. B. *Der Spiegel*, *FAZ*, *Süddeutsche Zeitung*, *Die Zeit* – Reaktionen, Kontroversen und juristische/politische Vorgänge im deutschen Inland.
  - **Karte 02 · Stampa Italiana (Italienische Berichterstattung)**: Z. B. *Corriere della Sera*, *La Repubblica*, *ANSA*, *Il Sole 24 Ore* – Der italienische Blick auf den Protagonisten, geopolitische Vergleiche und Reaktionen in Rom.
  - **Karte 03 · Stampa Europea & Internazionale (Europäische Perspektive)**: Z. B. *Politico Europe*, *Reuters*, *Le Monde*, *Financial Times* – Europäische Tragweite, EU-Sanktionsdebatten und internationale Konsequenzen.
- **Sucharchitektur & Zeitfenster (Bestätigt)**:
  - Ausführliche Live-Websuche mit verlässlichem Zeitfenster (16 Sekunden Timeout) für Gemini 3.8 Flash mit Google Search Grounding, damit die KI genügend Zeit hat, echte Webquellen zu allen drei Ländern zu durchsuchen.
  - Vollständige Eliminierung von fehlerhaften Schlagwort-Abzweigungen (wie allgemeines *Bürgergeld* bei *SPD*): Selbst im Notfall-Fallback werden die 3 Karten strikt aus dem konkreten Titel und den Hauptpersonen synthetisiert.

---

### 1. Overview & Core Concept

- **Problemursache**: Bislang löste das Wort «SPD» im Episodentext über Gerhard Schröder eine zu grob definierte Vorlage aus, die allgemeine Arbeitsmarktthemen (Bürgergeld, Gastarbeiter) behandelte, anstatt Gerhard Schröders Russland-Verbindungen, die Kontroversen um Gazprom/Rosneft und die Aberkennung von Bundestags-Privilegien. Zudem war das Timeout der Live-Websuche zu knapp bemessen.
- **Lösung**: 
  1. Der Recherche-Prompt verlangt zwingend die drei Perspektiven: **Stampa Tedesca**, **Stampa Italiana**, **Stampa Europea**, die sich alle drei ausschließlich um das zentrale Thema der Episode drehen.
  2. Die Backend-Suche erhält ausreichend Zeit, um per Google-Search-Grounding echte Presseartikel für diese 3 Länderperspektiven abzurufen.
  3. Die Vorlagen in `dossierEngine.ts` werden so überarbeitet, dass bei Gerhard Schröder exakt seine Affären, Mandate und Parteiverfahren beleuchtet werden, und für alle künftigen Themen ein strikter Titel- und Protagonisten-Filter greift.

---

### 2. User Experience & Visual Design

- **Karten-Struktur im Dossier**:
  - **Karte 1**: Badge `Stampa Tedesca · Germania` (z. B. *Der Spiegel / FAZ* zur Aberkennung der Altkanzler-Büros und SPD-Schiedsgericht)
  - **Karte 2**: Badge `Stampa Italiana · Italia` (z. B. *Corriere della Sera / ANSA* zum italienischen Echo auf Schröders Gazprom-Engagement)
  - **Karte 3**: Badge `Stampa Europea · Bruxelles / UE` (z. B. *Politico Europe / Reuters* zur EU-Sanktionsdebatte und europäischen Energiesicherheit)
- **Detail-Modal (`FactDetailModal`)**:
  - Zeigt im Header die Länderflagge bzw. Herkunft der Presse (`Germania`, `Italia`, `Unione Europea`).
  - Enthält die detaillierte italienische Recherche-Zusammenfassung mit direktem Link zum jeweiligen Presseorgan.

---

### 3. Key Product Decisions & Trade-Offs

- **Entscheidung 1: Dreigliedrige Länderperspektive (DE - IT - EU) statt Themenmischung**
  - *Vorteil*: Garantiert höchste thematische Relevanz bei maximaler inhaltlicher Vielfalt. Der Hörer sieht genau, wie dasselbe Thema in Berlin, Rom und Brüssel bewertet wird.
- **Entscheidung 2: Erweitertes Zeitfenster (16s) für Google Search Grounding**
  - *Vorteil*: Google Search Grounding benötigt bei mehrfachen Länderabfragen oft 6–10 Sekunden. Mit 16s läuft der Prozess stabil und bricht nicht vorzeitig in Vorlagen ab.
  - *UI-Begleitung*: Der Ladezustand der Karten zeigt weiterhin die animierten Recherche-Phasen, sodass der Nutzer sieht, dass aktiv in der europäischen Presse recherchiert wird.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│             Podcast Episode: "Gerhard Schröder: vita e scandali"       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ POST /api/episodes/analyze
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        server.ts (Gemini 3.8 Flash)                    │
│                                                                        │
│   Prompt: 3 gezielte Recherchen mit 100% Themenfokus:                 │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ 1. Stampa Tedesca (Spiegel/FAZ/SZ): Der deutsche Blick       │     │
│   │ 2. Stampa Italiana (Corriere/Repubblica/ANSA): Italiens Echo │     │
│   │ 3. Stampa Europea (Politico/Reuters): EU-Konsequenzen        │     │
│   └──────────────────────────────────────────────────────────────┘     │
│   Timeout: 16.000 ms (Grounding mit Google Search)                    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ (Bei Offline/Timeout: dossierEngine)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│             dossierEngine.ts: Explizite Schröder-Dossiers              │
│   - Niemals falsche Abzweigung zu Bürgergeld oder allgemeinen Themen   │
│   - Garantierte 3 Länder-Perspektiven für jede Folge                  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Umsetzungsschritte
1. **`server.ts`**:
   - Modell `gemini-3.8-flash` mit Google Search Grounding und 16s Timeout.
   - Präziser Prompt mit Vorgabe der 3 Länder-Perspektiven (DE, IT, EU) und absolutem Verbot thematischer Drift.
2. **`src/utils/dossierEngine.ts`**:
   - Spezifischer Zweig für Gerhard Schröder mit fundierten Recherchen (Spiegel/FAZ, Corriere della Sera, Politico).
   - Entfernung der alten breiten Schlagwortfalle (`spd` durfte nicht Bürgergeld auslösen).
   - Generischer Fallback-Generator so umgebaut, dass der Protagonist und das Thema aus dem Titel isoliert werden.
3. **Verifikation**:
   - Überprüfung des Endpunkts mit der aktuellen Episode *Gerhard Schröder* – Sicherstellung, dass alle drei Karten exakt Schröder und seine Affären aus deutscher, italienischer und europäischer Sicht behandeln.
   - Build- & Lint-Test.
