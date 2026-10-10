# Statisk drift och klientsäkerhet

Appen gör inga anrop till odlings-API:er, externa typsnitt eller telemetri.
Supabase Auth och Database används endast när användaren väljer molnläget.
Ägarskap och åtkomstskydd beskrivs i [supabase.md](supabase.md). React renderar användartext, inklusive journal och import, som text.
Inga funktioner använder `dangerouslySetInnerHTML`, `eval` eller importerad
kod. Domänvalidering körs vid lagringsgränsen. IndexedDB är inte krypterad;
alla med åtkomst till samma profil kan använda datan.

Följande HTTP-header är en utgångspunkt för produktionshosting:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://pymzmxwikuxsxwlwgmpe.supabase.co; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

Använd inte policyn oförändrad för Vite-utveckling: HMR behöver websocket och
utvecklings-CSS. Policyn har verifierats i Chromium mot produktionsbygget
via `scripts/static-server.mjs`, inklusive formulär, import/export och
navigation. Browserproven kontrollerar CSP-överträdelser och nätverkstrafik.
Appen publiceras på GitHub Pages. Kontrollera även den faktiska hostens
headers innan publicering; `pnpm preview` sätter inte policyn automatiskt.

Exportfiler innehåller privata anteckningar. Den som får filen kan läsa dem.
Appen laddar ner och läser filer lokalt. I molnläge skickas valda importer och odlingsändringar till kontots arbetsyta.
Samma origin är viktig för återkomst till samma data; använd en stabil
HTTPS-adress vid drift och säkerhetskopiera före byte av adress.
