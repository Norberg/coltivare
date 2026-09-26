# Odlingskartan

En svensk webbapp för att rita trädgården och dokumentera faktisk odling över
tid. All odlingsdata lagras i webbläsarens IndexedDB. Ingen backend,
inloggning, molnanslutning eller API-nyckel behövs.

Implementationen omfattar P0 i [REQUIREMENTS.md](REQUIREMENTS.md), med lokal
lagring, kartredigering, odlingshistorik och portabel backup. Testtäckning,
mätresultat och verifieringsmiljö redovisas i
[verifieringsrapporten](docs/verification.md).

## Starta

Node.js 22.14.0 och pnpm 10.25.0 användes för installation, typkontroll och bygge.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Vite skriver ut adressen. Använd samma profil och samma origin varje gång.
För ett produktionsbygge:

```sh
pnpm build
pnpm preview
```

Bygget finns i `dist/` och består enbart av statiska filer. Appen använder
hashrouting (`/#/journal`), så servern behöver inga särskilda SPA-rewrites.
Publicera med HTTPS och stabil adress; localhost fungerar för utveckling.
Byggfilerna är **inte** en backup av odlingsdatan. Ingen driftsättning eller
publicering har utförts.

## Använda appen

1. Skapa en trädgård, exempelvis 20 × 15 meter.
2. Välj Rektangel, Ellips eller Polygon och klicka/dra på kartan. Polygoner
   sluts med dubbelklick. Välj objektet för namn, kategori, mått och hörn.
3. Skapa en egen växt. Bara namnet är obligatoriskt; okända odlingsvärden är
   tomma. Alla angivna intervall behöver en utgångspunkt, till exempel sådd.
4. Välj Plantera, växt och antal. Klicka/dra i kartan och bekräfta startdatum
   och eventuell sista dag. Alternativet ”Befintlig växt – startdatum okänt”
   visar en tidigare etablerad växt utan påhittat etableringsdatum.
5. Byt datum i kartan för att se faktiska placeringar. Använd Journal för
   händelser, månadskalender och filtrerad lista.

En **växtpost** är en återanvändbar art/sort. En **plantering** är ett bestämt
exemplar eller en odlingsomgång, med antal och en fryst kopia av växtuppgifterna.
En **placering** anger var planteringen finns under en period. En plantering
kan ha flera på varandra följande placeringar.

Du kan välja en växtpost och skapa en odlingsomgång **utan placering** för
förkultivering. Såddhändelser upptar inte en bädd. Vid Utplantering kan du
uttryckligen välja att samtidigt registrera plats och placeringsdatum.
Händelsen och placeringen sparas då i en gemensam transaktion. Skörd ändrar
aldrig automatiskt en placerings slutdatum.

**Korrigera ritning** redigerar geometrin för den valda placeringen.
**Registrera fysisk flytt** avslutar den tidigare placeringen på flyttdatum
och skapar en ny från samma datum. Föregående plats finns kvar i historiken.
Bundna placeringars X/Y är lokala meter i den kopplade ytan. De följer med
ytans flytt och rotation, men skalas inte när ytan får nya mått.

Strukturobjektens geometri har inte full tidsversionering: ritkorrigeringar
gäller alla datum. Dokumentera fysisk ombyggnad genom slutdatum på den gamla
ytan och en ny yta. Geometriska varningar är inte biologiska odlingsråd.

Arkivering är reversibel. Aktivera ”Visa arkiverade” och välj Återställ i
objektets egenskaper. Inga domänposter permanentraderas av användargränssnittet.
Ångra/Gör om bevarar upp till 50 kartkommandon per trädgård i IndexedDB.
Ctrl/Cmd+Z respektive Ctrl/Cmd+Shift+Z fungerar när du inte skriver i ett fält.
Escape avbryter ritning/dragning. Objekt kan även väljas i den sökbara listan;
mått, rotation och polygonhörn kan anges i formulär. Decimaler med komma stöds.

