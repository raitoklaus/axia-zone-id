import { spawn, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import matter from "gray-matter";
import sharp from "sharp";
import type { Plugin, ViteDevServer } from "vite";

const localReq = createRequire(import.meta.url);
const matterReq = createRequire(localReq.resolve("gray-matter"));
const yamlLib = matterReq("js-yaml") as {
	load: (input: string) => unknown;
	dump: (data: unknown, options?: { lineWidth?: number }) => string;
};

const MATTER_OPTIONS = {
	engines: {
		yaml: {
			parse: (str: string): Record<string, unknown> => {
				const parsed = yamlLib.load(str);
				return parsed && typeof parsed === "object" && !Array.isArray(parsed)
					? (parsed as Record<string, unknown>)
					: {};
			},
			stringify: (obj: Record<string, unknown>): string =>
				yamlLib.dump(obj, { lineWidth: -1 }),
		},
	},
};

const ROOT_DIR = process.cwd();
const STUDIO_CLIENT_DIR = path.resolve(ROOT_DIR, "studio/client");
const SETTINGS_FILE = path.resolve(ROOT_DIR, "src/data/siteSettings.json");
const CONTENT_DIR = path.resolve(ROOT_DIR, "src/content");
const UPLOADS_DIR = path.resolve(ROOT_DIR, "public/uploads");
const PUBLIC_DIR = path.resolve(ROOT_DIR, "public");
const SRC_ASSETS_DIR = path.resolve(ROOT_DIR, "src/assets/images");

const COLLECTIONS = [
	"posts",
	"events",
	"wiki",
	"performers",
	"dynamic",
	"projects",
	"spec",
] as const;

type CollectionName = (typeof COLLECTIONS)[number];

const IMAGE_EXTENSIONS = new Set([
	".webp",
	".png",
	".jpg",
	".jpeg",
	".gif",
	".avif",
	".svg",
]);

const CONTENT_EXTENSIONS = /\.(?:md|mdx)$/i;

function isAllowedCollection(value: string): value is CollectionName {
	return (COLLECTIONS as readonly string[]).includes(value);
}

function sendJson(
	res: ServerResponse,
	statusCode: number,
	payload: unknown,
): void {
	res.statusCode = statusCode;
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.setHeader("Cache-Control", "no-store");
	res.end(JSON.stringify(payload));
}

function sendFile(
	res: ServerResponse,
	filePath: string,
	contentType: string,
): void {
	if (!existsSync(filePath)) {
		res.statusCode = 404;
		res.end("Not Found");
		return;
	}
	res.statusCode = 200;
	res.setHeader("Content-Type", contentType);
	res.setHeader("Cache-Control", "no-store");
	res.end(readFileSync(filePath));
}

function isLocalHostRequest(req: IncomingMessage): boolean {
	const rawHost = String(req.headers.host || "").toLowerCase();
	const hostname = rawHost.startsWith("[")
		? rawHost.slice(0, rawHost.indexOf("]") + 1)
		: (rawHost.split(":")[0] ?? "");
	return (
		hostname === "localhost" ||
		hostname === "127.0.0.1" ||
		hostname === "[::1]" ||
		hostname === "::1"
	);
}

function isSameOriginMutation(req: IncomingMessage): boolean {
	const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
	if (fetchSite && fetchSite === "cross-site") {
		return false;
	}
	return true;
}

async function readJsonBody(
	req: IncomingMessage,
	maxBytes = 20 * 1024 * 1024,
): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let total = 0;
		req.on("data", (chunk: Buffer) => {
			total += chunk.length;
			if (total > maxBytes) {
				reject(new Error("Request body too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			try {
				const raw = Buffer.concat(chunks).toString("utf8");
				const parsed = raw.trim() ? JSON.parse(raw) : {};
				if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
					reject(new Error("Expected JSON object body"));
					return;
				}
				resolve(parsed as Record<string, unknown>);
			} catch (err) {
				reject(err);
			}
		});
		req.on("error", reject);
	});
}

function formatDateValue(value: unknown, preserveTime = false): unknown {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		if (
			preserveTime &&
			(value.getUTCHours() !== 0 ||
				value.getUTCMinutes() !== 0 ||
				value.getUTCSeconds() !== 0)
		) {
			return value.toISOString().slice(0, 19);
		}
		return value.toISOString().slice(0, 10);
	}
	if (Array.isArray(value)) {
		return value.map((item) => formatDateValue(item, preserveTime));
	}
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) {
			out[k] = formatDateValue(v, preserveTime);
		}
		return out;
	}
	return value;
}

