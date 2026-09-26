# REQUIREMENTS.md — Odlingskartan

Version: 0.3 — faktisk odlingshistorik och lokal webbläsarlagring  
Datum: 2026-09-25  
Arbetsnamn: Odlingskartan. Namnet är inte ett beslutat produktnamn.

## 1. Produktmål

Bygg en open source-webbapp där en privat odlare kan rita sin trädgård i två
dimensioner, placera ut buskar, träd, andra växter och odlingsytor, samt
dokumentera odlingen över tid med datum.

**Kartan är huvudgränssnittet.** Produkten ska inte i första hand vara ett
register med en dekorativ kartvy. Det centrala arbetsflödet är:

> Rita trädgården → skapa eller välj en växt → registrera en plantering →
> ange odlingsdatum → välj datum i kartan → registrera vad som faktiskt händer.

En ny användare ska kunna skapa sin första användbara odlingskarta utan att
ansluta någon extern tjänst eller först fylla i en omfattande växtdatabas.

## 2. Beslut, antaganden och avgränsningar

Användarens uttryckliga önskemål är open source, webbgränssnitt, ritning av
trädgård och odlingsland, placering av växter inklusive buskar samt såddatum och
annan odlingsinformation. Följande teknik- och lagringsbeslut är nu också givna:

**BESLUT-01:** Grundläggande teknikval ska följa referensprojektet
`Norberg/molecule-lab-book`. Den granskade teknikbasen och projektspecifika
tillägg finns i avsnitt 12. Kopiera inte laboratoriedomänen eller externa
integrationer som inte behövs för Odlingskartan.

**BESLUT-02:** All användardata ska i första versionen sparas lokalt i
webbläsaren. Ingen applikationsserver, serverdatabas, inloggning eller
molntjänst får behövas för odlingsfunktionerna. Beständig lagring ska
implementeras med IndexedDB, inte enbart React-state eller en in-memory-mock.

**BESLUT-03:** Arkitekturen ska förberedas för framtida Supabase-lagring,
men själva integrationen, autentisering och synk mellan enheter ska inte
implementeras nu. P0 omfattar lagringsgränssnitt, portabla data och en
migrationsplan, inte en halvfärdig synkmotor.

**BESLUT-04:** P0 hanterar endast registrerade, faktiska planteringar,
placeringar och journalhändelser. Planerade lager, planerade uppgifter och
bekräftelseflöden mellan plan och utfall ingår inte. Kartan visar hur
trädgården såg ut eller ser ut på valt datum, inklusive faktisk historik.

**BESLUT-05:** Arkivering är alltid reversibel. Domänposter ska inte kunna
permanentraderas i P0. En arkiverad post ska kunna återställas och dess
historik och relationer ska bevaras. Arkiverade poster är dolda som standard
och visas samt återställs via ett filter.

**BESLUT-06:** Kalenderdatum får ligga i dåtid, nutid eller framtid. Ett datum
i framtiden är inte i sig en planerad post; samma modell används för alla
registrerade data.

Dessa beslut ersätter version 0.1:s förslag om Fastify, SQLite,
ägarkonto, serverlagring och obligatorisk servercontainer. Övriga
produktfunktioner och domänregler gäller fortfarande.

| Område | Beslut eller föreslaget standardval |
|---|---|
| Användning | En lokal arbetsyta per webbläsarprofil och origin; flera trädgårdar. Inget konto i P0. |
| Teknikbas | React, TypeScript, Vite, pnpm, Bootstrap, React Router, TanStack Query, React Icons och Jest enligt avsnitt 12. |
| Lagring | IndexedDB lokalt. Supabase är en senare, uttryckligen aktiverad integration. |
| Drift | Statisk webbapp; valfri statisk hosting eller lokal webbserver. Node.js behövs för utveckling/bygge, inte som odlingsbackend. |
| Språk | Svenskt gränssnitt. Engelska identifierare och kodkommentarer. |
| Mått | Meter i geometrimodellen; meter och centimeter i gränssnittet. |
| Datum | Odlingsdatum är kalenderdatum. Europe/Stockholm är förvald tidszon för ”idag”. |
| Plattform | Dator för full ritfunktion. Mobil för visning, datumval och journal. |
| Licens | MIT föreslås för ett nytt, tomt repo. Befintlig licens får inte ändras automatiskt. |
| Externa tjänster | Inga obligatoriska molntjänster, API-nycklar, kartleverantörer eller AI-tjänster. |

All data i denna version tillhör den aktuella webbläsarens lokala arbetsyta.
Mobilen får inte automatiskt datorns data. Överföring mellan webbläsare
sker tills vidare med export och import. En statisk webbserver levererar
programfiler, men tar inte emot eller lagrar användarens odlingsdata.

Bygg inte fleranvändarstöd, abonnemang, betalning, sociala funktioner,
3D-visualisering, vädersystem eller automatiska odlingsråd i första versionen.
Publicering av repo eller driftsättning på internet ingår inte automatiskt i
utvecklingsuppdraget. Referensrepot ska inte ändras genom detta uppdrag.

## 3. Prioritering

**P0** betyder att kravet ingår i den första kompletta, användbara versionen.
**P1** betyder en uttryckligen senare förbättring. **P2** är möjliga framtida
funktioner utan implementationsuppdrag.

Alla funktionella krav i avsnitt 4–12 är P0 om inte annat anges. Etapp 1 är
avsiktligt mindre än hela P0 och definieras i avsnitt 15.

En fungerande, sparad användarresa har högre prioritet än många halvfärdiga
funktioner. Exempeldata får användas för demonstration, men inte ersätta verklig
lagring eller dölja funktioner som ännu inte är implementerade.

## 4. Gränssnitt och huvudsaklig användarresa

### UX-01 — Kartan först

När appen öppnas visas den senast öppnade lokala trädgården, eller ett tydligt val att
skapa en trädgård. På dator består arbetsytan av en stor karta i mitten,
ritverktyg och objektlista till vänster, egenskapspanel till höger och datumval
med tidsreglage längst ned. Trädgårdsnamn, sparstatus och Ångra/Gör om ska vara
lätta att hitta.

Kartytan ska få huvuddelen av det tillgängliga utrymmet. Undvik en startsida med
statistikkort som användaren måste passera för att komma till själva arbetet.

### UX-02 — Direkt redigering

Klick på ett objekt markerar det och öppnar rätt egenskaper. Användaren ska
kunna ändra namn, mått, placering och relevanta odlingsdatum utan att lämna
kartan. Det ska finnas begripliga tomlägen och valideringsfel på svenska.

### UX-03 — Alternativ till pekdon

Objekt ska även kunna väljas via en sökbar lista. Position, storlek, rotation och
datum ska kunna ändras i formulär. Knappar och fält ska ha tillgängliga namn,
synlig tangentbordsfokus och fungerande tangentbordsnavigering.
Status får inte kommuniceras enbart genom färg.

