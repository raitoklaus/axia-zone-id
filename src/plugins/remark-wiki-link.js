/**
 * remark-wiki-link — Obsidian 风格 Wiki Link 插件
 * Extended to resolve links across posts, performers, and events collections.
 * @author CuteLeaf <xiaye@msn.com>
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slug } from "github-slugger";
import matter from "gray-matter";
import { getApiUrlList, processCoverImageSync } from "../utils/image-utils";

const COLLECTIONS = [
	{
		key: "posts",
		dir: fileURLToPath(new URL("../content/posts/", import.meta.url)),
		urlPrefix: "/posts/",
		prefixes: ["posts"],
	},
	{
		key: "performers",
		dir: fileURLToPath(new URL("../content/performers/", import.meta.url)),
		urlPrefix: "/wiki/performers/",
		prefixes: ["wiki/performers", "performers"],
	},
	{
		key: "events",
		dir: fileURLToPath(new URL("../content/events/", import.meta.url)),
		urlPrefix: "/wiki/events/",
		prefixes: ["wiki/events", "events"],
	},
];

const MARKDOWN_EXTENSION = /\.(?:md|mdx|markdown)$/i;
const WIKI_LINK = /!?\[\[([^[\]\n]+)\]\]/g;
const STANDALONE_WIKI_LINK = /^\[\[([^[\]\n]+)\]\]$/;
const SKIPPED_NODE_TYPES = new Set([
	"link",
	"linkReference",
	"mdxJsxFlowElement",
	"mdxJsxTextElement",
]);

const frontmatterCache = new Map();

function withBase(base, routePath) {
	const trimmedBase = typeof base === "string" ? base.trim() : "/";
	const normalizedBase = trimmedBase
		? `/${trimmedBase.replace(/^\/+|\/+$/g, "")}`
		: "/";
	const basePrefix = normalizedBase === "/" ? "" : normalizedBase;
	const normalizedRoute = routePath.startsWith("/")
		? routePath
		: `/${routePath}`;
	return `${basePrefix}${normalizedRoute}`.replace(/\/+/g, "/");
}

function normalizeTargetPath(value) {
	const contentPath = value
		.trim()
		.replaceAll("\\", "/")
		.replace(/^\.?\//, "")
		.replace(/\/+$/, "")
		.replace(MARKDOWN_EXTENSION, "");
	const segments = contentPath.split("/").filter(Boolean);

	if (
		segments.length === 0 ||
		segments.some((segment) => segment === "." || segment === "..")
	) {
		return null;
	}

	const rawPath = segments.join("/");

	for (const collection of COLLECTIONS) {
		for (const prefix of collection.prefixes) {
			const prefixSegments = prefix.split("/");
			if (
				segments.length > prefixSegments.length &&
				prefixSegments.every((part, idx) => segments[idx] === part)
			) {
				const subPath = segments.slice(prefixSegments.length).join("/");
				return {
					rawPath,
					collectionKey: collection.key,
					subPath,
				};
			}
		}
	}

	return {
		rawPath,
		collectionKey: null,
		subPath: rawPath,
	};
}

function createEntryUrl(collection, entryId, base) {
	const segments = entryId.split("/");

	if (segments.at(-1)?.toLowerCase() === "index") {
		segments.pop();
	}

	const encodedPath = segments
		.map((segment) => encodeURIComponent(segment))
		.join("/");

	const routePath = `${collection.urlPrefix}${encodedPath ? `${encodedPath}/` : ""}`;
	return withBase(base, routePath);
}

/**
 * 由内容文件的绝对路径反推相对所属 collection 目录的 content path。
 */
function toContentPath(collectionDir, filePath) {
	return path
		.relative(collectionDir, filePath)
		.replaceAll("\\", "/")
		.replace(MARKDOWN_EXTENSION, "");
}

/**
 * 还原 Astro glob loader 生成的 entry.id。
 */
function toEntryId(meta, collectionDir) {
	const declaredSlug =
		typeof meta.data.slug === "string" ? meta.data.slug.trim() : "";

	return declaredSlug || toContentPath(collectionDir, meta.filePath);
}

function readMetaFile(filePath) {
	let stats;
	try {
		stats = statSync(filePath);
	} catch {
		return null;
	}
	if (!stats.isFile()) {
		return null;
	}

	const cached = frontmatterCache.get(filePath);
	if (cached && cached.mtimeMs === stats.mtimeMs) {
		return cached.meta;
	}

	let data;
	try {
		data = matter(readFileSync(filePath, "utf8")).data ?? {};
	} catch {
		return null;
	}

	const meta = { filePath, data };
	frontmatterCache.set(filePath, { mtimeMs: stats.mtimeMs, meta });
	return meta;
}

