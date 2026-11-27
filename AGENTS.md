# Repository Guidelines

## Project Overview & Tech Stack

**Axia Zone ID** (`https://axia.zone.id/`) is an Astro 7 Indonesian ACG / Jejepangan blog, dedicated Bandung/Jabodetabek-first event schedule, and connected performer/lore wiki built on the Firefly theme (full dual-sidebar widget architecture) paired with a Project SEKAI / Colorful Stage visual aesthetic (`src/styles/axia-theme.css`).

- **Site Identity**: Curated by **Raitoklaus**; part of **Wibu_Baleendah** (`@wibu_baleendah`) and **Hayu UtaOdo** (`@hayu_utaodo`), serving both the Axia community base and character lore.
- **Language Convention (Hybrid)**: Clean English UI chrome (navbar, buttons, filters, stats labels) paired with Bahasa Indonesia editorial copy, announcements, articles, and wiki content. Avoid em dashes (`—`) in user-facing UI/copy.
- **Framework**: Astro 7 (`astro.config.mjs`) with Swup page transitions, `@astrojs/mdx`, and `build: { inlineStylesheets: "always" }` (CSS is inlined into `<head>` so GitHub Pages' 10-minute HTML cache and slower/VPN connections never render stale or unstyled HTML).
- **UI & Styling**: Svelte 5 islands, Tailwind CSS 4 (`@tailwindcss/vite`), Stylus (`src/styles/markdown-extend.styl`), Firefly CSS custom properties (`src/styles/variables.styl`), and Project SEKAI x Axia accents (`src/styles/axia-theme.css`).
- **Language & Quality**: TypeScript (`--isolatedDeclarations`), Biome formatter/linter (tabs for indentation, double quotes for JS/TS strings), and Pagefind static search (`scripts/run-pagefind.ts`).
- **Package Manager**: `pnpm` (enforced by `preinstall` in `package.json`).

## Directory Map

- `src/content.config.ts`: Astro 7 Content Collections definitions (`posts`, `performers`, `events`, `wiki`, `dynamic`, `projects`, `spec`)
- `src/content/posts/`: Blog posts (`*.md`, `*.mdx`)
- `src/content/events/`: Upcoming and archived event entries (`*.md`, `*.mdx`)
- `src/content/wiki/`: Encyclopedia / Wiki Hub articles (`*.md`, `*.mdx`)
- `src/content/performers/`: Performer directory profiles (`*.md`, `*.mdx`)
- `src/pages/[...page].astro`: Paginated blog front page showing `UpcomingEventSchedule` (Kota Bandung + Jabodetabek big events) and optional CMS-toggled `WikiSpotlightSection` (`siteSettings.site.showHomeWikiSpotlight`, default `false`) on page 1
- `src/pages/events/`: Dedicated Event Calendar & Schedule (`index.astro` with List/Calendar view, `localStorage` Saved Events `axia-saved-events-v1`, and Asia/Jakarta `H-X` countdowns) and detail pages (`[slug].astro` with Save button, Google Calendar/`.ics`, Pagefind metadata, and `schema.org/Event` JSON-LD)
- `src/pages/wiki/`: Wiki Hub landing (`index.astro` with category portals, live search, `?category=` query param filtering), Wiki article detail (`[slug].astro`), and Performer directory/detail (`performers/index.astro`, `performers/[slug].astro`)
- `src/pages/wiki/events/`: Static `noindex` redirect pages (`index.astro` -> `/events/`, `[slug].astro` -> `/events/[slug]/`) preserving legacy links
- `src/components/wiki/`: `UpcomingEventSchedule.astro`, `EventCalendarBrowser.svelte`, `WikiSpotlightSection.astro`, `WikiInfobox.astro`, and `WikiBacklinks.astro`
- `src/components/widget/SiteStats.astro`: Sidebar statistics including Posts, Events, Performers, Wiki Articles, and combined last activity date
- `src/pages/og/[...slug].ts`: Build-time 1200x630 Axia OG PNG generator for Posts, Events (`/og/events/<slug>.png`), Wiki (`/og/wiki/<slug>.png`), and Performers (`/og/performers/<slug>.png`)
- `src/utils/wiki-utils.ts` & `src/utils/url-utils.ts`: Collection queries, date/status/countdown helpers, backlink resolver (`getBacklinksForTarget`), and route builders (`url`, `getEventUrl`, `getPerformerUrl`, `getWikiUrl`)
- `src/plugins/remark-wiki-link.js`: Obsidian-style `[[Wiki Links]]` resolver across `posts`, `performers`, `wiki`, and `events`
- `src/config/`: Split site configuration (`siteConfig.ts`, `navBarConfig.ts`, `musicConfig.ts`, `backgroundWallpaper.ts`, etc.) backed by `src/data/siteSettings.json` with types in `src/types/`
- `public/`: Static assets served verbatim (`public/favicon/axia-{32,180,192}.png`, `public/assets/images/partners/`, `public/gallery/axia-showcase/`); `src/assets/`: source-managed images optimized at build time

## Top Navbar Architecture

Configured in `src/config/navBarConfig.ts` with 5 public top-level slots:
- `Home` (`/`)
- `Events` (`/events/`)
- `Wiki` dropdown (`Wiki Hub`, `Performers`, `Event Series & EO`, `Axia Lore`, `ACG Scene`, `Communities`)
- `Articles` dropdown (`Archive`, `Categories`, `Tags`, `Series`)
- `More` dropdown (`Moments`, `Gallery`, `Friends`, `Bookmark Nav`, `Projects`, `Guestbook`, `About`) — admin/repo links (`Sveltia CMS`, `Pages CMS`, `GitHub`) stay in Footer/Bookmarks, not the navbar dropdown

## Content Frontmatter Schemas

All schemas live in `src/content.config.ts`.

### `posts` (`src/content/posts/*.{md,mdx}`)

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `title` | `string` | Yes | - | Post headline |
| `published` | `date` | Yes | - | `YYYY-MM-DD` |
| `updated` | `date` | No | - | Last edited date |
| `description` | `string` | No | `""` | Summary shown on cards & meta |
| `image` | `string` | No | `""` | Local relative path, `/public` path, URL, or `"api"` |
| `useRandomCover` | `boolean` | No | `false` | When `true` and `image` is empty, falls back to `"api"` random cover |
| `tags` | `string[]` | No | `[]` | Tag list |
| `category` | `string \| null` | No | `""` | Single category |
| `draft` | `boolean` | No | `false` | Hidden in production builds when `true` |
| `lang` | `string` | No | `""` | Optional post language override |
| `pinned` | `boolean` | No | `false` | Pins post to top of list |
| `comment` | `boolean` | No | `true` | Enables comment widget |
| `series` / `seriesOrder` | `string` / `number` | No | `""` / - | Series grouping and order |
| `password` / `passwordHint` | `string` | No | `""` | Optional encrypted post settings |

### `performers` (`src/content/performers/*.{md,mdx}`)

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `name` | `string` | Yes | - | Display name |
| `role` | `string` | Yes | - | Primary role description |
| `category` | `enum` | No | `""` | Curated categories: `Anisong Vocalist`, `Band`, `Chika Idol`, `Fandom Idol`, `Anikura DJ`, `Collective Group`, `Cosplayer`, `Creator / Other` |
| `aliases` | `string[]` | No | `[]` | Alternate stage names |
| `city` | `string` | No | `""` | Base city |
| `activeYears` | `string` | No | `""` | Active period (e.g. `"2022 - Present"`) |
| `affiliation` | `string` | No | `""` | Group / collective / community affiliation |
| `status` | `string` | No | `"Active"` | Activity status |
| `bio` | `string` | No | `""` | Short bio summary |
| `avatar` | `string` | No | `""` | Image path/URL (resolved via `ImageWrapper` in Infobox); falls back to initials when empty |
| `infobox` | `{ label, value }[]` | No | `[]` | Extra Infobox rows |
| `socials` | `{ label, url, icon? }[]` | No | `[]` | External links (`icon` uses Iconify names like `fa7-brands:youtube`) |
| `tags` | `string[]` | No | `[]` | Style or scene tags |
| `draft` | `boolean` | No | `false` | Hidden in production builds when `true` |

### `wiki` (`src/content/wiki/*.{md,mdx}`)

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `title` | `string` | Yes | - | Wiki article headline |
| `category` | `enum` | Yes | `"ACG & Jejepangan Scene"` | `"Event Series & Organizers" \| "Axia Lore & Community" \| "ACG & Jejepangan Scene" \| "Communities & Circles"` |
| `summary` | `string` | No | `""` | Concise intro shown on Wiki Hub & Infobox |
| `aliases` | `string[]` | No | `[]` | Alternate names |
| `city` | `string` | No | `""` | City / geographic scope |
| `status` | `string` | No | `"Active"` | Status label |
| `founded` | `string` | No | `""` | Founded year / era |
| `updated` | `date` | No | - | `YYYY-MM-DD`; included in sidebar `SiteStats` Last Update |
| `featured` | `boolean` | No | `false` | Prioritized on Wiki Hub & `WikiSpotlightSection` |
| `image` | `string` | No | `""` | Emblem / image (`assets/...`, `/uploads/...`, or URL) |
| `infobox` | `{ label, value }[]` | No | `[]` | Custom key/value Infobox rows |
| `links` | `{ label, url, icon? }[]` | No | `[]` | External social/community links |
| `tags` | `string[]` | No | `[]` | Wiki topic tags |
| `draft` | `boolean` | No | `false` | Hidden in production builds when `true` |

### `events` (`src/content/events/*.{md,mdx}`)

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `title` | `string` | Yes | - | Event title |
| `startDate` | `date` | Yes | - | `YYYY-MM-DD` (coerced to `Date`) |
| `endDate` | `date` | No | - | Optional end date for multi-day events |
| `venue` | `string` | Yes | - | Venue name |
| `city` | `string` | Yes | - | City name |
| `region` | `enum` | No | `""` | `Jabodetabek`, `Jawa Barat`, `Jawa Tengah & DIY`, `Jawa Timur`, `Bali & Nusa Tenggara`, `Sumatera`, `Kalimantan`, `Sulawesi`, `Maluku & Papua`, `Online` |
| `eventType` | `enum` | No | `""` | `Convention / Expo`, `Matsuri / Bunkasai`, `Idol / Anisong Live`, `Anikura / DJ Night`, `Cosplay Event`, `Doujin / Creator Market`, `Community Gathering` |
| `entryType` | `enum` | No | `"tba"` | `"free" \| "paid" \| "tba"` |
| `htm` | `string` | No | `""` | Freeform ticket price / admission label (e.g. `"Free Entry"`, `"Rp 50.000"`) |
| `time` | `string` | No | `""` | Open gate / event hours (e.g. `"10:00 - 21:00"`) |
| `timezone` | `enum` | No | `"WIB"` | `"WIB" \| "WITA" \| "WIT"` |
| `organizer` | `string` | No | `""` | Event Organizer (EO) name |
| `instagram` | `string` | No | `""` | `@handle` or full Instagram URL |
| `officialUrl` | `string` | No | `""` | Official info or registration URL |
| `mapsUrl` | `string` | No | `""` | Google Maps link |
| `highlights` | `string[]` | No | `[]` | Activity highlights (e.g. `Coswalk`, `Artist Alley`, `Idol Stage`) |
| `status` | `enum` | No | `"upcoming"` | `"upcoming" \| "ongoing" \| "completed" \| "cancelled" \| "postponed"` |
| `ticketUrl` | `string` | No | `""` | External ticket/registration URL |
| `lineup` | `reference("performers")[]` | No | `[]` | Array of performer entry IDs (filename slugs without `.md`) |
| `description` | `string` | No | `""` | Short summary |
| `tags` | `string[]` | No | `[]` | Event tags |
| `image` | `string` | No | `""` | Optional banner/poster image |
| `draft` | `boolean` | No | `false` | Hidden in production builds when `true` |

## Cross-Linking Rules

1. **Structured Event Lineups (`reference("performers")`)**:
   - Link performers to events using `lineup: ["performer-slug"]` in the event's frontmatter.
   - `src/pages/wiki/performers/[slug].astro` queries `events` via `getEventsForPerformer()` to render **Upcoming Appearances** and **Past Appearances**.
   - Events with `status: "completed"` or `"cancelled"`, or dates earlier than the build date, automatically move out of the homepage schedule into past archives.
2. **Inline & Card `[[Wiki Links]]`**:
   - Supported across `posts`, `performers`, `wiki`, and `events` via `src/plugins/remark-wiki-link.js`.
   - Prefer prefixed paths: `[[performers/hana-minase]]`, `[[wiki/axia-base-and-lore]]`, `[[events/axia-winter-live-2026]]`, `[[posts/axia-zone-feature-showcase]]`.
   - Bare slugs like `[[ren-takahashi]]` also resolve if the filename is unique across collections; `[[wiki/events/<slug>]]` aliases automatically to `/events/<slug>/`.
   - Add `|Custom Label` for custom inline text, or place `[[...]]` alone on its own paragraph to render a rich link card.
3. **Automatic Backlinks ("Referenced By")**:
   - `getBacklinksForTarget(collection, id)` in `src/utils/wiki-utils.ts` scans lineups and `[[...]]` links across `events`, `wiki`, `performers`, and `posts`, rendered automatically on Wiki and Performer detail pages by `WikiBacklinks.astro`.

## Standard Commands

- `pnpm dev` or `pnpm start`: Start the local Astro dev server
- `pnpm check`: Run `astro check` diagnostics
- `pnpm type-check`: Run `tsc --noEmit --isolatedDeclarations` (all exported TS symbols must have explicit types)
- `pnpm format`: Format `src` and `scripts` with Biome
- `pnpm lint`: Run Biome checks and safe fixes on `src` and `scripts`
- `pnpm build`: Run asset generators, `astro build --force`, font subsetting, script minification, and Pagefind indexing into `dist/`
- `pnpm preview`: Preview the production build locally
- `pnpm new-post`: Scaffold a new blog post
- **Windows PowerShell Note**: If ExecutionPolicy or `.npmrc` `manage-package-manager-versions` shim fails on another Windows machine, invoke pnpm via:
  `$env:npm_config_manage_package_manager_versions='false'; pnpm.cmd <command>`

## Coding, Architecture & Search Conventions

- Follow Biome formatting (tabs, double quotes). Keep `src/types` aligned with `src/config`.
- Always route internal links through `url()` / `getPerformerUrl()` / `getEventUrl()` / `getWikiUrl()` with trailing slashes (`trailingSlash: "always"`).
- `MainGridLayout.astro` renders the page `<h1 class="sr-only">`; start visible headings inside pages at `<h2>`.
- **Do NOT pass `postSlug` on non-post pages** (`MainGridLayout.astro` treats `isPostPage = !!postSlug`). Use `ogImagePath="/og/<type>/<slug>.png"` instead for Event/Wiki/Performer OG preview cards.
- **Avoid nested `data-pagefind-body` roots**: When putting `data-pagefind-body` on an outer `<article>` (`events/[slug].astro`, `wiki/[slug].astro`, `performers/[slug].astro`), pass `pagefindBody={false}` to `<Markdown>` and mark navigation breadcrumbs, action toolbars, and `WikiBacklinks` with `data-pagefind-ignore`.
- **Asset resolution inside reusable Wiki components**: Use `<ImageWrapper>` so both Vite-bundled `src/assets/...` paths and public CMS `/uploads/...` paths work cleanly.
- Before committing code or content schema changes, run `pnpm check`, `pnpm type-check`, and `pnpm build`.

## Multi-Device Git Hygiene

- Before starting work on any device, sync your branch: `git pull --rebase origin main`
- Upstream Firefly theme updates are tracked on the `upstream` remote (`CuteLeaf/Firefly`); merge or cherry-pick selectively without pushing to `upstream`.
- Use Conventional Commits (`feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`).
- Never commit `.env`, API tokens, personal access tokens, OAuth secrets, or private keys.
- Review generated files (`dist/`, `src/constants/lqips.json`, `src/constants/icons.ts`) before committing (`dist/` is gitignored).

## Deployment & Online CMS

- **Live Site URL**: `https://axia.zone.id/` (`public/CNAME` sets `axia.zone.id`)
- **GitHub Repository**: `https://github.com/raitoklaus/axia-zone-id` (`origin`), tracking Firefly theme updates on `upstream` (`https://github.com/CuteLeaf/Firefly.git`, push disabled).
- **Automated Deployment**: `.github/workflows/deploy.yml` builds with Node.js 22 and pnpm on every push to `main` and via a daily `0 17 * * *` UTC cron (00:00 WIB) to keep upcoming/past event rollovers fresh, deploying `dist/` to GitHub Pages.
  - `src/config/siteConfig.ts` sets `site_url: "https://axia.zone.id"`.
  - `astro.config.mjs` sets `BASE_PATH = "/"`, passed to `base`, `remarkWikiLink`, and Pagefind (`baseUrl`), and keeps `build: { inlineStylesheets: "always" }`.
- **Dual Online / Mobile CMS (Swappable Anytime)**:
  - **Pages CMS**: Open `https://app.pagescms.org` on desktop or mobile and connect `raitoklaus/axia-zone-id`. Configured in `.pages.yml` with zero OAuth server needed.
  - **Sveltia CMS**: Open `https://axia.zone.id/admin/` (configured in `public/admin/index.html`, `public/admin/config.yml`, `public/admin/wp-theme.css`, `public/admin/wp-preview.css`, and `public/admin/wp-editor.js`). Styled like the WordPress Admin dashboard and editor, with custom block inserters (`Wiki Link Card`, `Callout Box`, `Spoiler Text`, `Image Gallery Grid`, `GitHub Repository Card`, `YouTube Embed`, `Mermaid Diagram`), live preview templates (`Live Draft` + `Published Site (1:1)`), and searchable `relation` dropdowns for `events.lineup`; sign in directly with a GitHub Personal Access Token (PAT) or add an external OAuth proxy `base_url` later.
  - **CMS Coverage & Site Settings**: Both `.pages.yml` and `public/admin/config.yml` cover `posts`, `events`, `wiki`, `performers` (including Infobox fields and 8 curated categories), `pages` (`src/content/spec/about.md`, `src/content/spec/guestbook.md`), `dynamic` (`Moments`), `projects` (`Projects`), and `src/data/siteSettings.json` (site identity, `site.showHomeWikiSpotlight` homepage Wiki Spotlight toggle, page toggles, hero wallpapers, music player mode/playlist, profile, friends, booknav, gallery albums, and sponsor settings).
  - **Media Uploads**: Both CMSs upload assets to `public/uploads/` and reference them as `/uploads/...` (served directly from `/uploads/...` at the root domain).
  - **Cover Image & Raw Markdown Safety**: Leave `image` blank and toggle `useRandomCover: true` for Firefly's random cover API (`resolvePostCoverInput()` in `src/utils/image-utils.ts`). Pages CMS uses raw Markdown code editors, while Sveltia CMS defaults to `rich_text` with the WordPress-style formatting toolbar + block inserter and a 1-click toggle to `raw` Markdown mode.
