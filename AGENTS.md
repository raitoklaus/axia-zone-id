# Repository Guidelines

## Project Overview & Tech Stack

This site is an Astro 7 anime/otaku blog, event schedule, and connected performer/event wiki built on the Firefly theme.

- **Framework**: Astro 7 (`astro.config.mjs`) with Swup page transitions and `@astrojs/mdx`
- **UI & Styling**: Svelte 5 islands, Tailwind CSS 4 (`@tailwindcss/vite`), Stylus (`src/styles/markdown-extend.styl`), and Firefly CSS custom properties (`src/styles/variables.styl`)
- **Language & Quality**: TypeScript (`--isolatedDeclarations`), Biome formatter/linter (tabs for indentation, double quotes for JS/TS strings), and Pagefind static search (`scripts/run-pagefind.ts`)
- **Package Manager**: `pnpm` (enforced by `preinstall` in `package.json`)

## Directory Map

- `src/content.config.ts`: Astro 7 Content Collections definitions (`posts`, `performers`, `events`, `dynamic`, `projects`, `spec`)
- `src/content/posts/`: Blog posts (`*.md`, `*.mdx`)
- `src/content/performers/`: Local performer wiki profiles (`*.md`, `*.mdx`)
- `src/content/events/`: Upcoming and archived event entries (`*.md`, `*.mdx`)
- `src/pages/[...page].astro`: Paginated blog front page with the `UpcomingEventSchedule` section on page 1
- `src/pages/wiki/performers/`: Performer directory (`index.astro`) and profile detail pages (`[slug].astro`)
- `src/pages/wiki/events/`: Event schedule/archive (`index.astro`) and event detail pages (`[slug].astro`)
- `src/components/wiki/UpcomingEventSchedule.astro`: Homepage upcoming event schedule widget
- `src/utils/wiki-utils.ts` & `src/utils/url-utils.ts`: Collection queries, date/status helpers, and route builders
- `src/plugins/remark-wiki-link.js`: Obsidian-style `[[Wiki Links]]` resolver across `posts`, `performers`, and `events`
- `src/config/`: Split site configuration (`siteConfig.ts`, `navBarConfig.ts`, `coverImageConfig.ts`, etc.) with types in `src/types/`
- `public/`: Static assets served verbatim; `src/assets/`: source-managed images optimized at build time

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
| `role` | `string` | Yes | - | Primary role (e.g. `Anisong Vocalist`, `Anikura DJ`) |
| `category` | `string` | No | `""` | Directory filter category (e.g. `Music`, `DJ`, `Cosplay`) |
| `bio` | `string` | No | `""` | Short bio summary |
| `socials` | `{ label, url, icon? }[]` | No | `[]` | External links (`icon` uses Iconify names like `fa7-brands:youtube`) |
| `tags` | `string[]` | No | `[]` | Style or scene tags |
| `avatar` | `string` | No | `""` | Image path/URL; falls back to initials when empty |
| `draft` | `boolean` | No | `false` | Hidden in production builds when `true` |

### `events` (`src/content/events/*.{md,mdx}`)

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `title` | `string` | Yes | - | Event title |
| `startDate` | `date` | Yes | - | `YYYY-MM-DD` (coerced to `Date`) |
| `endDate` | `date` | No | - | Optional end date for multi-day events |
| `venue` | `string` | Yes | - | Venue name |
| `city` | `string` | Yes | - | City name |
| `status` | `enum` | No | `"upcoming"` | `"upcoming" \| "ongoing" \| "completed" \| "cancelled" \| "postponed"` |
| `ticketUrl` | `string` | No | `""` | External ticket/registration URL |
| `lineup` | `reference("performers")[]` | No | `[]` | Array of performer entry IDs (filename slugs without `.md`) |
| `description` | `string` | No | `""` | Short summary |
| `tags` | `string[]` | No | `[]` | Event tags |
| `image` | `string` | No | `""` | Optional banner/poster image |
| `draft` | `boolean` | No | `false` | Hidden in production builds when `true` |

## Cross-Linking Rules

1. **Structured Event Lineups (`reference("performers")`)**:
   - Always link performers to events using `lineup: ["performer-slug"]` in the event's frontmatter.
   - `src/pages/wiki/performers/[slug].astro` automatically queries `events` via `getEventsForPerformer()` to render **Upcoming Appearances** and **Past Appearances**.
   - Events with `status: "completed"` or `"cancelled"`, or dates earlier than the build date, automatically move out of the homepage schedule into past archives.