function normalizeDateFieldsForWrite(
	data: Record<string, unknown>,
	collection: CollectionName,
): Record<string, unknown> {
	const clone: Record<string, unknown> = {};
	const dateKeys = new Set(["published", "updated", "startDate", "endDate"]);
	for (const [key, val] of Object.entries(data)) {
		if (val === undefined) continue;
		if (dateKeys.has(key) && typeof val === "string") {
			const trimmed = val.trim();
			if (!trimmed) {
				continue;
			}
			if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
				clone[key] = new Date(`${trimmed}T00:00:00.000Z`);
				continue;
			}
			if (
				collection === "dynamic" &&
				/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(trimmed)
			) {
				const withSec = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
				clone[key] = new Date(`${withSec}.000Z`);
				continue;
			}
		}
		clone[key] = val;
	}
	return clone;
}

function getRouteForEntry(collection: CollectionName, slug: string): string {
	switch (collection) {
		case "posts":
			return `/posts/${slug}/`;
		case "events":
			return `/events/${slug}/`;
		case "wiki":
			return `/wiki/${slug}/`;
		case "performers":
			return `/wiki/performers/${slug}/`;
		case "dynamic":
			return "/dynamic/";
		case "projects":
			return `/projects/${slug}/`;
		case "spec":
			return `/${slug}/`;
	}
}

function resolveContentFile(
	collection: CollectionName,
	slug: string,
): { filePath: string; ext: ".md" | ".mdx" } | null {
	const safeSlug = slug
		.trim()
		.replaceAll("\\", "/")
		.replace(/^\/+|\/+$/g, "");
	if (!safeSlug || safeSlug.includes("..")) {
		return null;
	}
	const collectionDir = path.resolve(CONTENT_DIR, collection);
	for (const ext of [".mdx", ".md"] as const) {
		const candidate = path.resolve(collectionDir, `${safeSlug}${ext}`);
		if (!candidate.startsWith(collectionDir + path.sep)) {
			return null;
		}
		if (existsSync(candidate) && statSync(candidate).isFile()) {
			return { filePath: candidate, ext };
		}
	}
	return null;
}

function scanContentCollection(collection: CollectionName): Array<{
	collection: CollectionName;
	slug: string;
	fileName: string;
	ext: string;
	title: string;
	subtitle: string;
	status: string;
	draft: boolean;
	date: string;
	route: string;
}> {
	const dir = path.resolve(CONTENT_DIR, collection);
	if (!existsSync(dir)) return [];

	const items: Array<{
		collection: CollectionName;
		slug: string;
		fileName: string;
		ext: string;
		title: string;
		subtitle: string;
		status: string;
		draft: boolean;
		date: string;
		route: string;
	}> = [];

	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isFile() || !CONTENT_EXTENSIONS.test(entry.name)) continue;
		const fullPath = path.join(dir, entry.name);
		const ext = path.extname(entry.name);
		const slug = entry.name.slice(0, -ext.length);
		try {
			const parsed = matter(readFileSync(fullPath, "utf8"), MATTER_OPTIONS);
			const data = formatDateValue(
				parsed.data,
				collection === "dynamic",
			) as Record<string, unknown>;
			const title = String(
				data.title ||
					data.name ||
					(collection === "dynamic" ? `Moment (${slug})` : slug),
			);
			const subtitle = String(
				data.description ||
					data.summary ||
					data.bio ||
					data.role ||
					data.venue ||
					"",
			).slice(0, 120);
			const status = String(data.status || data.category || "");
			const date = String(
				data.startDate || data.published || data.updated || "",
			);
			items.push({
				collection,
				slug,
				fileName: entry.name,
				ext,
				title,
				subtitle,
				status,
				draft: Boolean(data.draft),
				date,
				route: getRouteForEntry(collection, slug),
			});
		} catch {
			// Skip unreadable entries
		}
	}

	items.sort((a, b) => a.title.localeCompare(b.title));
	return items;
}