function collectCollectionMetas(collectionDir) {
	const metas = [];
	const stack = [collectionDir];

	while (stack.length > 0) {
		const dir = stack.pop();
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			continue;
		}

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				stack.push(fullPath);
				continue;
			}
			if (!MARKDOWN_EXTENSION.test(entry.name)) {
				continue;
			}
			const meta = readMetaFile(fullPath);
			if (meta) {
				metas.push(meta);
			}
		}
	}

	return metas;
}

function findMetaBySlug(metas, target) {
	return (
		metas.find(
			(meta) =>
				typeof meta.data.slug === "string" && meta.data.slug.trim() === target,
		) ?? null
	);
}

function findMetaByExactPath(collectionDir, target) {
	const candidates = [
		`${target}.md`,
		`${target}.mdx`,
		`${target}.markdown`,
		`${target}/index.md`,
		`${target}/index.mdx`,
	];

	for (const candidate of candidates) {
		const meta = readMetaFile(path.join(collectionDir, candidate));
		if (meta) {
			return meta;
		}
	}

	return null;
}

function resolveWikiTarget(parsed) {
	if (!parsed.subPath) {
		return null;
	}

	const searchCollections = parsed.collectionKey
		? COLLECTIONS.filter((c) => c.key === parsed.collectionKey)
		: COLLECTIONS;

	const collectionEntries = searchCollections.map((collection) => ({
		collection,
		metas: collectCollectionMetas(collection.dir),
	}));

	// 1. frontmatter.slug match
	for (const { collection, metas } of collectionEntries) {
		const bySlug = findMetaBySlug(metas, parsed.subPath);
		if (bySlug) {
			return { meta: bySlug, collection };
		}
	}

	// 2. Exact relative file path match
	for (const { collection } of collectionEntries) {
		const byPath = findMetaByExactPath(collection.dir, parsed.subPath);
		if (byPath) {
			return { meta: byPath, collection };
		}
	}

	// 3. Unique bare basename match
	if (parsed.subPath.includes("/")) {
		return null;
	}

	const baseMatches = [];
	for (const { collection, metas } of collectionEntries) {
		for (const meta of metas) {
			if (
				path.basename(meta.filePath).replace(MARKDOWN_EXTENSION, "") ===
				parsed.subPath
			) {
				baseMatches.push({ meta, collection });
			}
		}
	}

	if (baseMatches.length === 1) {
		return baseMatches[0];
	}
	if (baseMatches.length > 1) {
		console.warn(
			`[remark-wiki-link] "[[${parsed.rawPath}]]" matched multiple files and was skipped: ${baseMatches
				.map(
					({ collection, meta }) =>
						`${collection.key}/${toContentPath(collection.dir, meta.filePath)}`,
				)
				.join(", ")}. Specify a collection prefix or longer path.`,
		);
	}

	return null;
}

function formatPublishedDate(value) {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString().slice(0, 10);
	}
	if (typeof value === "string") {
		const match = value.match(/^\d{4}-\d{2}-\d{2}/);
		if (match) {
			return match[0];
		}
	}
	return "";
}

function createRemoteCoverImg(src, extraProperties) {
	return createElement(
		"img",
		{
			src,
			alt: "",
			loading: "lazy",
			decoding: "async",
			...extraProperties,
		},
		[],
	);
}

function createCoverNode(meta, resolvedPath, context) {
	const explicitImage =
		typeof meta.data.image === "string" && meta.data.image.trim()
			? meta.data.image.trim()
			: typeof meta.data.avatar === "string"
				? meta.data.avatar.trim()
				: "";
	const rawImage =
		explicitImage || (meta.data.useRandomCover === true ? "api" : "");

	if (!rawImage) {
		return null;
	}

	if (rawImage === "api") {
		const seed = resolvedPath.replace(/\/index$/i, "");
		const firstUrl = processCoverImageSync(rawImage, seed);
		if (!firstUrl) {
			return null;
		}
		const apiUrls = getApiUrlList(rawImage, seed);
		return createElement(
			"div",
			{
				class: "cover-image-container",
				dataApiUrls: apiUrls.length > 0 ? JSON.stringify(apiUrls) : undefined,
			},
			[
				createRemoteCoverImg(firstUrl, {
					dataCoverImg: "true",
					dataRemote: "true",
				}),
			],
		);
	}

	if (/^(?:https?:)?\/\//i.test(rawImage) || rawImage.startsWith("/")) {
		const resolvedSrc = rawImage.startsWith("/")
			? withBase(context.base, rawImage)
			: rawImage;
		return createRemoteCoverImg(resolvedSrc);
	}

	if (!context.currentDir) {
		return null;
	}

	const absolutePath = path.resolve(path.dirname(meta.filePath), rawImage);
	try {
		if (!statSync(absolutePath).isFile()) {
			return null;
		}
	} catch {
		return null;
	}

	const relativePath = path
		.relative(context.currentDir, absolutePath)
		.replaceAll("\\", "/");
	const coverUrl = relativePath.startsWith(".")
		? relativePath
		: `./${relativePath}`;

	return {
		type: "image",
		url: coverUrl,
		alt: "",
		data: { hProperties: { width: 480 } },
	};
}

