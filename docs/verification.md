# Implementations- och verifieringsrapport

Datum: 2026-09-25. Status: P0 implementerad och verifierad i nedanstående miljö.

## Leverans

P0-funktionerna i `REQUIREMENTS.md` är implementerade: en svensk, statisk
React/TypeScript-app med meterkarta, strukturformer, växtregister,
planteringar/placeringar, datumvy, journal, lokal IndexedDB, beständig
ångerhistorik, export/import och arbetsytebackup. Ingen backend,
inloggning, telemetri eller Supabase-anslutning krävs eller har lagts till.

Geometriska varningar använder analytiska ellipser, triangulering och
polygonkonturer, inte en samplad ellipsapproximation. Bundna placeringar
följer ytans translation och rotation. Polygonhörn kan dras och redigeras
numeriskt. Fysisk flytt och kombinerad utplantering är atomiska kommandon.

## Miljö och reproduktion

Linux, Node.js 22.14.0, pnpm 10.25.0, Playwright 1.63 och Chromium.
Desktop: 1280 × 800. Mobil: 390 × 844. Headless Chromium använder
CPU-rendering; resultaten är inte en garanti för varje mobil eller GPU.
Tester använder isolerade profiler och syntetiska data, aldrig en befintlig
användarprofil. Omstartstestet stänger hela Chromium och öppnar samma
projektlokala beständiga testprofil igen.

Alla utvecklings-, bygg- och testkommandon använder `scripts/local-tool.mjs`.
Den sätter `TMPDIR`, `TMP`, `TEMP` och XDG-cache till projektets `.cache/`
innan verktygen startas. Browserinstallationen ligger i `.browsers/` och
testprofiler i `test-results/`. Det tidigare hindret med `/tmp` är löst
utan ändrad sandboxprofil. Installera browsern med `pnpm test:install`.

Playwright bygger produktionsfilerna och serverar dem via projektets
statiska testserver med CSP enligt `docs/security.md`. Det testar alltså
inte utvecklingsserverns HMR eller utvecklings-CSS.

## Körda kontroller

| Kommando         | Resultat                                                                  |
| ---------------- | ------------------------------------------------------------------------- |
| `pnpm typecheck` | Godkänt.                                                                  |
| `pnpm lint`      | Godkänt.                                                                  |
| `pnpm test`      | 38 tester i 7 sviter godkända.                                            |
| `pnpm build`     | Godkänt, 1,36 s. JavaScript 430,35 kB och CSS 240,82 kB före gzip.        |
| `pnpm test:e2e`  | 25 browserprov godkända i samma helkörning, 33,4 s inklusive start/bygge. |

## Acceptanstäckning

AT-nummer grupperas i browserresor; antal testfall är därför inte en
ett-till-ett-mappning till kravspecens 25 scenarier.