### UX-04 — Mobilens omfattning

Vid cirka 390 pixlars skärmbredd ska det gå att se och navigera i kartan, välja
datum, öppna växtinformation och registrera journalhändelser. Avancerad
polygonredigering på mobil är P1. Desktopflödet ska fungera vid 1280 × 800.

## 5. Trädgård och ritverktyg

### MAP-01 — Trädgård

Användaren ska kunna skapa, namnge, öppna, arkivera och återställa trädgårdar.
Arkiverade trädgårdar är dolda som standard och visas via ett filter. En
trädgård har måttsatt arbetsyta och valfria anteckningar. Den får inte vara låst till ett
årtal, ett rutnät eller en enda odlingsbädd.

### MAP-02 — Objekt och former

Ritverktyget ska stödja rektangel, cirkel/ellips och sluten polygon.
Polygonen ska kunna justeras genom att flytta, lägga till och ta bort hörn.
Självkorsande polygoner och former utan positiv area ska avvisas med ett
begripligt fel.

Objektkategorier ska minst vara tomtgräns, odlingsland, pallkrage, växthus,
gång, byggnad och generisk yta. Buskar, träd och andra levande växter ska
representeras som planteringar enligt avsnitt 7, inte enbart som dekorativa
ikoner utan odlingsinformation.

### MAP-03 — Koordinater och mått

Geometrin ska lagras i trädgårdens koordinatsystem i meter, inte i bildskärmens
pixlar. Zoom, webbläsarstorlek och hög pixeltäthet får inte ändra verkliga mått.
En cirkel med diameter två meter ska ha samma skala som en bädd som är två
meter bred. Svensk decimalinmatning med komma ska fungera.

Koordinattransformationer ska vara separerade från renderingskod och testbara
utan webbläsare. Det ska finnas skalindikator och valbart rutnät med av/på för
snäppning.

### MAP-04 — Redigering

Användaren ska kunna panorera och zooma, markera objekt, flytta, rotera,
ändra storlek, duplicera och arkivera. Numeriska mått ska kunna anges.
Escape avbryter pågående ritning eller dragning. Kortkommandon får inte
utlösas när användaren skriver i ett textfält.

En dragning som avslutas är en redigeringsoperation; inte en operation per
musförflyttning. Dubblering av en bädd skapar en tom bädd som standard.
Kopiering av en hel trädgårdsritning är P1.

### MAP-05 — Lager och låsning

Det ska gå att visa eller dölja struktur och registrerade planteringar. Ett
objekt ska kunna låsas så att det inte flyttas
av misstag. Låsning får inte hindra att objektets information läses.
Att dölja strukturlagret får inte automatiskt dölja planteringslagret.

### MAP-06 — Ångra och gör om

Minst de senaste 20 kartoperationerna per trädgård ska kunna ångras och göras
om, även efter omladdning eller normal omstart av webbläsaren i samma profil
och origin. Detta gäller skapande, flytt, rotation, storleksändring och
arkivering. Själva ånger-/gör-om-historiken och dess resultat ska sparas
korrekt i IndexedDB. Journalredigering behöver inte ingå i samma
ångerhistorik.

### MAP-07 — Yta och planteringar hör ihop

En placering kan vara bunden till valfritt strukturobjekt eller ligga fritt i
trädgården. Alla objektkategorier i MAP-02 får användas som sådan odlingsyta.
Vid ritkorrigering av en bädds läge eller rotation ska bundna placeringar
följa med utan att ändra interna avstånd. Storleksändring får inte automatiskt
skala plantor eller deras inbördes avstånd. Visa en varning om de då hamnar
utanför bädden.

Implementationen får välja lokal geometri relativt en bädd eller motsvarande
transformationsmodell, men resultatet ska uppfylla dessa beteenden.

**Avgränsning:** En ritkorrigering av en bädd ändrar baskartan för alla datum.
V1 lagrar inte full tidsversionering av strukturernas geometri. En fysisk
ombyggnad ska kunna dokumenteras genom att avsluta ett objekt och skapa ett
nytt. En växts flytt mellan platser hanteras däremot med daterade placeringar.

### MAP-08 — Livslängd för strukturer

Strukturobjekt får ha valfritt anläggningsdatum och sista visningsdatum.
Utan datum visas de på alla datum. Ett objekt med kopplad odlingshistorik får
inte raderas med tyst kaskadradering av planteringar eller händelser.
Arkivering ska erbjudas i stället. Planteringar med aktiva perioder får inte
tyst försvinna för att den kopplade ytans egen period har avslutats; visa i
stället en varning om den inkonsekventa historiken.

## 6. Eget växtregister

### PLANT-01 — Användaren äger katalogen

Det ska gå att skapa, söka, redigera, arkivera och återställa egna växtposter.
Växtnamn är obligatoriskt. Alla odlingsuppgifter utöver namn ska kunna lämnas
tomma. Växter som saknas i en medföljande katalog får aldrig vara blockerade.

### PLANT-02 — Fält

En växtpost ska kunna innehålla svenskt namn, vetenskapligt namn, sortnamn,
kategori, ettårig/tvåårig/flerårig, valfri växtfamilj samt egna anteckningar.

Odlingsfält ska omfatta såmetod, sådjup, plantavstånd, radavstånd,
ungefärlig höjd och bredd, ljusbehov, jord-/vattenanteckningar, intervall för
groningstid och intervall för dagar till skörd. Tidsintervall ska ha en explicit
utgångspunkt, exempelvis sådd eller utplantering. Okänt värde är tomt, inte noll.

### PLANT-03 — Katalog är inte fysisk planta

En växtpost beskriver en växt eller sort. En plantering beskriver ett visst
exemplar eller en viss odlingsomgång. Samma växtpost ska kunna användas i flera
bäddar och flera år utan att deras datum och journaler blandas samman.

Planteringen ska behålla en ögonblicksbild av namn, sort och de katalogvärden
som hör till dess dokumentation. Senare katalogändringar får inte i tysthet
ändra äldre odlingshistorik eller redan valda datum.

### PLANT-04 — Inga påhittade odlingsfakta

Appen ska fungera med en tom katalog. Medföljande demonstrationsdata ska
märkas som exempel och får ha tomma odlingsvärden. Importerade eller
förifyllda faktauppgifter ska ha källa och eventuell regional kontext.
Bygg ingen funktion som presenterar AI-genererade odlingsråd som verifierade.

## 7. Planteringar och placeringar

### GROW-01 — Individ eller grupp

Användaren ska kunna placera en enskild planta eller en sammanhållen grupp
av samma växt, med angivet antal. Visningen ska stödja punkt med utbredningsyta
för en individ och rektangulär eller polygonal odlingsyta för en grupp.
En grupp är ett redigerbart objekt; varje frö behöver inte få en egen post.

### GROW-02 — Skapa och flytta

