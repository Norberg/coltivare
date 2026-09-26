# Lokal lagring och framtida adapter

## Port och datamodell

`Repository` i `src/repository.ts` är en asynkron port. UI tar emot porten
som beroende; endast `main.tsx` väljer `IndexedRepository`. Domänmodulen
importerar ingen React-, IndexedDB- eller molnklient. UI:s import av
repository-typen tas bort av TypeScript vid bygge.

`list`, `commit`, `history`, `travel`, `export`, `import`, `subscribe` och
`close` är kontraktet. `commit` tar en lista av tidigare och nya poster:
tidigare `revision` är villkoret för uppdatering. Revision 0 betyder en ny
post. Fel har koderna `validation`, `conflict`, `quota`, `unavailable` och
`version`. Ingen motortransaktion exponeras i UI/domän.

`tests/contract.test.ts` kör samma kontrakt mot IndexedDB-adaptern och en
fristående minnesadapter: atomisk flytt, rollback, revisionskonflikt,
återförsök utan dubbletter, import/export och beständig kommandosemantik.
`tests/app.test.tsx` injicerar minnesadaptern i appen. Minnesadaptern används
enbart i tester och är inte en tyst fallback när lokal lagring misslyckas.

Domänen använder UUID:n, UTC-tidpunkter för teknisk metadata och rena
YYYY-MM-DD-strängar för odlingsdatum. Perioder är halvöppna `[start,end)`.
Sista visningsdag konverteras genom kalenderaddition. Okänd start kräver ett
uttryckligt val och är öppen bakåt. Framtida datum är tillåtna.

Workspace, Garden, GardenObject, PlantDefinition, Planting, Placement och
JournalEvent lagras som separata strukturerade rader i `records`, åtskilda
av `kind`, med explicita relationer. Index finns för `kind`, `workspaceId`,
`gardenId` och `plantingId`. Arbetsytans UUID är en lokal avgränsning, inte
en säkerhetsmekanism eller ett framtida användar-ID.

Växtfält hålls som namngivna värden med enhet i fältnamnet. Okänt är tomt.
En plantering lagrar en egen kopia av växtposten. Geometri använder meter,
lokal rotation och vid bindning lokala koordinater relativt strukturen.
Utbredning är ett kartmått, inte biologisk tillväxt.

Valfria `color` (sexsiffrig hexkod) och `icon` (ett lokalt, validerat ikon-ID
eller `none`) lagrar kartutseende. Äldre poster utan dessa fält använder
standardutseendet och behöver ingen datamigrering. Planteringar använder
egna utseendevärden om sådana finns, annars sin sparade växtsnapshot.
Placeringens egen färg har högst prioritet. Export och import inkluderar
utseendet, även i snapshots; själva SVG-teckningarna är statisk appkod.

## Transaktioner

- `commit`: en readwrite-transaktion läser nuvarande revisioner, bygger och
  validerar kandidatmodellen, skriver enbart berörda poster och uppdaterar
  ångerhistorik. Vid fel avbryts allt. Sparstatus ändras till sparad först
  efter `tx.done`.
- Fysisk flytt skickar avslut av gammal placering och skapande av ny i samma
  `commit`. Händelse med uttryckligen vald utplanteringsplacering gör likadant.
- `travel`: ångra/gör om läser och skriver både domänposter och
  kommandostackar i en transaktion. Revisioner ökar även vid ånger.
  Innehåll som ändrats utanför kommandot får inte tyst skrivas över.
  Ångrat skapande representeras av arkivering, aldrig borttagen historik.
- `export`: en readonly-transaktion läser poster och historik för en
  konsistent ögonblicksbild.
- `import`: filen valideras innan skrivning. Referenser i trädgårdsimport
  mappas om till nya ID:n. Workspace-backup avvisas om målmodellen innehåller
  domändata. Alla skrivningar och eventuell ersättning av den tomma
  arbetsyteposten ligger i samma transaktion.