function parseWikiLinkValue(value) {
	const aliasSeparator = value.indexOf("|");
	const destination = (
		aliasSeparator === -1 ? value : value.slice(0, aliasSeparator)
	).trim();
	const alias =
		aliasSeparator === -1 ? "" : value.slice(aliasSeparator + 1).trim();

	if (!destination) {
		return null;
	}

	const headingSeparator = destination.indexOf("#");
	const pageName =
		headingSeparator === -1
			? destination
			: destination.slice(0, headingSeparator).trim();
	const heading =
		headingSeparator === -1
			? ""
			: destination.slice(headingSeparator + 1).trim();
	const target = pageName ? normalizeTargetPath(pageName) : null;

	if ((pageName && !target) || (!target && !heading)) {
		return null;
	}

	return {
		destination,
		alias,
		rawPath: target?.rawPath ?? "",
		collectionKey: target?.collectionKey ?? null,
		subPath: target?.subPath ?? "",
		heading,
	};
}

function resolveAlias(parsed, resolved) {
	if (!parsed.alias) {
		return "";
	}

	const noise = new Set([
		parsed.destination,
		parsed.rawPath,
		parsed.subPath,
		path.basename(parsed.subPath || parsed.rawPath),
	]);
	if (resolved) {
		noise.add(toContentPath(resolved.collection.dir, resolved.meta.filePath));
		noise.add(
			path.basename(resolved.meta.filePath).replace(MARKDOWN_EXTENSION, ""),
		);
	}

	return noise.has(parsed.alias) ? "" : parsed.alias;
}

function createElement(tagName, properties, children) {
	return {
		type: "paragraph",
		data: { hName: tagName, hProperties: properties },
		children,
	};
}

function createText(value) {
	return { type: "text", value };
}

function getEntryTitle(meta) {
	if (typeof meta?.data.title === "string" && meta.data.title.trim()) {
		return meta.data.title.trim();
	}
	if (typeof meta?.data.name === "string" && meta.data.name.trim()) {
		return meta.data.name.trim();
	}
	return "";
}

function getEntryDescription(meta) {
	if (
		typeof meta.data.description === "string" &&
		meta.data.description.trim()
	) {
		return meta.data.description.trim();
	}
	if (typeof meta.data.bio === "string" && meta.data.bio.trim()) {
		return meta.data.bio.trim();
	}
	if (
		typeof meta.data.venue === "string" &&
		meta.data.venue.trim() &&
		typeof meta.data.city === "string" &&
		meta.data.city.trim()
	) {
		return `${meta.data.venue.trim()}, ${meta.data.city.trim()}`;
	}
	if (typeof meta.data.role === "string" && meta.data.role.trim()) {
		return meta.data.role.trim();
	}
	return "";
}

function createWikiLinkCard(parsed, context) {
	const resolved = resolveWikiTarget(parsed);
	if (!resolved) {
		return null;
	}

	const { meta, collection } = resolved;
	const resolvedId = toEntryId(meta, collection.dir);
	const title =
		resolveAlias(parsed, resolved) || getEntryTitle(meta) || resolvedId;
	const encrypted =
		typeof meta.data.password === "string" && meta.data.password.length > 0;
	const description = getEntryDescription(meta);
	const published = formatPublishedDate(
		meta.data.published ?? meta.data.startDate,
	);
	const category =
		(typeof meta.data.category === "string" && meta.data.category.trim()) ||
		(typeof meta.data.role === "string" && meta.data.role.trim()) ||
		(typeof meta.data.city === "string" && meta.data.city.trim()) ||
		"";
	const tags = Array.isArray(meta.data.tags)
		? meta.data.tags.filter((tag) => typeof tag === "string" && tag)
		: [];

	const metaItems = [];
	if (published) {
		metaItems.push(
			createElement("span", { class: "wlc-date" }, [createText(published)]),
		);
	}
	if (category) {
		metaItems.push(
			createElement("span", { class: "wlc-category" }, [createText(category)]),
		);
	}
	if (tags.length > 0) {
		metaItems.push(
			createElement(
				"span",
				{ class: "wlc-tags" },
				tags.map((tag) =>
					createElement("span", { class: "wlc-tag" }, [createText(`#${tag}`)]),
				),
			),
		);
	}

	const info = [
		createElement(
			"div",
			{ class: `wlc-title${encrypted ? " wlc-encrypted" : ""}` },
			[createText(title)],
		),
	];
	if (description) {
		info.push(
			createElement("div", { class: "wlc-description" }, [
				createText(description),
			]),
		);
	}
	if (metaItems.length > 0) {
		info.push(createElement("div", { class: "wlc-meta" }, metaItems));
	}

	const children = [createElement("div", { class: "wlc-info" }, info)];

	const cover = createCoverNode(meta, resolvedId, context);
	if (cover) {
		children.push(createElement("div", { class: "wlc-cover" }, [cover]));
	}

	return createElement(
		"a",
		{
			class: "card-wiki-link no-styling",
			href: createEntryUrl(collection, resolvedId, context.base),
		},
		children,
	);
}

