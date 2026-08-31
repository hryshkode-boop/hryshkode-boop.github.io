# hryshko.info — Viacheslav Hryshko

Статический мультиязычный сайт-резюме (GitHub Pages, домен `hryshko.info`).

## Архитектура

Сайт пишется **один раз** в `src/index.html` и собирается в **три независимые
языковые страницы** — по одному индексируемому URL на язык:

| URL | Язык | `hreflang` |
|-----|------|-----------|
| `/de/` | Deutsch | `de` |
| `/en/` | English | `en` |
| `/ua/` | Українська | `uk` |
| `/` | лендинг-переключатель | `x-default` |

Публичный сегмент для украинского — `/ua/` (так его ищут пользователи), а код
`hreflang` — `uk` (ISO 639-1, единственный код, который понимает Google).

Сборщик `tools/build.mjs` открывает исходник в headless Chromium, дожидается
клиентского рендера и сохраняет **готовый HTML**. Поэтому каждая языковая
версия отдаётся поисковикам как обычная статическая страница — без выполнения
JavaScript. Скрипт при этом остаётся в странице, так что интерактив (форма,
галерея, скачивание CV) работает как раньше.

```
src/index.html            ← ЕДИНСТВЕННЫЙ файл, который редактируется вручную
tools/build.mjs           ← пререндер + генерация index.html и sitemap.xml
index.html  de/  en/  ua/ ← СГЕНЕРИРОВАНО, не править руками
sitemap.xml               ← СГЕНЕРИРОВАНО
impressum.html            ← Impressum (§ 5 DDG)
datenschutz.html          ← Datenschutzerklärung (DSGVO)
404.html  robots.txt  CNAME
img/  cv/
```

## Сборка

```bash
npm ci
npx playwright install chromium   # один раз
npm run build                     # пересобрать /de/ /en/ /ua/ /index.html /sitemap.xml
npm run check                     # CI-проверка: собранное не отстало от исходника
```

Если Chromium уже установлен в системе, путь к нему можно передать через
`CHROMIUM_PATH=/path/to/chrome npm run build`.

Workflow `.github/workflows/build.yml` пересобирает и коммитит страницы
автоматически при каждом изменении `src/` или `tools/` в ветке `main`.

## Что важно знать при правках

- **Никогда не редактируйте `de/`, `en/`, `ua/`, корневой `index.html` и
  `sitemap.xml`** — их перезапишет сборка. Все тексты живут в объекте `DICT`
  внутри `src/index.html`.
- Пути к ресурсам — **корневые** (`/img/…`, `/cv/…`), иначе они сломаются в
  подкаталогах языков.
- `robots.txt` должен разрешать обход. Директива `Disallow: /` полностью
  убирает сайт из индекса Google.
- `.htaccess` удалён: GitHub Pages работает не на Apache и игнорирует его.
  Заголовки безопасности и кэширования задаёт сам GitHub/Fastly.

## Юридические страницы

`impressum.html` и `datenschutz.html` — на немецком, как того требует
законодательство ФРГ, помечены `noindex, follow`. Содержание Datenschutz
описывает фактический стек сайта: хостинг GitHub Pages, форма через Formspree,
cookieless-аналитика Umami, внешние ссылки без встраивания, сроки хранения.
**При добавлении любого нового стороннего сервиса Datenschutz нужно обновлять.**

## Аналитика и приватность

- Umami (`cloud.umami.is`) — без cookies, без Local Storage, без хранения
  IP-адресов, поэтому cookie-баннер по § 25 TDDDG не требуется.
- Форма обратной связи — Formspree, с honeypot и защитой от слишком быстрой
  отправки.

## Лицензия

© 2026 Viacheslav Hryshko. All rights reserved.