| Krav            | Verifiering                                                                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AT-01–03        | Skapa/spara/ladda om, beständig profil efter full browseromstart, grupp och inkluderande datumgränser.                                                                                                                                            |
| AT-04–05        | Två grupper efter varandra i samma bädd utan överlappsvarning; befintlig flerårig växt över årsskifte.                                                                                                                                            |
| AT-06–08        | Sådd utan placering, uttrycklig utplantering, kalender, vattning/gödsling och två skördar utan automatiskt slutdatum.                                                                                                                             |
| AT-09–10,15     | Atomisk daterad flytt, polygonhörn med draghandtag, decimaler med komma, bundna koordinater/rotation, zoom och beständig ångra/gör om.                                                                                                            |
| AT-11           | Filväljare och trädgårdskopia med nya ID:n. Repositoryproven verifierar relationer, arkiv, oanvända växter, geometri och datum. Ogiltiga filer lämnar data oförändrad.                                                                            |
| AT-12           | Två riktiga flikar med revisionskonflikt. Kvotfel och abort injiceras efter en skrivning i riktiga IndexedDB-transaktioner; rollback, sparstatus, bevarad inmatning och återförsök kontrolleras.                                                  |
| AT-13,20        | Ren profil utan konfiguration, scripttext körs inte, produktions-CSP utan överträdelser, bara egna statiska resurser och inga utgående dataanrop.                                                                                                 |
| AT-14           | Samma backup i America/Los_Angeles, Pacific/Auckland och Europe/Stockholm; skottdag, sommartidsgräns och exklusivt slutdatum.                                                                                                                     |
| AT-16–18        | Katalogändring bevarar planteringens snapshot, reversibelt växt-/bäddarkiv, läsbar historik och överlapp som varnar utan att blockera sparning.                                                                                                   |
| AT-19           | Offline-redigering, datumbyte, byte mellan journal/karta och export; data kvar efter återanslutning och omladdning.                                                                                                                               |
| AT-21           | Riktig version 1→2-uppgradering, avbruten migrations rollback, blockerande äldre flik, versionchange och okänd nyare version utan databasradering.                                                                                                |
| AT-22,25        | Backup av två trädgårdar, oanvänd växt och inställningar; återställning med bevarade ID:n, separat profil samt separata origins localhost/127.0.0.1. Originalet lämnas oförändrat. Ogiltig/icke-tom återställning provas även i repositorysviten. |
| AT-23           | Beviljat, nekat och saknat Storage API provas med styrda API-svar; UI visar respektive status.                                                                                                                                                    |
| AT-24           | Gemensamt repositorykontrakt mot IndexedDB och fristående minnesadapter: rollback, konflikt, retry utan dubbletter, export/import och kommandon. Testing Library kör appflöde med injicerad adapter.                                              |
| UX-04           | Mobil karta, datum och journal utan horisontell överströmning. Skärmbilder vid 390 px och desktopkarta vid 1280 × 800 har granskats visuellt.                                                                                                     |
| Osparat/avbrott | Avvisad navigering via länk och webbläsarens bakåtknapp behåller formulärutkast. Escape avbryter polygonritning utan sparning.                                                                                                                    |

Fel- och migrationsprov använder uttrycklig felinjektion eller förberedda
schemafixtures. Dessa är inte påståenden om att en fysisk disk faktiskt blev
full. Ordinarie resor skapar och ändrar data genom UI och riktig IndexedDB.

## Uppmätt prestanda

Fixture: 100 strukturobjekt, 1 000 planteringar, 1 000 placeringar,
2 000 journalhändelser och 3 basposter, totalt 4 103 domänposter.

Den slutliga helkörningen efter kartoptimeringen mätte:

- Första kartvy efter omladdning: **308 ms**, under målet 3 000 ms.
- Datumbyte: **320 ms**; panorering: **626 ms**; dragning inklusive sparning:
  **503 ms**. Dessa tider inkluderar Playwrights interaktion och väntan på UI.
- Pointer-event till två animationsramar: **42–85 ms** i CPU-renderingen.
  Detta är ett responsmått, inte ett löfte om 60 bilder/s eller direkt mätning
  av skärmens fysiska presentation.
- Separat Jest-körning: domänvalidering **30,5 ms** och datum-/varningslogik
  **6,2 ms**. Dessa är inte browserns renderings- eller laddningstid.

Browserprovet gör en assertion på första kartvy <3 s och skriver faktiska
resultat samt en JSON-bilaga till Playwrightrapporten vid varje körning.
Mätvärden varierar med maskinens belastning.

## Rättning 2026-09-26: planteringsflödet

Kartans lokala ritutkast rensades vid mouseup utan att det väntande
placeringsutkastet visades. Ett öppet egenskapsformulär kunde dessutom
ligga framför placeringsformuläret. Den osparade ytan visas nu tills den
sparas eller avbryts, placeringsformuläret får fokus och saknad växt ger
en direkt instruktion. Verktygsbyte skyddar osparade formulär och en vald
växt förväljs när Plantera öppnas. Två nya browserprov täcker dragning,
öppet egenskapsformulär, sparning/omladdning och saknad växt/avbrott.
Helkörningen efter rättningen gav 38 godkända Jest-tester och 27 godkända
browserprov. Typkontroll och lint passerade också.

## Utökning 2026-09-26: kartverktyg och utseende

Välj och Flytta är separata lägen. Välj ändrar aldrig geometri vid dragning;
Flytta sparar dragningen och stöder ångra. Storleksändring och polygonhörn
har egna redigeringslägen. Färger och tio lokalt tecknade SVG-växtikoner
kan väljas i egenskaperna. Nya planteringar använder växtens snapshot;
befintliga planteringar kan få egna utseendevärden utan att ändra snapshot.