En plantering ska kunna skapas genom växtval och klick/dragning på kartan.
Den ska kunna flyttas både visuellt och genom numeriska koordinater.
Buskar och träd ska kunna placeras fritt, utan krav på att ligga i ett land.

Varje plantering har eget ID, växtreferens, beskrivande namn, antal,
anteckningar och kopplade placeringar och journalhändelser. Antal ska vara ett
positivt heltal. Visuell utbredning är ett användarstyrt kartmått,
inte en biologisk tillväxt- eller skuggmodell.

### GROW-03 — Återanvänd ytor

Samma land, eller samma del av ett land, ska kunna innehålla olika odlingsomgångar
vid olika datum. En plantering får ha flera efterföljande placeringar, till
exempel efter en omplantering. Om en grupp delas i flera fysiska grupper kan
användaren i v1 skapa separata planteringar; automatisk uppdelning är P1.

### GROW-04 — Överlapp

Överlapp mellan olika planteringar ska tillåtas eftersom användaren kan vilja
samodla. En enkel geometrisk varning ska visas när deras utbredningsytor har
faktisk gemensam area och placeringsperioderna överlappar. Enbart tangering av
konturer är inte överlapp. Varningen får inte blockera sparande eller påstå
att växterna är biologiskt inkompatibla.

Varna även för placering utanför ett kopplat strukturobjekt.

### GROW-05 — Befintliga fleråriga växter

En redan befintlig buske eller ett träd ska kunna registreras utan att
användaren hittar på ett planteringsdatum. Användaren ska uttryckligen kunna
välja ”Befintlig växt – startdatum okänt”. Växten visas då även vid årsskifte,
med uppgift om att etableringsdatum saknas. Den ska inte kopieras till en
ny fysisk individ bara för att användaren väljer nästa år.

## 8. Datum, kartans tidslinje och historik

### TIME-01 — Kalenderdatum, inte tidpunkter

Sådd, plantering, skörd och kartans placeringsperioder ska använda datum i
formatet YYYY-MM-DD i data och lagringsgränssnitt. Tidszonsskifte eller sommartid får inte
flytta dessa datum. Tekniska createdAt/updatedAt får däremot vara UTC-tidpunkter.

### TIME-02 — Entydiga placeringsperioder

Internt används startdatum inklusive och slutdatum exklusive:
`startDate <= valtDatum < endDate`. Saknat slutdatum betyder tills vidare.
I användargränssnittet anges ”Visas från” och ”Sista dagen på platsen”.
Det senare konverteras till exklusivt slutdatum genom kalenderaddition av en
dag, inte genom att addera ett fast antal millisekunder.

En odling som har sista dag 30 juni ska alltså inte visas 1 juli.
En fysisk flytt den 1 juli avslutar föregående placering med exklusivt
slutdatum 1 juli och börjar nästa placering samma datum.

### TIME-03 — Faktisk placering

En placering beskriver en registrerad fysisk plats och har alltid lagertypen
`actual`. Det finns inget planerat lager eller någon bekräftelse mellan plan
och utfall i P0. Tidsfiltrering visar den faktiska placering som gällde på
valt datum.

### TIME-04 — Tidsreglage

Användaren ska kunna välja exakt datum, gå en dag, månad eller ett år framåt
eller bakåt och återgå till idag. Ett tidsreglage ska filtrera synliga
placeringar. Det ska gå att nå både tidigare och framtida år.

Datumbytet är en visningsåtgärd. Det får inte ändra lagrade planteringar eller
flytta journalhändelser.

### TIME-05 — Förkultivering är inte bäddbeläggning

En sådd inomhus får inte göra att en utomhusbädd blir upptagen samma dag.
Såddhändelse, eventuell utplanteringshändelse och kartplaceringens start är
separata registrerade data.

När användaren registrerar utplantering ska gränssnittet erbjuda att samtidigt
skapa en registrerad placering. Användaren ska uttryckligen ange och godkänna
plats och datum; sådd och placeringsstart är aldrig automatiskt kopplade.

### TIME-06 — Saknade datum

Registrerade placeringar får sakna startdatum endast när användaren uttryckligen
markerat att växten redan fanns och datumet är okänt. Vid tidsfiltrering
behandlas en sådan okänd start som öppen bakåt, men UI ska tydligt säga att
det inte är ett verifierat etableringsdatum. Ett angivet slutdatum måste
ligga efter ett känt startdatum.

### TIME-07 — Flytt och tidigare placeringar

Kommandona ”Korrigera ritning” och ”Registrera fysisk flytt” ska ha olika
betydelse. Ritkorrigering rättar geometrin i den valda placeringen.
Fysisk flytt med datum avslutar föregående registrerade placering och skapar
en ny, i en gemensam IndexedDB-transaktion genom lagringslagret.

Samma plantering får inte ha två överlappande placeringsperioder. Att se ett
datum före flytten ska visa tidigare plats och datum från flytten ska visa den
nya platsen.

### TIME-08 — Skörd avslutar inte automatiskt odlingen

En plantering ska kunna ha flera skördetillfällen. Skörd ska inte automatiskt
sätta slutdatum på en placering. Borttagning eller avslut registreras separat.
Gränssnittet får erbjuda en uttrycklig kombinerad åtgärd.

### TIME-09 — Historikens omfattning

V1 ska bevara registrerade händelser, deras datum och tidigare placeringar.
Den behöver inte kunna återskapa varje tidigare redigering av en placering.
Full revisionshistorik och versionering av hela trädgårdsritningen är P1.

## 9. Kalender och odlingsjournal

### LOG-01 — Händelser

Användaren ska kunna registrera sådd, groning, omskolning, utplantering,
vattning, gödsling, beskärning, skörd, borttagning och fri anteckning.
En registrerad händelse har verkligt händelsedatum, typ, anteckning och
koppling till exakt ett mål: en plantering, en yta eller trädgården.

En skörd får ha valfri mängd och enhet. Historisk registrering i efterhand ska
fungera. Händelsedatum är inte samma sak som tekniskt registreringsdatum.

### LOG-02 — Kalender och listvy

Visa registrerade händelser i en månadskalender och en kronologisk listvy.
Filtrering ska finnas på trädgård, växt, odlingsyta och händelsetyp.
Klick på en post öppnar rätt objekt eller journal.

## 10. Lokal lagring, säkerhetskopiering och integritet

### DATA-01 — IndexedDB är beständig datakälla

All användardata ska sparas lokalt i webbläsarens IndexedDB: trädgårdar,
geometri, växtregister, planteringar, placeringsperioder, journal
och beständiga inställningar. Lagra strukturerade poster med ID:n och index,
inte hela arbetsytan som en enda JSON-sträng som skrivs om vid varje dragning.
IndexedDB stöder strukturerad lokal lagring och transaktioner.[^indexeddb]

