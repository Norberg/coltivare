# Valfri Supabase-lagring

Appen startar i lokalt läge. Öppna **Lagring** och välj **Använd Supabase** för att öppna
molnanslutningen och logga in med en länk som skickas till din e-postadress.
Öppna länken för att logga in; ett konto skapas första gången.
Varje konto har en egen arbetsyta. Samma konto på flera enheter använder
samma arbetsyta. Appen minns lagringsvalet i den aktuella webbläsaren.

## Installera databasen

Projektets URL och publika `anon`-nyckel finns i
[`src/supabase-config.json`](../src/supabase-config.json). Dessa uppgifter är
publika klientuppgifter, inte administrationsbehörighet.

1. Öppna [Supabase-projektet](https://supabase.com/dashboard/project/pymzmxwikuxsxwlwgmpe).
2. Öppna **SQL Editor**, skapa en ny fråga och kör hela
   [`202610100001_cloud_workspace.sql`](../supabase/migrations/202610100001_cloud_workspace.sql).
   Detta skapar tre tabeller och två RPC-funktioner med prefix `coltivare_`.
   Kör installationen en gång. Den gör inga ändringar i andra applikationers tabeller.
3. Under **Authentication → Sign In / Providers**, aktivera **Email**.
   Aktivera registrering om nya användare ska kunna skapa egna konton via länken.
4. Under **Authentication → URL Configuration**, ange
   `https://norberg.github.io/coltivare/` som **Site URL** och lägg till dessa
   exakta adresser under **Redirect URLs**:
   - `https://norberg.github.io/coltivare/`
   - `http://localhost:5173`
   - `http://localhost:5174` om du använder den porten lokalt.
   - `http://127.0.0.1:5173` om du använder den adressen lokalt.
     För åtkomst från andra enheter behöver även den använda nätverksadressen tillåtas.
5. Under **Authentication → Email Templates**, låt **Magic Link** och
   **Confirm signup** använda standardlänken `{{ .ConfirmationURL }}`.
   Appen använder länkar, inte en kod som skrivs in manuellt.
6. Se till att e-postutskick fungerar för de adresser som ska logga in.
   Konfigurera SMTP vid behov. Ett lyckat svar från API:t garanterar inte
   att meddelandet hamnar i inkorgen; kontrollera även skräpposten och Auth-loggarna.

Länken återvänder till adressen där den begärdes, inklusive `/coltivare/` på
GitHub Pages. Vid körning från webbplatsens rot skickar appen endast origin,
exempelvis `http://localhost:5173`, utan sista snedstrecket. Lägg till exakt
den adressen i listan; annars kan Supabase falla tillbaka till **Site URL**.
Efter en ändring behöver du begära en ny länk. Kontrollera också att e-postmallens
länk använder `{{ .ConfirmationURL }}`, eftersom en hårdkodad adress eller
`{{ .SiteURL }}` kan skicka användaren till en annan app.
Appen tar hand om sessionen innan hash-routern öppnar arbetsytan,
rensar inloggningsuppgifterna ur adressfältet och öppnar **Lagring**.
En ogiltig eller utgången länk visar ett fel och möjlighet att begära en ny.
Se [Supabases dokumentation om e-postlänkar](https://supabase.com/docs/guides/auth/auth-email-passwordless)
och [tillåtna returadresser](https://supabase.com/docs/guides/auth/redirect-urls).

Den publika nyckeln kan inte köra SQL-installationen eller konfigurera Auth.
Använd projektets dashboard för de stegen. Ingen administrativ nyckel behövs
i appen eller i GitHub Actions.

## Konfiguration och GitHub Pages

Det konfigurerade projektet används som standard både lokalt och på GitHub
Pages. För ett annat projekt kan du sätta `VITE_SUPABASE_URL` och
`VITE_SUPABASE_ANON_KEY` i en lokal `.env.local` eller som **Repository
variables** under **Settings → Secrets and variables → Actions** på GitHub.
Bygg och publicera om efter ändring. Next.js-namnen `NEXT_PUBLIC_*` används
inte av den här Vite-appen.

Använd endast en publik `publishable`/`anon`-nyckel. Alla `VITE_*`-värden
hamnar i den publika appen. Använd aldrig en secret- eller `service_role`-nyckel.

## Flytta lokal data och växla läge

1. Välj lokal lagring och **Säkerhetskopiera allt**. Spara JSON-filen separat.
2. Välj **Använd Supabase** och logga in på rätt konto.
3. Öppna **Lagring** och återställ backupfilen. I en ny, oanvänd arbetsyta
   behövs ingen ersättningsbekräftelse. Om molnarbetsytan redan har användardata,
   exportera den först, välj **Ersätt nuvarande arbetsyta** och bekräfta.
4. Exportera en molnbackup och kontrollera att trädgårdar, poster och
   historik finns med. Full återställning bevarar ID:n och relationer.

Den lokala arbetsytan finns kvar. Växling kopierar inga data automatiskt.
Lokal och molnlagring har separata arbetsytor. Att logga ut döljer
molnarbetsytan och rensar appens cache för kontot, men raderar inte molndata.

## Transaktioner och begränsningar

Molnläget kräver nätanslutning. Det finns ingen offlinekö eller automatisk
tvåvägssynk med IndexedDB. Appen kontrollerar arbetsytans version före varje skrivning och hämtar
innehållet om serverversionen har ändrats. Poster och ångerhistorik skickas
i en atomisk RPC-transaktion.
Posternas revisioner kontrolleras i klienten, och servern låser arbetsytan
och jämför arbetsytans revision innan något ersätts. Samtidiga skrivningar
ger konflikt i stället för tyst överskrivning. Domänvalidering körs i
klienten; databasen kontrollerar även identitet, arbetsyta och direkta referenser.

Servern hämtar alltid ägarskapet från `auth.uid()`. Alla tabeller har RLS
för `authenticated`; `anon` saknar tabellåtkomst och RPC-behörighet.
Funktionerna använder `security definer`, låst `search_path` och explicit
ägarkontroll med `auth.uid()` i varje operation. Direkta tabellskrivningar
är nekade även för inloggade användare, så att skrivningar måste gå via
versionskontrollen. Poster
ligger som separata rader med typad identitet och JSONB-innehåll i PostgreSQL.
Inga backupfiler eller odlingsdata lagras i Storage-buckets.

Molnlagringen ersätter hela arbetsytans rader per skrivning.
Det passar appens befintliga storleksgräns på 20 MB men bör ersättas med
mer riktade kommandon för mycket stora arbetsytor. Bilder/filer och Realtime
ingår inte. Andra enheters ändringar kontrolleras när du återvänder till appen och varje
minut medan fliken är synlig och webbläsaren har nätanslutning. Kontrollen
läser endast `version` från den egna raden i `coltivare_workspaces`, med
befintlig RLS. Ingen ny SQL-installation behövs. Hela arbetsytan hämtas bara
vid första läsningen och efter en ändrad serverversion.

Den senast bekräftade arbetsytan finns i minnet för den aktuella sessionen.
Efter en lyckad sparning uppdateras denna cache med serverns returnerade
version, så appens efterföljande uppdateringar inte hämtar samma innehåll igen.
Täta läsningar återanvänder samma versionkontroll under två sekunder;
skrivningar och backup-export kontrollerar alltid servern. Avbrutna eller
nekade sparningar rensar cachen så nästa läsning hämtar serverns verkliga läge.
Cachen är inte en offlinekö och blandas inte med den lokala arbetsytan.
Sparandet ersätter fortfarande hela arbetsytans innehåll; stora arbetsytor
med många skrivningar kan därför fortsatt belasta databasen.

Vid nätverksavbrott under en skrivning kan servern ha hunnit spara även om
svaret förloras. Appen rapporterar inte framgång och skriver inte i IndexedDB
som reserv. Ladda om och kontrollera resultatet innan ett återförsök.
Oförändrade post-ID:n och revisionskontroll förhindrar att
ett återförsök tyst skapar dubbletter.

## Verifiering

```sh
pnpm test
pnpm test:e2e
pnpm build
pnpm lint
# Kräver Docker; skapar och tar bort en separat PostgreSQL 17-testdatabas.
pnpm test:cloud-sql
```

Repository-kontraktstester omfattar molnadaptern, atomiska ändringar,
konflikter, ångra/gör om, export och återställning. Ytterligare testfall
kontrollerar två enheter, avbrutna skrivningar, förlorade svar, lokal
backupflytt och separata kontocacher. SQL-proven kör den verkliga migrationen
och repository-kontrakten via RPC,
och kontrollerar anonym nekad åtkomst, ägarisolering, versionskonflikter och
rollback. Klientflödena testas med en simulerad Supabase-anslutning; full
inloggning mot ditt projekt behöver verifieras efter SQL-installationen.