Slutkörning: 46 Jest-tester i 8 sviter och 30 Playwright-tester godkända.
Typkontroll, lint och produktionsbygge godkända. Browserproven täcker bland
annat separata välj/flytta-lägen, färger, tio tillgängliga ikoner, bevarad
snapshot, egen planteringsikon, omladdning och export/import. Ikonväljaren
och kartverktygen är även visuellt granskade.

## Utökning 2026-09-26: lager, gångar och växtnamn

Kartan ritar struktur först, gångar därpå och växter överst. Växtnamn ligger
i ett separat textlager och visas även för ikonförsedda växter. Gångverktyget
skapar en redigerbar, roterad rektangel längs en dragen mittlinje med vald
gångbredd; befintliga odlingsland ändras inte.

48 Jest-tester och 31 browserprov godkända, liksom typkontroll, lint och
produktionsbygge. Det nya UI-provet kontrollerar lagerordning oberoende av
skapandeordning, ikon och synligt namn, diagonal gång med rätt bredd,
oförändrat land, ångra/gör om och omladdning. Resultatet har granskats visuellt.

## Utökning: kantsnäppning i Flytta

Separat, beständigt val för snäppning mot synliga figurers yttergränser.
Tröskeln är åtta skärmpixlar; kantsnäppning har företräde framför rutnätet.
Det flyttade objektet och dess bundna placeringar undantas som snäppmål.
Hjälplinjer visar matchningen. Roterade/böjda former använder omslutande
gränser i kartans X-/Y-led, inte konturföljning längs sneda eller krökta kanter.

Verifierat med 74 Jest-tester och 34 browserprov, typkontroll, lint och
produktionsbygge. Enhetsprov omfattar även 33 cm-kvadrater. UI-provet flyttar
3,3 m-kvadrater kant i kant utanför 10 cm-rutnätet och kontrollerar exakta
koordinater, hjälplinjer, ångra/gör om och beständiga inställningar.
Resultatet har granskats visuellt.

## Utökning: Markera många och atomisk gruppflytt

Flytta-läget har flerval med klick och markeringsruta. Alla markerade,
olåsta objekt flyttas med samma vektor och gruppens yttergränser används
för snäppning. Bundna placeringar dubbelöversätts inte när deras bädd ingår.
Gruppflytten är ett enda transaktions-/ångerkommando. Sparfel behåller ett
återförsöksunderlag och skriver inga deländringar.

78 Jest-tester och 36 browserprov godkända; typkontroll, lint och bygge
godkända. Testerna täcker flerval, avmarkering, markeringsruta, låsta objekt,
Escape, samma förflyttning för flera objekt, roterad bindning, atomisk
rollback vid injicerat fel efter första skrivningen, återförsök, ångra/gör
om och omladdning. Gruppflytten har också granskats visuellt.

## Ändring: polygonverktyget borttaget

Efter nytt användarbeslut ersätts det ursprungliga kravet på polygonritning
och hörnredigering. Verktyget, hörnhandtagen och hörnfälten är borttagna;
nya former är rektanglar och ellipser. Äldre polygondata bevaras för visning,
flytt, skalning och export/import utan automatisk formkonvertering.

Regressionstester kontrollerar att polygon inte kan väljas som ny form,
att äldre geometri sparas oförändrad och att explicit byte till rektangel
fungerar. Escape-testet avbryter nu en pågående rektangelritning.

81 Jest-tester och 37 webbläsartester godkända. Typkontroll, lint och
produktionsbygge godkända. Verktygen använder projektlokal cache, inte /tmp.

## Utökning: blandade planteringar

Plantera kan skapa en gemensam placering för flera arter, med eget namn,
gemensamt totalantal och gemensamma datum. Den första artens gamla
plantId/snapshot bevaras; ytterligare arter lagras som validerade,
frysta katalogögonblicksbilder. Befintliga planteringar behöver ingen migrering.
Extra arter kan läggas till och tas bort i planteringsformuläret.
Kartan visar blandningens namn och artlista, och sökning samt journalens
växtfilter omfattar alla ingående arter.

Domän- och lagringstester täcker felaktiga/dubbla arter, frysta växtuppgifter,
ångra/gör om, arbetsytebackup och ommappning av ID:n vid trädgårdsimport.
Webbläsartestet skapar en blomsteräng, verifierar kravet på minst två arter,
redigerar innehållet, laddar om och filtrerar journalen per ingående art.

83 Jest-tester och 38 webbläsartester godkända; typkontroll, lint och
produktionsbygge godkända. Blandningens namn och artlista har granskats
visuellt. Ändringar av planteringar ingår nu i kartans ångrahistorik.