function sanitizeSlug(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function getStarterEntry(
	collection: CollectionName,
	title: string,
): { ext: ".md" | ".mdx"; data: Record<string, unknown>; body: string } {
	const today = new Date().toISOString().slice(0, 10);
	switch (collection) {
		case "posts":
			return {
				ext: ".mdx",
				data: {
					title,
					published: today,
					description: "",
					image: "",
					useRandomCover: false,
					tags: [],
					category: "",
					draft: false,
					lang: "id",
					pinned: false,
					comment: true,
				},
				body: `\n## ${title}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n`,
			};
		case "events":
			return {
				ext: ".md",
				data: {
					title,
					startDate: today,
					venue: "TBA",
					city: "Kota Bandung",
					region: "Jawa Barat",
					eventType: "Matsuri / Bunkasai",
					entryType: "tba",
					htm: "TBA",
					time: "10:00 - 21:00",
					timezone: "WIB",
					organizer: "",
					instagram: "",
					officialUrl: "",
					mapsUrl: "",
					highlights: [],
					status: "upcoming",
					majorEvent: false,
					ticketUrl: "",
					lineup: [],
					description: "",
					tags: ["Bandung"],
					image: "",
					draft: false,
				},
				body: "\n## Event Details\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n",
			};
		case "wiki":
			return {
				ext: ".md",
				data: {
					title,
					category: "ACG & Jejepangan Scene",
					summary: "",
					aliases: [],
					city: "Kota Bandung",
					status: "Active",
					founded: "",
					infobox: [],
					links: [],
					tags: [],
					image: "",
					updated: today,
					featured: false,
					draft: false,
				},
				body: "\n## Overview\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n",
			};
		case "performers":
			return {
				ext: ".md",
				data: {
					name: title,
					role: "Anisong Vocalist",
					category: "Anisong Vocalist",
					bio: "",
					aliases: [],
					city: "Kota Bandung",
					activeYears: "",
					affiliation: "",
					status: "Active",
					infobox: [],
					socials: [],
					tags: [],
					avatar: "",
					draft: false,
				},
				body: "\n## Profile\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n",
			};
		case "dynamic":
			return {
				ext: ".md",
				data: {
					published: `${today}T12:00:00`,
					pinned: false,
					location: "Kota Bandung, Indonesia",
				},
				body: `\n${title}\n`,
			};
		case "projects":
			return {
				ext: ".md",
				data: {
					title,
					published: today,
					draft: false,
					order: 50,
					description: "",
					image: "",
					tags: [],
					link: [],
					status: "active",
					lang: "id",
				},
				body: `\n## ${title}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n`,
			};
		case "spec":
			return {
				ext: ".md",
				data: { title, description: "" },
				body: `\n## ${title}\n`,
			};
	}
}

type MediaItem = {
	folder: string;
	name: string;
	valuePath: string;
	previewUrl: string;
	sizeBytes: number;
};

function scanMediaFiles(): MediaItem[] {
	const results: MediaItem[] = [];
	const roots: Array<{
		folder: string;
		absDir: string;
		kind: "src" | "public";
		relBase: string;
	}> = [
		{
			folder: "DesktopWallpaper",
			absDir: path.join(SRC_ASSETS_DIR, "DesktopWallpaper"),
			kind: "src",
			relBase: "assets/images/DesktopWallpaper",
		},
		{
			folder: "MobileWallpaper",
			absDir: path.join(SRC_ASSETS_DIR, "MobileWallpaper"),
			kind: "src",
			relBase: "assets/images/MobileWallpaper",
		},
		{
			folder: "RootAssets",
			absDir: SRC_ASSETS_DIR,
			kind: "src",
			relBase: "assets/images",
		},
		{
			folder: "gallery/axia-showcase",
			absDir: path.join(PUBLIC_DIR, "gallery/axia-showcase"),
			kind: "public",
			relBase: "/gallery/axia-showcase",
		},
		{
			folder: "gallery/axia-wallpapers",
			absDir: path.join(PUBLIC_DIR, "gallery/axia-wallpapers"),
			kind: "public",
			relBase: "/gallery/axia-wallpapers",
		},
		{
			folder: "uploads",
			absDir: UPLOADS_DIR,
			kind: "public",
			relBase: "/uploads",
		},
	];

	for (const group of roots) {
		if (!existsSync(group.absDir)) continue;
		for (const entry of readdirSync(group.absDir, { withFileTypes: true })) {
			if (!entry.isFile()) continue;
			const ext = path.extname(entry.name).toLowerCase();
			if (!IMAGE_EXTENSIONS.has(ext)) continue;
			const absFile = path.join(group.absDir, entry.name);
			const sizeBytes = statSync(absFile).size;
			const valuePath = `${group.relBase}/${entry.name}`;
			const previewUrl =
				group.kind === "public"
					? valuePath
					: `/__studio/api/media/file?p=${encodeURIComponent(`src/${valuePath}`)}`;
			results.push({
				folder: group.folder,
				name: entry.name,
				valuePath,
				previewUrl,
				sizeBytes,
			});
		}
	}

	return results;
}

function getContentTypeForExt(ext: string): string {
	switch (ext.toLowerCase()) {
		case ".webp":
			return "image/webp";
		case ".png":
			return "image/png";
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		case ".gif":
			return "image/gif";
		case ".avif":
			return "image/avif";
		case ".svg":
			return "image/svg+xml";
		default:
			return "application/octet-stream";
	}
}

function resolveGitBinary(): string | null {
	const onPath = spawnSync("git", ["--version"], {
		encoding: "utf8",
		shell: false,
	});
	if (onPath.status === 0) {
		return "git";
	}
	const localAppData = process.env.LOCALAPPDATA;
	if (localAppData) {
		const ghDesktopDir = path.join(localAppData, "GitHubDesktop");
		if (existsSync(ghDesktopDir)) {
			for (const entry of readdirSync(ghDesktopDir, { withFileTypes: true })) {
				if (!entry.isDirectory() || !entry.name.startsWith("app-")) continue;
				const candidate = path.join(
					ghDesktopDir,
					entry.name,
					"resources/app/git/cmd/git.exe",
				);
				if (existsSync(candidate)) {
					return candidate;
				}
			}
		}
	}
	return null;
}

function runCommand(
	cmd: string,
	args: string[],
	useShell: boolean,
): Promise<{ ok: boolean; code: number; output: string; durationMs: number }> {
	const start = Date.now();
	return new Promise((resolve) => {
		const child = spawn(cmd, args, {
			cwd: ROOT_DIR,
			shell: useShell,
			env: process.env,
		});
		const chunks: string[] = [];
		child.stdout?.on("data", (d: Buffer) => chunks.push(d.toString("utf8")));
		child.stderr?.on("data", (d: Buffer) => chunks.push(d.toString("utf8")));
		child.on("close", (code) => {
			resolve({
				ok: code === 0,
				code: code ?? 1,
				output: chunks.join(""),
				durationMs: Date.now() - start,
			});
		});
		child.on("error", (err) => {
			resolve({
				ok: false,
				code: 1,
				output: err.message,
				durationMs: Date.now() - start,
			});
		});
	});
}

function serializeEntry(
	data: Record<string, unknown>,
	body: string,
	collection: CollectionName,
): string {
	const cleanData = normalizeDateFieldsForWrite(data, collection);
	const cleanBody = body.replace(/^\r?\n/, "");
	return matter.stringify(cleanBody, cleanData, MATTER_OPTIONS);
}

/**
 * Dev-only Vite middleware plugin exposing the Axia Local Live Studio at /__studio/.
 */
export function axiaStudioPlugin(): Plugin {
	return {
		name: "axia-local-studio",
		apply: "serve",
		configureServer(server: ViteDevServer): void {
			server.httpServer?.once("listening", () => {
				const addr = server.httpServer?.address();
				const port = typeof addr === "object" && addr ? addr.port : 4321;
				console.log(`  ┃ Studio   http://localhost:${port}/__studio/`);
			});

			server.middlewares.use(
				"/__studio",
				async (
					req: IncomingMessage,
					res: ServerResponse,
					next: () => void,
				): Promise<void> => {
					if (!isLocalHostRequest(req)) {
						sendJson(res, 403, { error: "Localhost access only" });
						return;
					}

					const reqUrl = new URL(req.url || "/", "http://localhost");
					const pathname = reqUrl.pathname;
					const method = (req.method || "GET").toUpperCase();

					if (
						pathname.startsWith("/api/") &&
						method !== "GET" &&
						!isSameOriginMutation(req)
					) {
						sendJson(res, 403, { error: "Cross-site mutation rejected" });
						return;
					}

					try {
						// Static Studio assets
						if (method === "GET" && (pathname === "/" || pathname === "")) {
							sendFile(
								res,
								path.join(STUDIO_CLIENT_DIR, "index.html"),
								"text/html; charset=utf-8",
							);
							return;
						}
						if (method === "GET" && pathname === "/studio.css") {
							sendFile(
								res,
								path.join(STUDIO_CLIENT_DIR, "studio.css"),
								"text/css; charset=utf-8",
							);
							return;
						}
						if (method === "GET" && pathname === "/studio.js") {
							sendFile(
								res,
								path.join(STUDIO_CLIENT_DIR, "studio.js"),
								"application/javascript; charset=utf-8",
							);
							return;
						}
						if (method === "GET" && pathname === "/bridge.js") {
							sendFile(
								res,
								path.join(STUDIO_CLIENT_DIR, "bridge.js"),
								"application/javascript; charset=utf-8",
							);
							return;
						}

						// Settings API
						if (pathname === "/api/settings" && method === "GET") {
							const parsed = JSON.parse(readFileSync(SETTINGS_FILE, "utf8"));
							sendJson(res, 200, parsed);
							return;
						}
						if (pathname === "/api/settings" && method === "PUT") {
							const body = await readJsonBody(req);
							writeFileSync(
								SETTINGS_FILE,
								`${JSON.stringify(body, null, "\t")}\n`,
								"utf8",
							);
							sendJson(res, 200, { ok: true });
							return;
						}

						// Content List API
						if (pathname === "/api/content" && method === "GET") {
							const requested = reqUrl.searchParams.get("collection");
							if (requested) {
								if (!isAllowedCollection(requested)) {
									sendJson(res, 400, { error: "Invalid collection" });
									return;
								}
								sendJson(res, 200, {
									collection: requested,
									items: scanContentCollection(requested),
								});
								return;
							}
							const all: Record<
								string,
								ReturnType<typeof scanContentCollection>
							> = {};
							for (const col of COLLECTIONS) {
								all[col] = scanContentCollection(col);
							}
							sendJson(res, 200, { collections: all });
							return;
						}

						// Single Content Entry API
						if (pathname === "/api/content/entry" && method === "GET") {
							const col = reqUrl.searchParams.get("collection") || "";
							const slug = reqUrl.searchParams.get("slug") || "";
							if (!isAllowedCollection(col)) {
								sendJson(res, 400, { error: "Invalid collection" });
								return;
							}
							const resolved = resolveContentFile(col, slug);
							if (!resolved) {
								sendJson(res, 404, { error: "Entry not found" });
								return;
							}
							const raw = readFileSync(resolved.filePath, "utf8");
							const parsed = matter(raw, MATTER_OPTIONS);
							const data = formatDateValue(
								parsed.data,
								col === "dynamic",
							) as Record<string, unknown>;
							sendJson(res, 200, {
								collection: col,
								slug,
								ext: resolved.ext,
								route: getRouteForEntry(col, slug),
								data,
								body: parsed.content.replace(/^\r?\n/, ""),
								raw,
							});
							return;
						}

						if (pathname === "/api/content/entry" && method === "PUT") {
							const payload = await readJsonBody(req);
							const col = String(payload.collection || "");
							const slug = String(payload.slug || "");
							if (!isAllowedCollection(col)) {
								sendJson(res, 400, { error: "Invalid collection" });
								return;
							}
							const resolved = resolveContentFile(col, slug);
							if (!resolved) {
								sendJson(res, 404, { error: "Entry not found" });
								return;
							}
							let nextText: string;
							if (typeof payload.raw === "string") {
								nextText = payload.raw;
							} else {
								const data =
									payload.data && typeof payload.data === "object"
										? (payload.data as Record<string, unknown>)
										: {};
								const body =
									typeof payload.body === "string" ? payload.body : "";
								nextText = serializeEntry(data, body, col);
							}
							writeFileSync(resolved.filePath, nextText, "utf8");
							sendJson(res, 200, {
								ok: true,
								route: getRouteForEntry(col, slug),
							});
							return;
						}

						if (pathname === "/api/content/entry" && method === "POST") {
							const payload = await readJsonBody(req);
							const col = String(payload.collection || "");
							const rawSlug = String(payload.slug || payload.title || "");
							const title = String(payload.title || rawSlug).trim();
							if (!isAllowedCollection(col) || col === "spec") {
								sendJson(res, 400, { error: "Cannot create in collection" });
								return;
							}
							const slug = sanitizeSlug(rawSlug);
							if (!slug) {
								sendJson(res, 400, { error: "Invalid slug" });
								return;
							}
							if (resolveContentFile(col, slug)) {
								sendJson(res, 409, { error: "Entry slug already exists" });
								return;
							}
							const starter = getStarterEntry(col, title || slug);
							const dir = path.resolve(CONTENT_DIR, col);
							mkdirSync(dir, { recursive: true });
							const targetFile = path.resolve(dir, `${slug}${starter.ext}`);
							if (!targetFile.startsWith(dir + path.sep)) {
								sendJson(res, 400, { error: "Invalid path" });
								return;
							}
							writeFileSync(
								targetFile,
								serializeEntry(starter.data, starter.body, col),
								"utf8",
							);
							sendJson(res, 201, {
								ok: true,
								collection: col,
								slug,
								route: getRouteForEntry(col, slug),
							});
							return;
						}

						if (pathname === "/api/content/entry" && method === "DELETE") {
							const col = reqUrl.searchParams.get("collection") || "";
							const slug = reqUrl.searchParams.get("slug") || "";
							if (!isAllowedCollection(col) || col === "spec") {
								sendJson(res, 403, { error: "Deletion not allowed" });
								return;
							}
							const resolved = resolveContentFile(col, slug);
							if (!resolved) {
								sendJson(res, 404, { error: "Entry not found" });
								return;
							}
							unlinkSync(resolved.filePath);
							sendJson(res, 200, { ok: true });
							return;
						}

						// Media API
						if (pathname === "/api/media" && method === "GET") {
							sendJson(res, 200, { items: scanMediaFiles() });
							return;
						}

						if (pathname === "/api/media/file" && method === "GET") {
							const rel = String(reqUrl.searchParams.get("p") || "");
							const normalized = path.posix.normalize(
								rel.replaceAll("\\", "/"),
							);
							const allowed =
								normalized.startsWith("src/assets/images/") ||
								normalized.startsWith("public/");
							if (!allowed || normalized.includes("..")) {
								sendJson(res, 403, { error: "Access denied" });
								return;
							}
							const absFile = path.resolve(ROOT_DIR, normalized);
							if (
								!absFile.startsWith(SRC_ASSETS_DIR) &&
								!absFile.startsWith(PUBLIC_DIR)
							) {
								sendJson(res, 403, { error: "Access denied" });
								return;
							}
							const ext = path.extname(absFile).toLowerCase();
							if (!IMAGE_EXTENSIONS.has(ext)) {
								sendJson(res, 403, { error: "Unsupported media type" });
								return;
							}
							sendFile(res, absFile, getContentTypeForExt(ext));
							return;
						}

						if (pathname === "/api/media/upload" && method === "POST") {
							const payload = await readJsonBody(req);
							const rawName = path.basename(
								String(payload.filename || "image.webp"),
							);
							const dataUrl = String(payload.dataUrl || "");
							const match = dataUrl.match(
								/^data:image\/[a-z0-9.+-]+;base64,(.+)$/i,
							);
							if (!match) {
								sendJson(res, 400, { error: "Invalid image data URL" });
								return;
							}
							const ext = path.extname(rawName).toLowerCase();
							if (!IMAGE_EXTENSIONS.has(ext)) {
								sendJson(res, 400, { error: "Unsupported image format" });
								return;
							}
							const base =
								sanitizeSlug(rawName.slice(0, -ext.length)) || "upload";
							const rawBuf = Buffer.from(match[1], "base64");
							if (rawBuf.length > 15 * 1024 * 1024) {
								sendJson(res, 413, { error: "File exceeds 15 MB limit" });
								return;
							}
							const keepVerbatim = ext === ".svg" || ext === ".gif";
							let finalExt = ext;
							let outBuf: Buffer = rawBuf;
							if (!keepVerbatim) {
								outBuf = await sharp(rawBuf)
									.rotate()
									.resize({
										width: 1920,
										height: 1920,
										fit: "inside",
										withoutEnlargement: true,
									})
									.webp({ quality: 80 })
									.toBuffer();
								finalExt = ".webp";
							}
							mkdirSync(UPLOADS_DIR, { recursive: true });
							let finalName = `${base}${finalExt}`;
							let target = path.resolve(UPLOADS_DIR, finalName);
							if (existsSync(target)) {
								finalName = `${base}-${Date.now().toString(36)}${finalExt}`;
								target = path.resolve(UPLOADS_DIR, finalName);
							}
							if (!target.startsWith(UPLOADS_DIR + path.sep)) {
								sendJson(res, 400, { error: "Invalid path" });
								return;
							}
							writeFileSync(target, outBuf);
							const valuePath = `/uploads/${finalName}`;
							sendJson(res, 201, {
								ok: true,
								name: finalName,
								valuePath,
								previewUrl: valuePath,
								originalBytes: rawBuf.length,
								optimizedBytes: outBuf.length,
							});
							return;
						}

						// Git status API
						if (pathname === "/api/git/status" && method === "GET") {
							const gitBin = resolveGitBinary();
							if (!gitBin) {
								sendJson(res, 200, {
									available: false,
									branch: "unknown",
									files: [],
								});
								return;
							}
							const result = await runCommand(
								gitBin,
								["status", "--porcelain=v1", "-b"],
								false,
							);
							const lines = result.output.split(/\r?\n/).filter(Boolean);
							const branchLine = lines.find((l) => l.startsWith("## ")) || "";
							const branch = branchLine
								.replace(/^##\s+/, "")
								.split("...")[0]
								.trim();
							const files = lines
								.filter((l) => !l.startsWith("## "))
								.map((l) => ({
									status: l.slice(0, 2).trim() || "M",
									path: l.slice(3).trim(),
								}));
							sendJson(res, 200, {
								available: true,
								branch: branch || "main",
								files,
							});
							return;
						}

						// Verify action API
						if (pathname === "/api/action/verify" && method === "POST") {
							const commands: Array<{ name: string; cmd: string }> = [
								{ name: "pnpm check", cmd: "pnpm check" },
								{ name: "pnpm type-check", cmd: "pnpm type-check" },
								{ name: "pnpm build", cmd: "pnpm build" },
								{ name: "pnpm check:links", cmd: "pnpm check:links" },
							];
							const steps: Array<{
								name: string;
								ok: boolean;
								code: number;
								durationMs: number;
								output: string;
							}> = [];
							let allOk = true;
							for (const step of commands) {
								const resStep = await runCommand(step.cmd, [], true);
								steps.push({ name: step.name, ...resStep });
								if (!resStep.ok) {
									allOk = false;
									break;
								}
							}
							sendJson(res, 200, { ok: allOk, steps });
							return;
						}

						// Git Commit & Push API
						if (pathname === "/api/action/publish" && method === "POST") {
							const payload = await readJsonBody(req);
							const message = String(payload.message || "").trim();
							if (!message) {
								sendJson(res, 400, { error: "Commit message is required" });
								return;
							}
							const gitBin = resolveGitBinary();
							if (!gitBin) {
								sendJson(res, 500, { error: "Git executable not found" });
								return;
							}
							const addRes = await runCommand(gitBin, ["add", "-A"], false);
							if (!addRes.ok) {
								sendJson(res, 500, {
									ok: false,
									output: addRes.output,
								});
								return;
							}
							const commitRes = await runCommand(
								gitBin,
								["commit", "-m", message],
								false,
							);
							if (!commitRes.ok) {
								sendJson(res, 500, {
									ok: false,
									output: `${addRes.output}\n${commitRes.output}`.trim(),
								});
								return;
							}
							const pushRes = await runCommand(
								gitBin,
								["-c", "http.sslBackend=schannel", "push", "origin", "main"],
								false,
							);
							sendJson(res, pushRes.ok ? 200 : 500, {
								ok: pushRes.ok,
								output: `${commitRes.output}\n${pushRes.output}`.trim(),
							});
							return;
						}

						next();
					} catch (error) {
						const msg =
							error instanceof Error
								? error.message
								: "Unknown Studio API error";
						sendJson(res, 500, { error: msg });
					}
				},
			);
		},
	};
}