React-state och TanStack Query-cache är inte beständig lagring. `localStorage`
får endast användas för små, återskapbara UI-preferenser; ingen odlingsdata
får ha sin enda kopia där. Framtida bilder ska i lokalt läge också lagras
lokalt, som Blob-data bakom ett separat filgränssnitt; bildfunktionen är P1.

Kartoperationer sparas automatiskt efter avslutad operation. Formulär får ha
Spara-knapp. Visa ”Sparar lokalt”, ”Sparat lokalt” och ”Kunde inte spara”.
”Sparat lokalt” får visas först när hela skrivtransaktionen har slutförts,
inte bara när ett enskilt skrivförsök har lyckats. Bekräftat sparade data ska
finnas kvar efter omladdning och normal omstart av webbläsaren i samma profil
på samma origin. Appen får inte lova skydd mot rensning eller diskhaveri.

### DATA-02 — Lagringsfel och flera flikar

Hantera full lagringskvot, avbruten transaktion, nekad eller otillgänglig
IndexedDB och blockerad databasuppgradering med begripliga fel. Appen får inte
tyst byta till minneslagring, radera databasen eller påstå att data är sparad.
Behåll osparade formulärvärden, erbjud ett kontrollerat nytt försök och
varna vid navigering med osparade ändringar där webbläsaren tillåter det.

Två flikar på samma origin får inte tyst skriva över varandras ändringar.
Varje redigerbar post ska ha en numerisk `revision`. Kontroll av förväntad
revision och skrivning ska ske i samma readwrite-transaktion. Konflikt ska
stoppa hela operationen. Den första lyckade committen vinner; fliken med den
senare skrivningen ska informeras om att dess ändring inte sparades och vilken
flik/version som vann. Ingen automatisk sammanslagning eller fältvis jämförelse
krävs. Blint återförsök får inte kringgå konflikten.

Notifiera andra flikar efter commit, exempelvis via BroadcastChannel, och
läs om relevanta data när en flik åter får fokus. Notifiering är en
cacheuppdatering, inte ersättning för transaktionell revisionskontroll.
Flera enheter delar inte data i P0; distribuera inte detta krav till en
fleranvändar- eller molnsynkfunktion.

Geometri, kopplingar, periodändringar och journal som hör till samma kommando
ska ändras atomiskt. Fysisk flytt och import är inte färdiga om bara några av
deras poster har sparats.

### DATA-03 — Export och import av en trädgård

En trädgård ska kunna exporteras till versionsmärkt JSON med samtliga
växtposter, ögonblicksbilder, objekt, planteringar, placeringar och
journalhändelser. Arkiverade poster och växtposter som ännu inte används ska
alltid ingå. Import ska skapa en ny trädgård med nya interna UUID:n och
bibehållna relationer, inte skriva över befintlig data.

Formatet ska innehålla `schemaVersion`, `exportKind` och `exportedAt`.
Exportformatets version är separat från IndexedDB:s interna databasversion.
Export ska läsa ett sammanhängande, konsistent utsnitt av data. Import validerar
hela filen, datumen och alla referenser före ändring, avvisar versioner som
inte stöds och sker atomiskt. Dubblettnamn är tillåtna; ID-kollisioner är det
inte. En felaktig fil får inte ge en halvt importerad trädgård.

Maximal importstorlek ska vara dokumenterad och minst 10 MB för JSON.
Filer ska laddas ned respektive läsas lokalt; ingen uppladdning till en server
får ske. Exportfiler får aldrig innehålla autentiseringstoken eller hemligheter.

### DATA-04 — Backup av hela den lokala arbetsytan

Utöver trädgårdsexport ska ”Säkerhetskopiera allt” spara samtliga
trädgårdar, även arkiverade poster, oanvända egna växtposter och beständiga
inställningar. En backup ska kunna återställas i en tom lokal arbetsyta med
bevarade ID:n och relationer. För P0 ska återställning till en icke-tom
arbetsyta avvisas med tydlig förklaring; bygg ingen tyst ersättning eller
automatisk sammanslagning.

Detta är ett annat flöde än ”Importera trädgård som kopia”, som skapar nya
ID:n. Skilj exporttyperna med `exportKind`. Båda flödena ska ha validering,
konsistent läsning, atomisk skrivning och provad återställning.

Grundläggande backup/export och import för den data som är implementerad ska
finnas redan i etapp 1. Senare etapper utökar formatet och testerna. Tidiga
versioner får inte tyst ignorera innehåll från senare, okända formatversioner.
Dokumentera hur en användare flyttar data mellan datorer, profiler och origins.

### DATA-05 — Versionshanterade datamigreringar

Använd ett stabilt databasnamn och explicita, versionshanterade IndexedDB-
migreringar. En ny appversion får inte skapa en tom databas med nytt namn som
normal uppgraderingsmetod. Migrera befintliga data utan förlust, med testade
uppgraderingar från tidigare scheman. En misslyckad uppgradering ska avbrytas,
inte ”lösas” med automatisk `deleteDatabase`.

Hantera att en gammal flik blockerar uppgradering: stäng gamla
anslutningar vid versionsbyte och be användaren ladda om vid behov. Vid okänd,
nyare databasversion ska appen visa ett kompatibilitetsfel utan att skriva
över data. Intern databasversion och portabelt exportformat ska dokumenteras.

### DATA-06 — Begränsningar och skydd för lokal data

Visa tydligt ”Data sparas bara i den här webbläsaren” och en lättillgänglig
backupfunktion. Förklara att lokal lagring är knuten till profil och origin
(protokoll, värdnamn och port); en annan URL kan därför visa en annan lokal
arbetsyta. Rensad webbplatsdata, privat surfning, förlorad enhet eller
webbläsarens rensning kan innebära dataförlust.[^quotas]

Erbjud en åtgärd som begär beständig lagring med
`navigator.storage.persist()` där det stöds. Visa faktiskt resultat, och gärna
uppskattat utrymme med `navigator.storage.estimate()`. Saknat API eller nekad
begäran ska inte blockera appen. Beviljad beständig lagring är inte en backup
eller ett skydd mot användarens egen rensning.[^quotas]

### DATA-07 — Lokal funktion utan nätverk

När appen har laddats ska alla P0-funktioner kunna läsa och spara utan nätverk,
inklusive navigation inom appen, datumval, redigering och lokal export/import.
P0-vyer får inte vara beroende av senare nätverkshämtade kodmoduler eller
externa CDN-resurser. Lokal lagring ska aldrig vänta på nätverksanslutning.

Att starta om eller ladda om själva appen helt utan nätverk kräver separat
cache av programfiler. Garanterad offline-start med service worker/PWA är P1,
inte ett löfte i P0. Sparad IndexedDB-data ska ändå finnas kvar när appen
kan laddas igen. Dokumentera denna skillnad.

## 11. Säkerhet och drift

### SEC-01 — Ingen inloggning i lokalt läge