Första committen vinner vid samtidiga ändringar av samma revision. Felet
rapporterar den sparade revisionen och dess uppdateringstid; förlorande
formulär behåller sina fält. Avbryt och öppna egenskaperna igen för att läsa
den senaste versionen. BroadcastChannel skickar enbart commit-notifiering;
Query läser om data. Fokus på fliken utlöser också omläsning. Notifiering
ersätter inte revisionskontroll i transaktionen.

## Versioner och portabel export

Stabilt databasnamn: `odlingskartan`. Intern version: **2**.

1. Version 1 skapar `records` och index för typ, trädgård och arbetsyta.
2. Version 2 lägger till `history` och indexet `plantingId`. Befintliga
   poster behöver inte skrivas om.

Uppgradering sker i IndexedDB:s upgrade-transaktion. Ingen automatisk
`deleteDatabase` finns. En blockerande äldre flik ger ett fel med instruktion
att stänga fliken och ladda om. Öppna anslutningar stängs vid versionsbyte.
En okänd nyare databas ger kompatibilitetsfel utan återställning/radering.

Exportformatet har separat `schemaVersion: 1`, `exportKind` (`garden` eller
`workspace`), `exportedAt` och `records`. Workspace-backup inkluderar även
`histories`. Trädgårdsexport innehåller alla växtdefinitioner men endast den
valda trädgårdens objekt, planteringar, placeringar och journalhändelser.
Ångerkommandon kopieras inte vid trädgårdsimport; den nya trädgården börjar
med en tom kommandostack. Faktisk odlingshistorik kopieras alltid.

Ingen export innehåller en databasanslutning, IDB-typ, inloggningstoken eller
annan motorberoende information. Import får inte ignorera okända versioner.
Maximal filstorlek i UI är 20 MiB.

## Framtida Supabase-lagring (inte implementerad)

Modellen kan mappas till separata PostgreSQL-tabeller: `workspaces`,
`gardens`, `garden_objects`, `plant_definitions`, `plantings`, `placements`,
`journal_events`. Använd UUID-primary keys, FK-relationer och numerisk
revision. Datum ska vara PostgreSQL `date`; tekniska tider `timestamptz`.
Geometri och snapshots kan initialt vara validerad JSONB, medan relationer,
perioder och ägarskap ska vara explicita kolumner. En exklusionsregel eller
transaktionell validering behöver förhindra överlapp för samma plantering.

En fjärradapter måste uppfylla samma atomiska kommandon, inte bara skicka
en rad separata REST-anrop. Flytt, sammansatta journaländringar, konsekvent
export, import och revisionskontroll behöver databasfunktioner/RPC eller
motsvarande servertransaktioner. Retry måste vara idempotent med stabila
kommando-/post-ID:n och får inte ändra förväntad revision för att kringgå en
konflikt. Befintlig lokal retry ger konflikt vid redan skapade ID:n och
skapar därför inte tysta dubbletter.

Supabase Auth ska koppla verkligt ägarskap till arbetsytan. Serverkontrollerad
RLS, policies och grants måste skydda samtliga exponerade tabeller. Klientens
workspaceId-filtrering är inte behörighetskontroll. Privilegierade nycklar får
aldrig ligga i klienten. Framtida foton ska ligga i privata Storage-buckets
med stabil filreferens och metadata i databasen, inte ersätta domänmodellen
med en JSON-fil i Storage.

Molnaktivering ska vara ett uttryckligt användarval. Miljövariabler får inte
aktivera anslutningen. Före migrering krävs lokal backup. Migreringen ska
bevara ID:n, kontrollera ägarskap, kunna återupptas utan dubbletter, verifiera
alla relationer och antal och inte ta bort lokal data före verifiering.
Detta skiljer sig från trädgårdsimport som skapar nya ID:n.

Första molnversionen ska välja en datakälla uttryckligen. Lokal/fjärr
tvåvägssynk kräver en separat specifikation för konflikter, raderingsmarkörer,
idempotens och återförsök. `updatedAt` räcker inte som konfliktregel mellan
enheter. Den lokala adaptern ska fortsatt fungera utan moln. Inga
Supabase-SDK:er, SQL-migrationer, synkköer, konton eller molnprojekt ingår nu.