function createWikiLink(value, context) {
	const parsed = parseWikiLinkValue(value);
	if (!parsed) {
		return null;
	}

	const resolved = parsed.subPath ? resolveWikiTarget(parsed) : null;
	const metaTitle = resolved ? getEntryTitle(resolved.meta) : "";

	let text = resolveAlias(parsed, resolved);
	if (!text) {
		if (parsed.subPath) {
			const pageText =
				metaTitle || parsed.destination.replace(MARKDOWN_EXTENSION, "");
			text = parsed.heading ? `${pageText}#${parsed.heading}` : pageText;
		} else {
			text = parsed.heading;
		}
	}

	let pageUrl = "";
	if (parsed.subPath) {
		if (resolved) {
			const resolvedId = toEntryId(resolved.meta, resolved.collection.dir);
			pageUrl = createEntryUrl(resolved.collection, resolvedId, context.base);
		} else {
			const fallbackCollection =
				COLLECTIONS.find((c) => c.key === parsed.collectionKey) ??
				COLLECTIONS[0];
			pageUrl = createEntryUrl(
				fallbackCollection,
				parsed.subPath,
				context.base,
			);
		}
	}

	const url = `${pageUrl}${parsed.heading ? `#${slug(parsed.heading)}` : ""}`;

	return {
		type: "link",
		url,
		children: [createText(text)],
	};
}

function replaceWikiLinks(value, context) {
	const children = [];
	let cursor = 0;
	let changed = false;

	for (const match of value.matchAll(WIKI_LINK)) {
		if (match[0].startsWith("!")) {
			continue;
		}

		const link = createWikiLink(match[1], context);
		if (!link) {
			continue;
		}

		const index = match.index;
		if (index > cursor) {
			children.push({ type: "text", value: value.slice(cursor, index) });
		}
		children.push(link);
		cursor = index + match[0].length;
		changed = true;
	}

	if (!changed) {
		return null;
	}

	if (cursor < value.length) {
		children.push({ type: "text", value: value.slice(cursor) });
	}

	return children;
}

function tryCreateCardFromParagraph(node, context) {
	if (node.type !== "paragraph" || node.children?.length !== 1) {
		return null;
	}

	const child = node.children[0];
	if (child.type !== "text") {
		return null;
	}

	const match = child.value.trim().match(STANDALONE_WIKI_LINK);
	if (!match) {
		return null;
	}

	const parsed = parseWikiLinkValue(match[1]);
	if (!parsed || parsed.heading || !parsed.subPath) {
		return null;
	}

	return createWikiLinkCard(parsed, context);
}

function transformNode(node, context) {
	if (SKIPPED_NODE_TYPES.has(node.type) || !Array.isArray(node.children)) {
		return;
	}

	for (let index = 0; index < node.children.length; index++) {
		const child = node.children[index];

		const card = tryCreateCardFromParagraph(child, context);
		if (card) {
			node.children[index] = card;
			continue;
		}

		if (child.type === "text") {
			const replacement = replaceWikiLinks(child.value, context);
			if (replacement) {
				node.children.splice(index, 1, ...replacement);
				index += replacement.length - 1;
			}
			continue;
		}

		transformNode(child, context);
	}
}

/**
 * Convert Obsidian-style Wiki Links into Markdown links and entry link cards
 * across posts, performers, and events collections.
 */
export function remarkWikiLink(options = {}) {
	const base = typeof options.base === "string" ? options.base : "/";
	return (tree, file) => {
		const context = {
			base,
			currentDir: file?.path ? path.dirname(file.path) : null,
		};
		transformNode(tree, context);
	};
}
