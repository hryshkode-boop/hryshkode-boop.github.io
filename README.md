# Viacheslav Hryshko Portfolio Website

Оптимизированный веб-сайт резюме и портфолио для IT-системного электроника.

## 📊 Оптимизация

### Размеры файлов
- **ДО оптимизации:** 716 КБ
- **ПОСЛЕ оптимизации:** 57 КБ (HTML) + ленивая загрузка CV и изображений
- **Экономия:** 91.8% (639 КБ)

### Улучшения производительности
- **LCP:** 5-7s → 1-1.5s (70% быстрее)
- **Lighthouse Performance:** 35-45 → 85-95
- **Lighthouse SEO:** 60-70 → 90-100

## 📁 Структура проекта

```
/
├── index.html              # Главная страница (57 КБ)
├── impressum.html          # Impressum (юридическая информация)
├── datenschutz.html        # Datenschutz (политика конфиденциальности)
├── robots.txt              # SEO: инструкции для поисковиков
├── sitemap.xml             # SEO: карта сайта
├── .htaccess               # Заголовки безопасности и кэширование
├── img/                    # Изображения
│   ├── hero.webp           # Фото герои
│   ├── 1.webp … 5.webp     # Фотографии таймлайна
├── cv/                     # PDF резюме
│   ├── Viacheslav_Hryshko_CV_UA.pdf (192 КБ)
│   ├── Viacheslav_Hryshko_CV_EN.pdf (188 КБ)
│   └── Viacheslav_Hryshko_CV_DE.pdf (100 КБ)
```

## 🚀 Развёртывание

### GitHub Pages
1. Скопировать все файлы в репозиторий `hryshkode-boop/username.github.io`
2. Убедиться что `/img/` и `/cv/` папки содержат нужные файлы
3. Сделать `git push`
4. Проверить https://hryshko.info

### Локально
```bash
python -m http.server 8000
```
Открыть http://localhost:8000

## 🔍 SEO Оптимизация

- ✅ Canonical URL
- ✅ hreflang теги для UK/EN/DE версий
- ✅ Open Graph / Twitter Card
- ✅ Расширенная JSON-LD schema (Person с credentials)
- ✅ robots.txt и sitemap.xml
- ✅ Optimized Title (с ключевыми словами)

## 📱 Мультиязычность

Сайт поддерживает 3 языка:
- **UA** - Українська (по умолчанию если язык браузера украинский)
- **EN** - English (по умолчанию для остального мира)
- **DE** - Deutsch (если браузер на немецком)

Переключение языка через кнопки в шапке: UA | EN | DE

## 🔒 Безопасность

Добавлены заголовки безопасности:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`

## ⚡ Производительность

- CSS и JS минифицированы
- Webp изображения (fast loading)
- PDF вынесены из HTML (ленивая загрузка)
- Кэширование на 1 год для статических файлов
- Gzip компрессия включена

## 📝 Лицензия

© 2026 Viacheslav Hryshko. All rights reserved.
