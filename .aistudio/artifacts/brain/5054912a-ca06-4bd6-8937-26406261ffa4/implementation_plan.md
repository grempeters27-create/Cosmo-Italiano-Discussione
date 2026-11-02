# On-Demand Generierung der Fakten-Karten & Bereinigung (Abgeschlossen)

Alle Anforderungen wurden erfolgreich umgesetzt und getestet:

1. **On-Demand-Erstellung bei Themenwechsel («Carica nel Dossier»)**:
   - Sobald der Nutzer im Archiv eine Episode auswählt oder auf «Carica nel Dossier» klickt, werden vorherige Fakten-Karten sofort aus der Ansicht entfernt (`setAnalysis(null)`).
   - Ein eleganter dreiteiliger Ladezustand visualisiert die laufende thematische Recherche und das Fact-Checking.
   - Die Anfrage an `/api/episodes/analyze` wird mit `force: true` gesendet, sodass der alte Cache umgangen wird und zu **jedem ausgewählten Thema** exakt 3 spezifische Fakten-Karten mit relevanten Institutionen (z. B. Generalbundesanwalt, Accademia della Crusca, Camera dei Deputati, Deutsches Studierendenwerk etc.) neu generiert und im 3er-Raster dargestellt werden.

2. **Entfernung überflüssiger Buttons**:
   - Der Button oben rechts in der Kopfzeile (`Navbar.tsx`) wurde in der Dossier-Ansicht vollständig entfernt.
   - Im Dossier verbleibt ausschließlich die dezente, schwebende Aktionsleiste am unteren Bildschirmrand zum Starten des Gesprächs mit Silvia da Firenze.
