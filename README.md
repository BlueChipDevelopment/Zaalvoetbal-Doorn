# Zaalvoetbal Doorn - Team Generator

## Getting Started

### Installatie

1. Clone deze repository:
   ```sh
   git clone https://github.com/bluechipdevelopment/zaalvoetbal-doorn.git
   cd zaalvoetbal-doorn
   ```
2. Installeer de dependencies:
   ```sh
   npm install
   ```

### Lokaal draaien

Start de ontwikkelserver:
```sh
npm start
```
Of:
```sh
ng serve
```
De app is nu bereikbaar op http://localhost:4200

### Deployment (GitHub Pages)

1. Build de productieversie:
   ```sh
   ng build --configuration production
   ```
2. Deploy naar GitHub Pages:
   ```sh
   ng deploy
   ```

Voor een custom domein: zorg dat het CNAME-bestand in de build zit en de DNS correct is ingesteld.

## Over Zaalvoetbal Doorn

Zaalvoetbal Doorn is een zaalvoetbalcompetitie voor iedereen die van voetballen houdt en in de regio Doorn woont of werkt. Onze competitie staat bekend om zijn gezelligheid, sportiviteit en spannende wedstrijden. Of je nu een fanatieke voetballer bent of af en toe een balletje wilt trappen, bij Zaalvoetbal Doorn ben je aan het juiste adres!

## Functionele features

- Automatisch gebalanceerde zaalvoetbalteams genereren op basis van spelersnamen, posities en ratings
- Handmatig of willekeurig teams samenstellen, met optimale verdeling van keepers en veldspelers
- Bijhouden van aanwezigheid van spelers voor wedstrijden
- Uitgebreide statistieken per speler: aantal gespeelde wedstrijden, overwinningen, verlies, gelijke spelen, punten, zlatan- en ventielpunten, winratio, en rating
- Ranglijst (klassement) van alle spelers op basis van prestaties en punten
- Inzicht in teamchemie: beste en slechtste teamgenoten per speler
- Overzicht van de laatste vijf wedstrijden per speler
- Inzien van aankomende wedstrijden en teamopstellingen

## Technische features

- Responsive design, geschikt voor mobiel en desktop
- Integratie met Google Sheets voor het ophalen en bijwerken van spelers- en wedstrijddata
- SEO-vriendelijke meta-data en social sharing tags
- Gebruik van Angular Material voor een moderne, toegankelijke gebruikersinterface