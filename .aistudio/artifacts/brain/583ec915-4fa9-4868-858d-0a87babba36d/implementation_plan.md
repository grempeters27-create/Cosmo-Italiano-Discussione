# Inhaltsvalidierung von Einzelartikeln & Paywall-freie Kulturquellen

Beseitigt verbliebene Portalseiten (wie */stage/comedy*) und Paywalls bei den «Apri articolo»-Links im Dossier. Das System prüft nun serverseitig nicht nur die HTTP-Erreichbarkeit, sondern analysiert den tatsächlichen Seiteninhalt (Artikel-Struktur vs. Übersichts-Portal) und weicht bei Bedarf auf frei zugängliche Kulturmagazine, Rundfunkanstalten und europäische Kulturportale aus.

---

## User Review & Bestätigte Entscheidungen

> [!IMPORTANT]
> Basierend auf deiner Rückmeldung wurden folgende Richtungsentscheidungen festgelegt:

- **Echte Textprüfung statt reiner Link-Erreichbarkeit**: Der Link-Resolver prüft nun, ob die Zielseite tatsächlich einen zusammenhängenden Volltext-Artikel enthält (`og:type="article"`, `<article>`-Tag, redaktionelle Absätze) oder lediglich eine Portalseite mit Themen-Kacheln und Übersichten darstellt (wie z. B. */stage/comedy* auf The Guardian). Portale werden strikt verworfen.
- **Freie, qualitativ hochwertige Quellen ohne Paywall**: Um Paywalls (*Spiegel+*, *Guardian Supporter*, etc.) zu vermeiden, sucht das System gezielt nach frei lesbaren Volltexten aus renommierten Kulturmagazinen, Rundfunkanstalten und europäischen Kulturportalen (z. B. *Exberliner*, *The Local*, *Euronews Culture*, *DW Culture*, *Berlino Magazine*, *Rai Cultura*). Private User-Blogs ohne redaktionellen Standard sind ausgeschlossen.
- **Transparente Benennung der Quelle**: Auf der Dossier-Karte wird stets der exakte Name des tatsächlichen Mediums oder Kulturportals angezeigt (z. B. *Exberliner Culture*, *Euronews*, *WDR COSMO*).

---

## 1. Übersicht & Architektur des Inhalts-Prüfers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            LINK-REVOLUTION FLOW                             │
│       Nutzer klickt auf «Apri articolo» oder Dossier wird generiert         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SCHRITT 1: URL-Strukturfilter                           │
│  Ausschluss von:                                                            │
│  - /stage/comedy, /culture/comedy, /world, /news, /entertainment            │
│  - /category/..., /themen/..., /tag/..., /suche/?...                        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 SCHRITT 2: Live-Inhaltsanalyse (Server-Check)               │
│  1. Schneller HTML-Head/Range-Abruf:                                        │
│     - Prüft <meta property="og:type" content="article">                     │
│     - Prüft Vorhandensein von <article>, Autorenzeile oder Datum           │
│     - Verwirft Seiten mit og:type="website" oder reinen Linksammlungen      │
│  2. Paywall-Erkennung:                                                      │
│     - Ausschluss von Seiten mit harten Bezahlschranken                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│         SCHRITT 3: Freie Alternativ-Quelle (falls Portal/Paywall)           │
│  - Suche nach frei zugänglichen Kulturbeiträgen zum Thema                    │
│  - Priorisierte Quellengruppen:                                             │
│    * Kulturmagazine: Exberliner, Tip Berlin, Choices, Berlino Magazine     │
│    * Rundfunkportale: WDR COSMO, DW Culture, Rai Cultura, BBC Culture      │
│    * Europäische Fachportale: Euronews Culture, The Local Europe            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ERGEBNIS: Echter Volltext-Artikel                       │
│  - Nutzer landet direkt auf dem lesbaren Artikel (kein Portal, keine Suche) │
│  - Karte zeigt den exakten Namen des freien Mediums                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Konkrete Anpassungen für die aktuelle Folge & das Gesamtsystem

### 1. Korrektur der aktuellen Folge (*Matilde Keizer*):
- **Stampa Europea (Karte 3)**: Ersetzung der Portalseite `theguardian.com/stage/comedy` durch einen verifizierten, frei lesbaren englischsprachigen Kulturartikel über die Berliner Stand-up-Comedy-Szene und bilinguale Satire aus einem angesehenen englischsprachigen Kulturmagazin (*Exberliner Culture* / *The Local Germany*).
- **Stampa Tedesca (Karte 1)**: WDR COSMO Original-Artikel (`https://www1.wdr.de/radio/cosmo/sprachen/italiano/cultura/matilde-keizer-italiana-che-fa-ridere-germania-100.html`) – 100 % freier Volltext ohne Paywall.
- **Stampa Italiana (Karte 2)**: Corriere della Sera / Berlino Magazine Bericht über die Expansion italienischer Comedians in Deutschland – frei lesbar.

### 2. Erweiterung der Portalseiten-Heuristik in `server.ts`:
- Ergänzung der Filterliste um Sektions- und Sparten-Pfade wie `/stage/`, `/comedy`, `/section/`, `/rubrik/`, `/channel/`, `/entertainment/`, `/kultur/` (wenn ohne konkreten Artikel-Slug).
- Einführung der Funktion `validateIsArticleContent(html)`:
  - Bestätigung, dass die Seite mindestens einen redaktionellen Fließtext enthält.
  - Erkennung von `og:type="article"` vs. `og:type="website"`.
  - Abgleich gegen typische Paywall-Klassen/Texte.

### 3. Erweiterung des Quellen-Pools für freie Artikel:
- Wenn ein bürgerliches Hauptblatt (z. B. Spiegel oder Guardian) den Inhalt hinter einer Paywall sperrt oder nur eine Kategorieseite anbietet, greift der Resolver auf renommierte Kultur- und Rundfunkportale zurück:
  - *Deutschland/International*: *Exberliner*, *Tip Berlin*, *Deutsche Welle (DW)*, *WDR*, *Deutschlandfunk Kultur*.
  - *Italien*: *Il Post*, *Rai Cultura*, *Berlino Magazine*, *ANSA*.
  - *Europa*: *Euronews Culture*, *The Local*, *Euractiv*.
- Die Quellenbezeichnung auf der Dossier-Karte synchronisiert sich automatisch auf den exakten Namen des Mediums.

---

## 3. Test- & Validierungsstrategie
1. **Verifizierung der aktuellen Folge**:
   - Prüfung aller 3 Karten im Dossier von *«Matilde Keizer»*.
   - Klick auf *Apri articolo* bei Karte 3 ➔ Bestätigung, dass ein echter, frei lesbarer Artikel geöffnet wird und **keine** Guardian-Kategorieseite mehr erscheint.
2. **Automatisierte Validierung**:
   - Skriptbasierte Prüfung der HTTP-Antworten und HTML-Meta-Tags für alle aufgelösten URLs.
3. **Build & Linter**:
   - Ausführung von `tsc --noEmit` und `compile_applet`.