Rättning: blandningar kan väljas enbart med kryssrutorna, utan en växt i
rullistan. Båda urvalen slås ihop utan dubbletter före validering och sparning.
Ett separat webbläsartest verifierar tom rullista, för få valda arter,
bevarat utkast, lyckad sparning med två arter och omladdning.
Efter rättningen: 83 enhetstester och 39 webbläsartester godkända, liksom
typkontroll, lint och produktionsbygge.

## Utökning: utspridda ikoner i blandningar

Blandningars artikoner upprepas i separerade celler över hela ytan med små,
deterministiska förskjutningar. Arterna varvas även mellan raderna.
Ikonernas hela rutor måste rymmas inom formen; ellipser och äldre polygoner
kontrolleras geometriskt. Mönstret följer flytt, rotation och storleksändring
och ändras inte av panorering, zoom eller omladdning. Det är en illustration,
inte en exakt avbildning av det registrerade antalet plantor.

Tester täcker spridning, flera arter, frånvaro av överlapp, formgränser,
smala och stora ytor samt arter utan ikon. Blomsterängens webbläsartest
kontrollerar flera ikoner per art och oförändrat mönster efter omladdning.
86 enhetstester och 39 webbläsartester godkända, liksom typkontroll, lint
och produktionsbygge. Spridningen har också granskats visuellt.

## Utökning: fyra nya växtikoner

Lobelia, Ringblomma, Aubrietia och Borstnejlika har egna lokala SVG-illustrationer
i den befintliga stilen. Väljaren innehåller nu 23 ikoner. De nya ID:na täcks
av ikonernas parameteriserade renderings- och valideringstester. Ett nytt
webbläsartest väljer alla fyra, skapar en blandad plantering, kontrollerar
exporterade ögonblicksbilder och laddar om kartan.
90 enhetstester godkända. De 39 befintliga webbläsartesterna går igenom;
det nya ikonprovet går igenom efter att testet rättats att invänta sparningen.
Typkontroll, lint och produktionsbygge godkända. Ikonväljaren är visuellt granskad.

## Utökning: valfri namnetikett på kartan

Ytor, enskilda placeringar och hela planteringar har inställningen
”Visa namn på trädgårdsvyn”. Den är aktiv för befintliga och nya poster om
fältet saknas. En avstängd plantering döljer alla sina placeringars etiketter;
en avstängd placering döljer endast den placeringen. Namn och sökbarhet i
övriga gränssnitt påverkas inte.

Domän-, formulär- och webbläsartester verifierar typvalidering, standardvärde,
beständig lagring, omladdning, export och ångra/gör om för alla tre nivåerna.

## Utökning: krockmedvetna kartetiketter

Alla synliga namn går genom en gemensam etikettlayout. Överlappande etiketter
reduceras till en etikett per krockgrupp, i stället för att ritas ovanpå
varandra. Textstorleken är samma som före krockhanteringen; etiketter visas
så länge de inte kolliderar. Växter har högre grundprioritet än land och gångar.
SVG-titeln innehåller hela namnet för muspekartips när namnvisning är aktiv.
Vid inzoomning bevaras alla redan synliga etiketter, även efter efterföljande
React-renderingar. Nya etiketter läggs till när deras yta får plats; utzoomning
får däremot räkna om layouten och minska mängden text.

Enhetstester täcker krockar, avstånd, lagerprioritet och beständig etikettlayout
vid oförändrad eller högre zoom. Webbläsartester täcker både att en liten
plantering får sitt namn först när utrymme uppstår och att tidigare etiketter
ligger kvar genom hela inzoomningen. Kartvyn har granskats visuellt med
överlappande land, gång och plantering.
96 enhetstester och 42 webbläsartester godkända. Typkontroll, lint och
produktionsbygge godkända.

## Drift och övriga avgränsningar

Ingen publicering har utförts. Hostingens verkliga HTTPS/CSP-headers ska
kontrolleras vid driftsättning. Firefox, Safari och fysiska mobiler ingick
inte i denna verifieringsmiljö. P1 såsom garanterad offline-start/PWA,
molnsynk, foton och avancerad mobil polygonredigering ingår inte.
Data är fortfarande enbart lokal för aktuell profil och origin; backup
behöver sparas utanför webbläsaren.