P0 ska inte ha ägarkonto, lösenord, sessionsserver eller Supabase Auth.
Appen öppnas direkt till den lokala arbetsytan. En lokal PIN eller falsk
inloggningssida får inte presenteras som skydd för data. Den som har åtkomst
till samma webbläsarprofil kan använda appens data; lokal kryptering och
fleranvändarisolering ingår inte i P0.

### SEC-02 — Klientsäkerhet och integritet

Validera all formulärdata och importerat innehåll vid applikationens
lagringsgräns. Rendera användartext som text, inte osäker HTML. Kör aldrig
importerad kod och acceptera inte filer som instruerar appen att anropa
externa tjänster. Undvik farlig HTML-injektion och egen kryptografi.

Ingen telemetri, reklamspårning, fjärrloggning eller extern växttänst ska
vara aktiv i P0. Odlingsdata får inte skickas i nätverksanrop, URL-parametrar
eller felrapporter. Byggens egna statiska filer får levereras från vald host;
CSS, ikoner och eventuella typsnitt ska ingå i bygget och inte kräva en CDN.

Ingen service role-nyckel, databashemlighet eller annan serverhemlighet får
finnas i klientkod eller i framtida `VITE_*`-konfiguration. Ingen Supabase-nyckel
ska krävas för P0. Förbered dokumenterad Content Security Policy för statisk
hosting och verifiera att den inte blockerar appens legitima funktioner.

### OPS-01 — Reproducerbar frontendutveckling och statiskt bygge

Använd pnpm och checka in `pnpm-lock.yaml`. Dokumentera en verifierad,
kompatibel Node.js-version och pakethanterarversion. README ska beskriva
`pnpm install --frozen-lockfile`, `pnpm dev`, `pnpm build` och `pnpm preview`
samt typkontroll, lint och testkommandon.

Produktionsbygget ska vara statiska filer som kan serveras utan
applikationsbackend, databasprocess eller API-nycklar. Dokumentera SPA-routing,
HTTPS för publicerad drift och stabil origin för att bevara åtkomst till lokal
data. Att kopiera byggfiler eller en Docker-volym är inte backup av IndexedDB.

Docker Compose för Vite-utveckling får erbjudas som i referensprojektet,
men Docker får inte vara ett krav för att använda appen.[^ref-readme]
En eventuell container ska bara köra utvecklingsverktyg eller statisk hosting;
den ska inte införa odlingsbackend eller en datavolym för användarens data.

## 12. Teknikbas, lagringsarkitektur och kvalitetsmål

### TECH-01 — Samma grundläggande teknikval som referensprojektet

Referens: `https://github.com/Norberg/molecule-lab-book`.
Dess `package.json` och README granskades 2026-09-24 på standardgrenen
`master`. Versionerna nedan är deklarerade beroenden i referensfilen, inte
påståenden om senaste tillgängliga eller exakt installerade version.[^ref-package]

| Del | Teknik i referensprojektet | Krav för Odlingskartan |
|---|---|---|
| Frontend | React / React DOM `^19.0.0` | React med TypeScript; klientrenderad SPA. |
| Språk | TypeScript `~5.7.2`, ESM | TypeScript med strikt typkontroll och ES-moduler. |
| Bygge | Vite `^6.1.0`, React-plugin | Vite; inget byte till Next.js eller annat serverramverk. |
| Pakethantering | `pnpm@10.25.0` | pnpm, deklarerad packageManager och incheckad lockfil. |
| UI/CSS | Bootstrap `^5.3.0` | Bootstrap och kompletterande egen CSS; inte Tailwind/shadcn som ersättning. |
| Routing | `react-router-dom` `^7.1.5` | React Router för kartvy, kalender och inställningar efter etapp. |
| Asynkrona data | `@tanstack/react-query` `^5.66.0` | TanStack Query ovanpå lagringsgränssnitten, anpassad till lokalt läge. |
| Ikoner | `react-icons` `^5.4.0` | React Icons, inkluderade i bygget. |
| HTTP | Axios `^1.7.9` | Får användas när HTTP faktiskt behövs senare; inget artificiellt API i P0. |
| Test | Jest `^29.7.0`, ts-jest, jsdom, Testing Library | Jest och React Testing Library; ersätt inte med Vitest. |
| Kodkontroll | ESLint `^9.19.0`, TypeScript-/React-regler | ESLint samt separat typkontroll. |

Grundvalen ovan är beslutade. Välj vid implementationen verifierade, inbördes
kompatibla och underhållna versioner inom denna teknikbas. Kopiera inte gamla
versionsnummer blint och installera inte oanvända beroenden bara för att de
finns i referensrepot. Dokumentera betydande versionsavvikelser och deras
orsak. Byt inte teknikbas utan uttryckligt beslut från användaren.

Projektspecifika tillägg som inte hämtats från referensrepot:

| Del | Val för Odlingskartan |
|---|---|
| Karteditor | SVG med separerad koordinat-/geometrilogik; ingen GIS-tjänst. |
| Lokal databas | IndexedDB med det tunna Promise-biblioteket `idb` som standard; en likvärdig lösning får motiveras utan att ändra kontraktet. |
| Lagringstester | Isolerade adapter-/transaktionstester, vid behov fake-indexeddb i Jest, plus riktig IndexedDB i webbläsartester. |
| End-to-end | Playwright för verkliga användarflöden och beständig webbläsarprofil. |
| Framtida moln | Supabase Database för strukturerade poster och Supabase Storage för filer; ingen integration i P0. |

`idb` är ett Promise-baserat lager över IndexedDB, inte en serverdatabas.[^idb]
En fungerande befintlig implementation ska inte skrivas om enbart för
filstrukturens skull. Använd inga påhittade biblioteks-API:er.

### ARCH-01 — Separera domän, användarflöden och lagring

```text
React-komponenter och kartverktyg
  -> domänhooks / TanStack Query
  -> applikationskommandon och domänregler
  -> asynkrona repository-gränssnitt / atomiska operationer
  -> IndexedDB-adapter (P0)
  -> framtida Supabase-adapter (P1, inte implementerad nu)
```

Sista två raderna är alternativa adaptrar, inte dubbelskrivning i P0.
React-komponenter får inte anropa IndexedDB, `idb`, `localStorage` eller
framtida Supabase direkt för domändata. Samla adaptervalet i appens
sammansättning, exempelvis en injicerad provider. Endast den lokala adaptern
ska finnas i produktionsflödet nu; en minnesadapter får användas i tester.

Repository-kontrakt ska vara typade och asynkrona från början, även när
datat finns lokalt. De ska omfatta läsning, validerad skrivning, förväntad
revision, arkivering samt atomiska sammansatta kommandon. Minst fysisk flytt,
exportögonblicksbild och import/återställning ska ha
tydliga transaktionsgränser. En rad separata `save()`-anrop utan gemensam
transaktion uppfyller inte kravet.