2. **Inline & Card `[[Wiki Links]]`**:
   - Supported across `posts`, `performers`, and `events` via `src/plugins/remark-wiki-link.js`.
   - Use prefixed paths when possible for clarity: `[[performers/hana-minase]]`, `[[events/axia-winter-live-2026]]`, `[[posts/firefly]]`.
   - Bare slugs like `[[ren-takahashi]]` also resolve if the filename is unique across collections.
   - Add `|Custom Label` for custom inline text, or place `[[...]]` alone on its own paragraph to render a rich link card.

## Standard Commands

- `pnpm dev` or `pnpm start`: Start the local Astro dev server
- `pnpm check`: Run `astro check` diagnostics
- `pnpm type-check`: Run `tsc --noEmit --isolatedDeclarations` (all exported TS symbols must have explicit types)
- `pnpm format`: Format `src` and `scripts` with Biome
- `pnpm lint`: Run Biome checks and safe fixes on `src` and `scripts`
- `pnpm build`: Run asset generators, `astro build --force`, font subsetting, script minification, and Pagefind indexing into `dist/`
- `pnpm preview`: Preview the production build locally
- `pnpm new-post`: Scaffold a new blog post

## Coding & Accessibility Conventions

- Follow Biome formatting (tabs, double quotes). Keep `src/types` aligned with `src/config`.
- Always route internal links through `url()` / `getPerformerUrl()` / `getEventUrl()` with trailing slashes (`trailingSlash: "always"`).
- `MainGridLayout.astro` renders the page `<h1 class="sr-only">`; start visible headings inside pages at `<h2>`.
- Before committing code or content schema changes, run `pnpm check`, `pnpm type-check`, and `pnpm build`.

## Multi-Device Git Hygiene

- Before starting work on any device, sync your branch: `git pull --rebase origin main`
- Upstream Firefly theme updates are tracked on the `upstream` remote (`CuteLeaf/Firefly`); merge or cherry-pick selectively without pushing to `upstream`.
- Use Conventional Commits (`feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`).
- Never commit `.env`, API tokens, personal access tokens, OAuth secrets, or private keys.
- Review generated files (`dist/`, `src/constants/lqips.json`, `src/constants/icons.ts`) before committing.

## Deployment & Online CMS

- **Live Site URL**: `https://raitoklaus.github.io/axia-zone-id/`
- **GitHub Repository**: `https://github.com/raitoklaus/axia-zone-id` (`origin`), tracking Firefly theme updates on `upstream` (`https://github.com/CuteLeaf/Firefly.git`, push disabled).
- **Automated Deployment**: `.github/workflows/deploy.yml` builds with Node.js 22 and pnpm on every push to `main` and deploys `dist/` to GitHub Pages.
  - `src/config/siteConfig.ts` keeps `site_url: "https://raitoklaus.github.io"` (origin only).
  - `astro.config.mjs` sets `BASE_PATH = "/axia-zone-id/"`, passed to `base`, `remarkWikiLink`, and Pagefind (`baseUrl`).
- **Dual Online / Mobile CMS (Swappable Anytime)**:
  - **Pages CMS**: Open `https://app.pagescms.org` on desktop or mobile and connect `raitoklaus/axia-zone-id`. Configured in `.pages.yml` with zero OAuth server needed.
  - **Sveltia CMS**: Open `https://raitoklaus.github.io/axia-zone-id/admin/` (configured in `public/admin/index.html` and `public/admin/config.yml`). Provides searchable `relation` dropdowns for `events.lineup`; sign in directly with a GitHub Personal Access Token (PAT) or add an external OAuth proxy `base_url` later.
  - **Media Uploads**: Both CMSs upload assets to `public/uploads/` and reference them as `/uploads/...` (automatically prefixed with `/axia-zone-id/` at build time).
  - **Cover Image & Raw Markdown Safety**: Leave `image` blank and toggle `useRandomCover: true` for Firefly's random cover API (`resolvePostCoverInput()` in `src/utils/image-utils.ts`). Pages CMS uses raw Markdown code editors and Sveltia CMS defaults to `raw` mode (`modes: ["raw", "rich_text"]`) so `[[Wiki Links]]` and `:::note` / `:::tip` / `> [!NOTE]` admonitions are never bracket-escaped.