## Säkerhetskopiering och flytt mellan enheter

Under Lagring finns två olika exportflöden:

- **Exportera trädgård** inkluderar den valda trädgården, dess historikposter
  och hela växtregistret, även oanvända och arkiverade växter. Import skapar en
  separat trädgård med nya UUID:n och ompekade relationer.
- **Säkerhetskopiera allt** inkluderar alla trädgårdar, växter, inställningar
  och ångerhistorik. Återställning bevarar ID:n och tillåts endast i en tom
  arbetsyta. En automatiskt skapad tom arbetsytepost räknas som tom.

Filer är versionsmärkta JSON-filer (`schemaVersion: 1`). Importgränsen är
20 MiB. Välj filen lokalt under Lagring. Ogiltiga versioner och referenser
avvisas före skrivning; återställningen är atomisk. Spara backupfilen utanför
webbläsaren och överför den till den andra enheten innan du importerar där.

Data finns **bara i den aktuella webbläsarprofilen och origin** (protokoll,
värdnamn och port). En annan profil eller adress har en annan arbetsyta.
Appen har ingen molnsynk. Rensad webbplatsdata, privat surfning, diskhaveri
eller förlorad enhet kan medföra dataförlust. Begär beständig lagring under
Lagring för att minska risken för automatisk rensning. Beviljande är inte en
backup och skyddar inte mot egen rensning.

En redan laddad app kan läsa, redigera, navigera och exportera utan nätverk.
Offline-start och omladdning av programfiler utan nätverk garanteras inte;
service worker/PWA är P1. TanStack Query är konfigurerad med `networkMode:
'always'` och återförsöker inte konflikter eller valideringsfel automatiskt.

## Utveckling och verifiering

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:install
pnpm test:e2e
pnpm build
```

Jest kör domän-, formulär- och integrationstester med fake-indexeddb.
Playwright använder riktig IndexedDB, isolerade kontexter och en tillfällig
beständig profil för omstartstestet. Inga tester använder användarens profil.
Prestandafixturen har 100 strukturer, 1 000 planteringar med placeringar och
2 000 journalhändelser; den innehåller inga påstådda odlingsfakta.

Utvecklings-, bygg- och testkommandona sätter temporär- och cachekataloger **inom projektet**, under
`.cache/`, och installerar Chromium under `.browsers/`. Ingen åtkomst till
`/tmp` eller ändring av sandboxprofil behövs. Testprofiler och rapporter
ligger i `test-results/`. Dessa kataloger är ignorerade av Git. På Linux
används projektets fontconfig och CPU-rendering för att undvika beroende av
GPU-enheter i testmiljön; detta ändrar inte appens rendering vid vanlig drift.
Playwright bygger appen och testar statiska produktionsfiler med CSP-headers,
inte Vites utvecklingsserver.

Se [testresultat och acceptanstäckning](docs/verification.md) för vad som
faktiskt körts.

Teknikbasen följer [referensprojektets package.json](https://github.com/Norberg/molecule-lab-book/blob/master/package.json):
React, TypeScript, Vite, pnpm, Bootstrap, React Router, TanStack Query,
React Icons, Jest och Testing Library. IndexedDB-adaptern använder `idb`.
Installerade versioner är låsta i `pnpm-lock.yaml`; inga oanvända Axios- eller
Supabase-beroenden har lagts till. Jest/TypeScript/Vite behåller referensens
huvudversioner. ESLint har uppgraderats till 10 eftersom version 9 gav en
upstream-varning om avslutat versionsstöd; samma ESLint/TypeScript-teknikbas
används med flat config.

Arkitektur, formatversioner och framtida Supabase-mappning beskrivs i
[docs/storage-architecture.md](docs/storage-architecture.md). Appen använder
lokala resurser, renderar användartext som text och har ingen telemetri.
[CSP-exemplet](docs/security.md) måste verifieras hos den valda statiska hosten.

Licens: MIT.