Läck inte `IDBTransaction`, databasanslutningar eller Supabase-klienter ut i
domän- eller UI-kod. Ett framtida fjärrlager kan behöva databasfunktioner/RPC
för att uppfylla samma atomiska kommandon; det är inte bara ett byte av URL.
Särskilj valideringsfel, revisionskonflikt, lagringsbrist och otillgänglig
lagring med typade resultat eller fel som UI kan hantera.

### ARCH-02 — TanStack Query i lokalt läge

TanStack Query ska hantera asynkron laddning, mutationer och cacheinvalidiering,
men IndexedDB är den beständiga källan. Använd `networkMode: 'always'` för
lokala queries och mutationer så att de inte pausas när nätverket saknas;
standardläget `online` är inte lämpligt för detta flöde.[^query-network]

Invalidera berörda queries efter commit och vid ändringar från andra flikar.
Valideringsfel, kvotfel och konflikter får inte blint återförsökas. Ett
optimistiskt UI får inte ändra den verkliga sparstatusen eller dölja rollback.
Inställningarna ska gälla den lokala adaptern; en senare fjärradapter behöver
sin egen nätverkspolicy.

### ARCH-03 — Förbered Supabase utan att bygga molnlagring nu

**P0:** Använd klientgenererade UUID:n, explicita relationer, numerisk revision,
UTC-tidpunkter för `createdAt`/`updatedAt` och kalenderdatum för odlingsdatum.
Ha en stabil lokal `workspaceId` som avgränsar data och kan mappas till framtida
ägarskap. Den är inte ett Supabase-användar-ID och inte en säkerhetsmekanism.
Objektmodellen och exportformatet får inte innehålla lagringsmotorspecifika typer.

Dokumentera i `docs/storage-architecture.md` hur samma domänmodell kan mappas
till Supabase och vilka kontrakt en framtida adapter måste uppfylla. Beskriv
molnets transaktioner, ägarskap och migrering, men skapa inte SQL-migrationer,
Supabase-projekt, inloggning, synkkö, Realtime-prenumerationer eller en falsk
Supabase-adapter i P0. Installera inte Supabase-SDK enbart som förberedelse.

**Riktning för P1:** Strukturerade odlingsposter ska lagras i Supabase Database
(PostgreSQL). Bilder och bilagor ska använda Supabase Storage med filreferenser
i databasen, inte ersätta hela domänmodellen med ett enda JSON-objekt i en
filbucket. Supabase skiljer på sin PostgreSQL-databas och fillagring.[^supabase-db][^supabase-storage]

Aktivering ska vara ett uttryckligt användarval. Molnanslutning får inte starta
bara för att miljövariabler finns. Migrering ska föregås av lokal backup,
bevara stabila ID:n och relationer, kunna återupptas utan dubbletter och
verifieras innan någon lokal data tas bort. Tilldelning av ägare/arbetsyta ska
ske kontrollerat. Detta är inte samma sak som trädgårdsimporten som skapar nya ID:n.

När molnlagring byggs ska Supabase Auth och serverkontrollerad behörighet med
RLS/policies och lämpliga grants skydda varje exponerad tabell och privata
filbucket. Klientfiltrering på användar-ID räcker inte. Privilegierade nycklar
ska aldrig skickas till webbläsaren.[^supabase-rls]

En adapter skapar inte automatisk tvåvägssynk. Första molnetappen ska ha ett
uttalat val av datakälla. Samtidig lokal/fjärrskrivning och offline-synk mellan
enheter kräver en egen specifikation för konflikter, raderingsmarkörer,
återförsök och idempotens. `updatedAt` ensam är inte en säker konfliktregel
mellan enheter med olika klockor. Ett rent lokalt läge ska fortfarande vara möjligt.

### PERF-01 — Testbar domän och responsiv karta

Datumfiltrering, intervalldetektering och geometriska transformationer ska
kunna testas utan React, IndexedDB eller Supabase. Undvik att lagra hela
trädgården i ett nytt format bara för att optimera en renderingsdetalj.

En provträdgård med 100 strukturobjekt, 1 000 planteringar och 2 000
journalhändelser ska användas för prestandakontroll. Målet är att första
användbara kartvyn ska visas inom tre sekunder när programfilerna finns
lokalt tillgängliga, och att datumbyte, panorering och dragning inte upplevs
som blockerade. Dokumentera testmiljö och faktiska mätresultat. Påstå inte
uppmätt prestanda utan mätning. Dataintegritet får inte tas bort för att nå målet.

## 13. Logisk datamodell

IndexedDB-schemat ska spegla dessa separata begrepp med explicita relationer.
Domänmodellen ska vara portabel till en framtida PostgreSQL-databas:

| Begrepp | Ansvar |
|---|---|
| Workspace | Lokal arbetsytas stabila UUID och beständiga inställningar; inget konto. |
| Garden | Namn, mått, enheter, tidszon, arbetsytereferens och arkivering. |
| GardenObject | Strukturobjekt med typ, geometri, låsning och valfri livslängd. |
| PlantDefinition | Återanvändbar växt-/sortpost med valfria odlingsvärden. |
| Planting | Ett exemplar eller en odlingsomgång med antal och katalogögonblicksbild. |
| Placement | Faktisk plats och geometri under en period, lagertypen `actual` och valfri referens till ett strukturobjekt. |
| JournalEvent | Registrerad händelse, faktiskt datum, anteckning och eventuell skördemängd. |
| Asset (P1) | Metadata och stabil filreferens för framtida bilder/bilagor; binärdata hålls separat. |

Domänposter ska ha klientgenererade stabila UUID:n, `createdAt`, `updatedAt`
och numerisk `revision`. Alla poster ska kunna härledas till samma arbetsyta
via explicita relationer. Växtregistret får delas mellan trädgårdar inom
arbetsytan. Referenser från en plantering till en annan trädgårds strukturobjekt eller
placering ska avvisas. Referensintegritet ska valideras av applikations-/
lagringslagret inom samma transaktion.

Flera händelser får höra till samma plantering.

Att arkivera en växtpost får inte förstöra planteringar som redan använder
den. Att avsluta en placering får inte ta bort planteringen eller dess journal.

## 14. Acceptanstester

Testerna använder avsiktligt fasta datum och exempelvärden, inte verifierade
odlingsråd. Testmiljön ska kunna styra vilket datum som räknas som idag.

