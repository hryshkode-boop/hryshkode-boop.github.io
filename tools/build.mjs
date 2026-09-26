/**
 * Static multilingual build.
 *
 * The site is authored once in src/index.html and rendered client-side from a
 * dictionary. That is fine for humans but leaves search engines with a single
 * URL serving three languages. This build turns it into one indexable URL per
 * language — /de/, /en/, /ua/ — each shipped as fully rendered HTML with its
 * own <html lang>, title, description, canonical and hreflang set, plus a root
 * page that points visitors at the right one.
 *
 * Usage: node tools/build.mjs [--check]
 *   --check  render into memory and fail if the committed output is stale
 */
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'index.html');
const ORIGIN = 'https://hryshko.info';
const CHECK = process.argv.includes('--check');

/** dir: public URL segment; code: ISO-639-1 (what hreflang must carry). */
const LANGS = [
  { dir: 'de', code: 'de', ogLocale: 'de_DE', label: 'Deutsch' },
  { dir: 'en', code: 'en', ogLocale: 'en_US', label: 'English' },
  { dir: 'ua', code: 'uk', ogLocale: 'uk_UA', label: 'Українська' }
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function seoLinks(current) {
  const lines = [`<link rel="canonical" href="${ORIGIN}/${current.dir}/">`];
  for (const l of LANGS) lines.push(`<link rel="alternate" hreflang="${l.code}" href="${ORIGIN}/${l.dir}/">`);
  lines.push(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/">`);
  return lines.join('\n  ');
}

/** Read the per-language strings straight out of the source dictionary. */
async function readDict(page) {
  return page.evaluate(() => DICT);
}

async function main() {
  const source = await readFile(SRC, 'utf8');
  // CHROMIUM_PATH lets a machine reuse a Chromium it already has instead of
  // downloading Playwright's pinned build.
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  );
  const outputs = new Map();

  for (const lang of LANGS) {
    // Pin the language before any script runs, so the prerendered DOM is that
    // language rather than whatever the build machine's locale happens to be.
    const html = source.replace('<!--SEO_LINKS-->', `${seoLinks(lang)}\n  <script>window.__LANG=${JSON.stringify(lang.code)};</script>`);
    const tmp = path.join(ROOT, `.build-${lang.dir}.html`);
    await writeFile(tmp, html);

    const page = await browser.newPage();
    // Third-party scripts must not end up baked into the output.
    await page.route('**/*', (route) => {
      const url = route.request().url();
      return url.startsWith('file://') ? route.continue() : route.abort();
    });
    await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('timelineList')?.children.length > 0);

    const dict = await readDict(page);
    const d = dict[lang.code];
    const title = d.meta.title;
    const description = d.meta.description;

    let out = await page.evaluate(() => '<!DOCTYPE html>\n' + document.documentElement.outerHTML);
    await page.close();
    await rm(tmp);

    // Head rewrites: the runtime already set these in the live DOM, but the
    // static markup has to carry them for crawlers that do not execute JS.
    out = out.replace(/<html lang="[^"]*"/, `<html lang="${lang.code}"`);
    out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
    out = out.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`);
    out = out.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`);
    out = out.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(description)}">`);
    out = out.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(title)}">`);
    out = out.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(description)}">`);
    out = out.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${ORIGIN}/${lang.dir}/">`);
    out = out.replace(/<meta property="og:locale" content="[^"]*">/, `<meta property="og:locale" content="${lang.ogLocale}">`);
    out = out.replace(/<meta property="og:locale:alternate" content="[^"]*">\s*<meta property="og:locale:alternate" content="[^"]*">/,
      LANGS.filter((l) => l.code !== lang.code).map((l) => `<meta property="og:locale:alternate" content="${l.ogLocale}">`).join('\n  '));
    out = out.replace('"url": "https://hryshko.info/",', `"url": "${ORIGIN}/${lang.dir}/",\n  "inLanguage": "${lang.code}",`);

    outputs.set(path.join(lang.dir, 'index.html'), out.endsWith('\n') ? out : out + '\n');
  }

  await browser.close();
  const root = rootPage();
  checkInlineScripts(root, 'index.html');
  outputs.set('index.html', root);
  outputs.set('sitemap.xml', sitemap());

  let stale = [];
  for (const [rel, content] of outputs) {
    const abs = path.join(ROOT, rel);
    const current = existsSync(abs) ? await readFile(abs, 'utf8') : null;
    if (current === content) continue;
    stale.push(rel);
    if (!CHECK) {
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, content);
    }
  }

  if (CHECK && stale.length) {
    console.error(`Committed output is stale — run "npm run build":\n  ${stale.join('\n  ')}`);
    process.exit(1);
  }
  console.log(stale.length ? `Built:\n  ${stale.join('\n  ')}` : 'Up to date.');
}

/**
 * The root page's scripts live inside a template literal, where an escape can be
 * consumed before it reaches the page — a broken regex there once left every
 * visitor stranded on the language picker with no error anywhere. Parse them at
 * build time so that breaks the build instead of the site.
 */
function checkInlineScripts(html, label) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, i = 0;
  while ((m = re.exec(html)) !== null) {
    i += 1;
    try { new vm.Script(m[1]); }
    catch (err) { throw new Error(`${label}: inline script #${i} does not parse — ${err.message}`); }
  }
}

/**
 * Root page: Google's documented x-default target — a language selector that
 * forwards visitors to their language. Kept tiny and fully crawlable so the
 * three real pages are reachable without JavaScript.
 */
