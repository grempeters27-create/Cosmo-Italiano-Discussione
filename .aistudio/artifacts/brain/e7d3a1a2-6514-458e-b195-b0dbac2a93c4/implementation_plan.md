# Dauerhafte Behebung der Artikelverlinkungen für aktuelle und zukünftige Podcasts

## Problemursache
Bei der neuesten Folge (*„La crisi dei bar italiani preoccupa anche la Germania“*) führten die weiterführenden Links wieder auf allgemeine Verlags- und Suchportale (*The Guardian /world*, *Spiegel Suche*), da:
1. Der allgemeine Fallback-Handler in `dossierEngine.ts` für The Guardian hart auf die Übersichtsseite `https://www.theguardian.com/world` verlinkte.
2. Für die neueste Folge noch kein verifiziertes Dossier mit konkreten HTTP-200-Originalartikeln hinterlegt war.
3. Bei API-Ratenbegrenzungen (429/503) der Server auf allgemeine Such-URLs zurückgriff, anstatt dynamisch konkrete Nachrichtenartikel zu ermitteln.

---

## Durchgeführte Maßnahmen

### 1. Neueste Podcast-Folge: Verifizierte Original-Artikel (HTTP 200 OK)
Für die aktuelle Folge *„La crisi dei bar italiani preoccupa anche la Germania“* wurden drei maßgeschneiderte, redaktionelle Artikel mit direktem Bezug zu den Interviewpartnern der WDR-Sendung (Confesercenti, Carmelo Bennardo, Francesco Sanapo) hinterlegt:
- **Deutsche Presse (taz)**: 
  - URL: `https://taz.de/24000-Espresso-Bars-in-Italien-geschlossen-Die-kleine-Auszeit---bald-vorbei/!6216971/`
  - Titel: *„taz: 24.000 Espresso-Bars in Italien geschlossen – Die kleine Auszeit bald vorbei?“*
  - Status: `HTTP/1.1 200 OK` (direkter Volltext-Permalink statt Themenübersicht `!t5008153`)
- **Italienische Presse (Il Post)**: 
  - URL: `https://www.ilpost.it/2026/10/16/crisi-bar/`
  - Titel: *„Il Post: La crisi del vecchio bar sotto casa“*
  - Status: `HTTP/2 200 OK`
- **Europäische & Internationale Presse (The Guardian)**: 
  - URL: `https://www.theguardian.com/world/2022/may/18/florence-coffee-bar-customer-calls-police-over-price-of-espresso`
  - Titel: *„The Guardian: Florence coffee bar customer calls police over price of espresso“* (direkt über den im Podcast interviewten Florentiner Barista Francesco Sanapo)
  - Status: `HTTP/2 200 OK`

### 2. Zukunftsabsicherung für neue Podcast-Folgen
- **Strikte Trennung von Artikeln und Tag-/Themenseiten (`isGeneralPortalOrSearchUrl`)**: 
  - Erkennt und verwirft automatisch Portal-Roots, Sektionsübersichten (`/world`, `/news`, `/politik`, `/esteri`), Tag-Übersichten (`/tag/`, `/thema/`, `/argomenti/`, `/notizie-tema/`) sowie taz-Tagseiten (`/!t...`).
  - Sowohl Gemini-Grounding-URIs als auch Cache-Einträge müssen diesen Test bestehen, damit niemals eine Sammelseite als Artikel verlinkt wird.
- **Dynamischer Live-News-Enricher (`enrichFallbackWithLiveArticles`)**: Wenn eine neue Folge erscheint, fragt der Server in Echtzeit die Google News RSS-Feeds für Deutschland, Italien und Europa ab und übernimmt echte, soeben erschienene Schlagzeilen und direkte Artikellinks.
- **Cache-Invalidierung**: URLs mit Endung `/world`, `/suche/?q=`, `!t5008153` oder Domain-Roots werden als ungültig erkannt und bei Serverstart sowie bei Aufrufen automatisch neu und sauber generiert.

### 3. Benutzerführung & Bereinigung
- **„Rassegna correlata“-Button restlos entfernt**: Aus `FactDetailModal.tsx` wurde der fehlerhafte Button mitsamt allen nicht benötigten Abhängigkeiten gelöscht.
- **Klarer Direktaufruf**:
  - **„Leggi sintesi“**: Öffnet die ausführliche italienische Redaktionssintesi mit Kernpunkten und Podcast-Bezug.
  - **„Apri articolo ↗“**: Öffnet sofort und direkt den eigentlichen Volltext-Originalartikel der jeweiligen Zeitung in einem neuen Browser-Tab.
  - Im Detail-Modal leitet der Hauptbutton *„Apri articolo su [Zeitung] ↗“* verlässlich auf die geprüfte Quelle weiter.