| ID | Scenario och förväntat resultat |
|---|---|
| AT-01 | Skapa trädgården ”Min trädgård”, 20 × 15 m, och en bädd 4 × 1,2 m. Spara, ladda om och stäng/öppna webbläsaren med samma beständiga profil och origin. Namn, mått och positioner finns kvar i IndexedDB utan backend. |
| AT-02 | Skapa egen växt ”Morot, test A”, en grupp med antal 20 och en registrerad placering i bädden från 2027-04-15 till och med 2027-08-31. Gruppen kan väljas från både karta och lista och dess egenskaper redigeras. |
| AT-03 | Gruppen i AT-02 syns 2027-04-15 och 2027-08-31 men inte 2027-04-14 eller 2027-09-01. Datumbyte ändrar inte data. |
| AT-04 | Registrera grupp A på en yta 2027-03-01–2027-05-31 och grupp B på samma yta 2027-06-01–2027-09-30. Rätt grupp visas respektive datum; perioderna utlöser ingen överlappningsvarning. |
| AT-05 | Registrera en befintlig vinbärsbuske med okänt startdatum och utan slutdatum. Samma individ visas 2026-12-31 och 2027-01-01 utan årskopiering. |
| AT-06 | Registrera sådd inomhus 2027-03-01 och en utomhusplacering från 2027-05-20. Utomhusbädden är inte belagd av denna placering 2027-04-01. |
| AT-07 | Registrera en vattning 2027-04-15 och en gödsling 2027-04-19. Kalender och journal visar båda händelserna med sina verkliga datum. |
| AT-08 | Registrera två skördar från samma plantering. Båda finns kvar och den registrerade placeringen har inte automatiskt avslutats. |
| AT-09 | Flytta en registrerad planta från bädd A till bädd B med flyttdatum 2027-06-01. Kartan visar A den 31 maj och B den 1 juni. Det finns inte två samtidiga registrerade placeringar. |
| AT-10 | Rita en polygon, redigera ett hörn, flytta och rotera en bädd med bundna planteringar och zooma. Mått och interna avstånd bevaras där de ska. Ångra/gör om återställer respektive läge, även efter omladdning med bevarad ånger-/gör-om-historik. |
| AT-11 | Exportera trädgården och importera som en ny trädgård. Geometri, datum, antal, relationer, arkiverade poster och oanvända växtposter motsvarar originalet men interna ID:n är nya. En ogiltig referens eller okänd formatversion lämnar databasen oförändrad. |
| AT-12 | Simulera kvotfel och avbruten IndexedDB-transaktion. UI visar inte ”Sparat lokalt”, osparad inmatning bevaras och inga deländringar finns kvar. Låt två flikar redigera samma revision; första committen vinner och den senare fliken får besked om att dess ändring inte sparades och vilken version som vann. |
| AT-13 | Appen fungerar utan konto. En anteckning eller import med HTML/script visas som text och kör ingen kod. Ogiltigt importinnehåll avvisas utan skrivning eller nätverksanrop. Produktionsbygget innehåller inga hemligheter eller telemetrianrop. |
| AT-14 | Visa samma sparade odlingsdatum med webbläsaren inställd på olika tidszoner och runt sommartidsbyte. Datumet är oförändrat. Kontrollera även skottdag och konverteringen från sista dag till exklusivt slutdatum. |
| AT-15 | Två efterföljande registrerade placeringar för samma plantering behåller sina datum och visar rätt plats på respektive datum. |
| AT-16 | Ändra en växtposts namn och skördeintervall efter att planteringen skapats. Planteringens sparade värden och journal ändras inte tyst. |
| AT-17 | Arkivera en växtpost eller bädd med odlingshistorik. Posten är dold som standard, kan visas i arkivfiltret och återställas. Historiken går fortfarande att läsa och exportera. Radering får inte orsaka oannonserad kaskadradering. |
| AT-18 | Registrera två olika planteringar som överlappar i tid och rum. Överlappet ger varning men kan sparas. |
| AT-19 | Ladda appen och koppla bort nätverket. Skapa/redigera en plantering, byt datum och vy samt exportera lokalt. Query-operationer får inte pausas av offline-status. Återanslut och ladda om; ändringarna finns kvar. Offline-omladdning av programfiler ingår inte i detta P0-test. |
| AT-20 | Starta från ren profil utan backend, API-nycklar eller Supabase-konfiguration. Hela etapp 1 fungerar. Inspektera nätverkstrafiken i produktionsbygget: egna statiska filer är tillåtna, men inga odlingsdata skickas och inga Supabase-anrop sker. |
| AT-21 | Uppgradera en testdatabas med tidigare schema och kända data. ID:n, geometri, datum och relationer bevaras. Misslyckad migration lämnar tidigare data intakt. Testa blockerande gammal flik och okänd nyare version utan automatisk databasradering. |
| AT-22 | Exportera hela arbetsytan med två trädgårdar, en oanvänd växtpost och inställningar. Återställ i tom profil. Alla poster, ID:n och relationer bevaras. Ogiltig backup eller återställning i icke-tom arbetsyta ger fel utan deländring. |
| AT-23 | Testa att begäran om persistent storage beviljas, nekas respektive saknar API-stöd. UI visar rätt status utan att lova backup. Appen fungerar med tydlig varning när beständighet inte beviljas. |
| AT-24 | Kör repository-kontraktstester för den lokala adaptern och en injicerad testadapter. Användarflöden och domäntester fungerar utan direkt import av lagringsmotor i UI/domän. Testa transaktionsrollback, revisionskonflikt och återförsök utan dubbletter. Ingen Supabase-implementation behövs. |
| AT-25 | Öppna appen i en separat profil eller på en annan origin. Den har en separat lokal arbetsyta, inte automatisk synk. Flytta data dit med export/återställning. Den ursprungliga arbetsytan ska vara oförändrad och begränsningen förklaras i UI/README. |

Datuminvarianter, referensvalidering och geometri ska ha enhetstester.
Lagring, transaktioner, datamigreringar och import ska ha integrationstester.
Använd Jest och React Testing Library enligt teknikbasen. Mockad IndexedDB
kan användas för snabba tester men ersätter inte riktiga webbläsartester.

De centrala resorna AT-01–09, export/import, offline-funktion och flikkonflikt
ska även verifieras via UI med Playwright. Testa riktig IndexedDB och en
beständig, isolerad testprofil för omstartsfallet. UI-tester får inte kringgå
de användarhandlingar de påstår sig testa genom direkt databasinsättning.
Fixtures och felinjektion är tillåtna som testförutsättningar och ska redovisas.
Tester får aldrig köras mot användarens verkliga profil eller data.

## 15. Implementationsetapper

### Etapp 1 — En fungerande kärna från karta till lokal databas

Sätt upp teknikbasen från `Norberg/molecule-lab-book`: React, TypeScript,
Vite, pnpm, Bootstrap, React Router, TanStack Query, React Icons och Jest.
Lägg till IndexedDB-adaptern och Playwright enligt avsnitt 12.

Bygg lokal arbetsyta, versionshanterad databas, asynkrona lagringskontrakt,
trädgård, rektangulär bädd, enkel egen växtpost, individuell/grupperad
registrerad placering, datumintervall,
datumväljare och beständig lokal lagring. Det ska gå att panorera, zooma,
flytta och ändra numeriska mått. Visa lokal sparstatus och grundläggande
lagringsfel. Bygg inte konto, Fastify, SQLite, Supabase eller nätverks-API.