function rootPage() {
  const alts = LANGS.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${ORIGIN}/${l.dir}/">`).join('\n  ');
  const links = LANGS.map((l) => `<a href="/${l.dir}/" hreflang="${l.code}" lang="${l.code}">${l.label}</a>`).join('\n      ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Viacheslav Hryshko — IT Systems Electronics Technician</title>
<meta name="description" content="IT systems electronics technician — laptop and PC repair, diagnostics, component-level service. Choose your language: Deutsch, English, Українська.">
<link rel="icon" href="/img/apple-touch-icon.png" type="image/png">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="canonical" href="${ORIGIN}/">
${'  ' + alts}
<link rel="alternate" hreflang="x-default" href="${ORIGIN}/">
<meta name="theme-color" content="#1c3f66">
<style>html.forwarding body{visibility:hidden}</style>
<script>
// Runs before the body is parsed, so the visitor never sees this page flash by
// on the way to their language. Without JavaScript the class is never set and
// the language links below stay visible — which is also what crawlers get.
(function(){
  var map={de:'/de/',en:'/en/',uk:'/ua/',ru:'/ua/'};
  // Browser language alone sends every visitor with an English UI to /en/, and a
  // great many people in Germany run their system in English — analytics showed
  // /en/ getting twice the traffic of /de/ on a site aimed at German employers.
  // The time zone says where someone is, which the interface language does not,
  // so a German-speaking zone picks the German page. The switcher is in the
  // header either way, one click from the English version.
  // Plain lists, not regexes: a backslash inside this template literal is eaten
  // before it reaches the page, which silently breaks the expression.
  var deZones = ['Europe/Berlin','Europe/Vienna','Europe/Zurich','Europe/Busingen'];
  var uaZones = ['Europe/Kyiv','Europe/Kiev','Europe/Uzhgorod','Europe/Zaporozhye'];
  var byZone = '';
  try{
    var tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    if (deZones.indexOf(tz) !== -1) byZone = '/de/';
    else if (uaZones.indexOf(tz) !== -1) byZone = '/ua/';
  }catch(e){}
  var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
  var byLang = '';
  for (var i = 0; i < langs.length && !byLang; i++){
    byLang = map[String(langs[i]).slice(0,2).toLowerCase()] || '';
  }
  // An English interface is usually a default rather than a decision — that is
  // exactly why /en/ was collecting visitors who live in Germany — so location
  // outranks it. Someone who picked German or Ukrainian meant it, and keeps it.
  var deliberate = byLang && byLang !== '/en/';
  var target = deliberate ? byLang : (byZone || byLang || '/en/');
  // This page becomes the referrer of the page it forwards to, which would hide
  // where the visitor actually came from. Carry the original referrer across in
  // the URL — the language page reads it, reports it and cleans the address bar.
  // Deliberately not sessionStorage: the privacy policy states that no storage
  // is used, and that has to stay true.
  var ref = document.referrer;
  if (ref && ref.indexOf(location.origin) !== 0) target += '?r=' + encodeURIComponent(ref);
  document.documentElement.className='forwarding';
  // If the navigation has not happened shortly after, show the picker rather
  // than leaving the visitor on a blank page.
  setTimeout(function(){document.documentElement.className='';},1500);
  location.replace(target);
})();
</script>
<style>
:root{--bg:#f6f7f9;--surface:#fff;--ink:#101827;--ink-soft:#4b5768;--line:rgba(16,24,39,.12);--accent:#1c3f66;--gold:#b8902e;--font:'Calibri','Carlito',-apple-system,"Segoe UI",sans-serif;}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font-family:var(--font);padding:24px;}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:36px 32px;text-align:center;max-width:420px;width:100%;box-shadow:0 1px 2px rgba(16,24,39,.05),0 14px 32px -16px rgba(16,24,39,.18);}
.mark{width:46px;height:46px;margin:0 auto 16px;border-radius:12px;background:linear-gradient(135deg,var(--accent),#0e2338);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;}
h1{font-size:1.25rem;margin:0 0 6px;letter-spacing:-.01em;}
p{color:var(--ink-soft);font-size:.92rem;margin:0 0 22px;}
nav{display:flex;flex-direction:column;gap:9px;}
nav a{display:block;padding:12px 16px;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--ink);font-weight:600;font-size:.95rem;transition:border-color .2s,transform .2s;}
nav a:hover{border-color:var(--gold);transform:translateY(-2px);}
</style>
</head>
<body>
  <main class="card">
    <div class="mark">VH</div>
    <h1>Viacheslav Hryshko</h1>
    <p>IT Systems Electronics Technician</p>
    <nav aria-label="Language">
      ${links}
    </nav>
  </main>
</body>
</html>
`;
}

/**
 * lastmod is the date the content actually changed, taken from git — not the
 * build date, so rebuilding without edits produces byte-identical output and
 * `--check` stays meaningful.
 */
function contentDate() {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', 'src/index.html'], { cwd: ROOT, encoding: 'utf8' }).trim()
      || new Date().toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function sitemap() {
  const today = contentDate();
  const alts = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.code}" href="${ORIGIN}/${l.dir}/"/>`).join('\n') +
    `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/"/>`;
  const pages = LANGS.map((l) => `  <url>
    <loc>${ORIGIN}/${l.dir}/</loc>
${alts}
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${ORIGIN}/</loc>
${alts}
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
${pages}
</urlset>
`;
}

main().catch((err) => { console.error(err); process.exit(1); });