Implementera redan nu export/import och full arbetsytebackup för de entiteter
som etappen innehåller. Inför transaktionsgränser, UUID:n och revisionskontroll
från början. Dokumentera lagringsarkitekturen och den framtida Supabase-vägen.

Färdig när AT-01–03, AT-19 och AT-20 passerar via UI. AT-11, AT-12,
AT-21, AT-22 och AT-24 ska vara verifierade för etappens implementerade data
och kommandon; slutlig täckning av senare entiteter sker i etapp 5.
Datumreglerna ska ha enhetstester. Visa den sparade användarresan, inte bara
komponenter. Full kalender, polygonverktyg och full journal byggs senare.

### Etapp 2 — Ett användbart ritverktyg

Komplettera objektkategorier, polygoner, cirklar, rotation, låsning, lager,
bäddbundna transformationer och Ångra/Gör om.
Verifiera MAP-01–08 och AT-10 inklusive sparande i IndexedDB.

### Etapp 3 — Odlingsmodellen och tidslinjen

Komplettera växtfält, fleråriga och odaterade planteringar, efterföljande
odlingar, fysisk flytt, validering och överlappningsvarningar.
Verifiera AT-04–05, AT-09, AT-14–15 och AT-18. Testa domänreglerna bakom
AT-06 och AT-16 med testdata; deras fullständiga journalflöden verifieras
genom UI i etapp 4.

### Etapp 4 — Registrerad journal

Bygg händelser, kalender och listvy. Verifiera AT-06–08 och AT-16 samt att
skörd inte avslutar odlingen. Utöka lokal lagring, backup och migrationsprov
med dessa entiteter. Kalender och journal ska också fungera utan nätverk i
laddad app.

### Etapp 5 — Dataskydd och statisk leverans

Slutför export/import för hela modellen, flikkonflikter, arkivering,
backup/återställning, lagringsstatus, mobilflöden, säkerhetskontroller,
dokumentation och statiskt produktionsbygge. Verifiera AT-11–13,
AT-17 och AT-19–25 samt den fullständiga användarresan.

Säkerhet och dataintegritet får inte medvetet lämnas trasiga i tidigare
etapper. Etapp 5 innebär slutlig verifiering och komplettering, inte tillstånd
att använda osäker lagring eller skriva över historik under utvecklingen.

Varje etapp ska lämna appen körbar. Dokumentera implementerade krav,
genomförda tester, faktiska resultat och kvarvarande avvikelser.
Markera inte en etapp som klar bara för att dokumentationen eller en skärmbild
finns. Ingen av de fem etapperna omfattar faktisk Supabase-integration.

## 16. Senare funktioner

| Prioritet | Funktion |
|---|---|
| P1 | Valfri Supabase-lagring, autentisering, ägarskap/RLS och kontrollerad migrering från lokal arbetsyta enligt ARCH-03. |
| P1 | Offline-start av hela appen med service worker/PWA och versionssäker cache av programfiler. Lokal redigering i redan laddad app ingår däremot i P0. |
| P1 | Ladda upp en egen bakgrundsbild och kalibrera skala med två punkter och känt avstånd. |
| P1 | Foton i journal, lokal Blob-lagring och komplett filbackup; ritningsutskrift och bildexport. |
| P1 | Rader, automatisk plantfördelning och bättre gruppredigering. |
| P1 | Full mobil ritning, import av växtdata och revisionshistorik. |
| P2 | Automatisk tvåvägssynk/offline-synk mellan enheter; kräver separat kravställning och är inte en automatisk följd av Supabase. |
| P2 | Växtföljdsförslag, samodlingsregler, väder, frostvarningar och frölager. |
| P2 | Delning, samarbete mellan användare, geografiska kartor, ljus-/skuggsimulering och AI-funktioner. |

Att en funktion finns i denna tabell är inte ett uppdrag att implementera den
under P0. Supabase-förberedelsen i ARCH-03 är däremot ett P0-krav.

## 17. Definition av färdig P0

P0 är klar när alla P0-krav är uppfyllda och alla 25 acceptanstester
har körts med godkänt resultat. Kvarvarande avvikelser ska redovisas och
betyder att P0 ännu inte är komplett; en avvikelse är inte ett uppfyllt krav.

Leveransen ska innehålla källkod, `pnpm-lock.yaml`, IndexedDB-migreringar,
Jest-/Testing Library-tester, Playwright-tester, README med verifierade
startkommandon och statisk drift, frivilliga demodata, versionsmärkt
exportformat samt instruktioner för backup och återställning.
`docs/storage-architecture.md` ska beskriva repository-kontrakt,
transaktionsgränser, lokal datamodell och framtida Supabase-mappning.
Dockerfiler är frivilliga; en serverdatabas eller hemlig konfiguration får
inte krävas för att bygga eller använda appen.

README ska förklara skillnaden mellan växtpost, plantering och placering samt
ritkorrigering och fysisk flytt.
Dokumentera att strukturobjektens geometri inte har full tidsversionering,
att data endast ligger i aktuell profil/origin och att appen inte har
molnsynk eller garanterad offline-start i P0.

Dokumentera och kör `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`pnpm test:e2e` och `pnpm build`. UI-flödet ska vara granskat i webbläsare.
Tester som inte kunde köras ska anges som ej körda med orsak, inte som godkända.
Avslutningsrapporten ska beskriva vad som faktiskt fungerar och vilka krav
som återstår. Detta dokument är en kravställning, inte en rapport om att en
implementation redan har byggts eller testats.

## 18. Referensunderlag

Underlaget kontrollerades 2026-09-24. Exakta beroendeversioner ska ändå
verifieras vid implementationen. Biblioteksdokumentationen motiverar
tekniska begränsningar; produktkrav och etappval är denna kravställnings designbeslut.

[^ref-package]: Referensprojektets `package.json`: `https://github.com/Norberg/molecule-lab-book/blob/master/package.json`. Granskad Git blob SHA: `f72148003081010d34c6a996dc9f9ea9c1c072af`.
[^ref-readme]: Referensprojektets README: `https://github.com/Norberg/molecule-lab-book/blob/master/README`.
[^indexeddb]: MDN, Using IndexedDB: `https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB`.
[^quotas]: MDN, Storage quotas and eviction criteria: `https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria`.
[^idb]: `idb`, projektdokumentation: `https://github.com/jakearchibald/idb`.
[^query-network]: TanStack Query, Network Mode: `https://tanstack.com/query/latest/docs/framework/react/guides/network-mode`.
[^supabase-db]: Supabase Database: `https://supabase.com/docs/guides/database/overview`.
[^supabase-storage]: Supabase Storage: `https://supabase.com/docs/guides/storage`.
[^supabase-rls]: Supabase, Row Level Security: `https://supabase.com/docs/guides/database/postgres/row-level-security`.
