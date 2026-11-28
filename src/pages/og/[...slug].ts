import { getCollection } from "astro:content";
import * as fs from "node:fs";
import type { APIContext, GetStaticPaths } from "astro";
import type { FontDetails } from "takumi-js";
import { ImageResponse } from "takumi-js/response";
import { galleryConfig } from "@/config/galleryConfig";
import { profileConfig } from "@/config/profileConfig";
import { siteConfig } from "@/config/siteConfig";
import { formatDateToYYYYMMDD } from "@/utils/date-utils";
import { getAlbumCover, scanAlbumPhotos } from "@/utils/gallery-utils";
import { removeFileExtension } from "@/utils/url-utils";
import {
	formatEventDateRange,
	getAdmissionMeta,
	getAllEvents,
	getAllPerformers,
	getAllWikiEntries,
} from "@/utils/wiki-utils";

export const prerender = true;

type OgKind = "post" | "event" | "wiki" | "performer" | "gallery" | "page";

interface OgPayload {
	kind: OgKind;
	badge: string;
	title: string;
	description: string;
	metaRight: string;
	accentColor: string;
	coverImage: string;
}

const DEFAULT_COVERS = {
	home: "assets/images/DesktopWallpaper/axia-d01-prism-sky.webp",
	post: "assets/images/DesktopWallpaper/axia-d01-prism-sky.webp",
	event: "assets/images/DesktopWallpaper/axia-d12-lantern-festival.webp",
	wiki: "assets/images/DesktopWallpaper/axia-d15-azure-beams.webp",
	performer: "assets/images/DesktopWallpaper/axia-d16-dark-prism-stage.webp",
	gallery: "assets/images/DesktopWallpaper/axia-d13-prism-reach.webp",
	about: "assets/images/DesktopWallpaper/axia-d19-sky-breeze.webp",
	guestbook: "assets/images/DesktopWallpaper/axia-d06-sakura-sky.webp",
} as const;

const resolveCoverCandidate = (
	image: string | undefined,
	fallback: string,
): string => {
	const cleaned = image?.trim() || "";
	if (!cleaned || cleaned === "api") {
		return fallback;
	}
	return cleaned;
};

export const getStaticPaths: GetStaticPaths = async () => {
	if (!siteConfig.post.generateOgImages) {
		return [];
	}

	const [allPosts, events, wikiEntries, performers] = await Promise.all([
		getCollection("posts"),
		getAllEvents(),
		getAllWikiEntries(),
		getAllPerformers(),
	]);

	const postPaths = allPosts
		.filter((post) => !post.data.draft)
		.map((post) => {
			const slug = removeFileExtension(post.id);
			const payload: OgPayload = {
				kind: "post",
				badge: post.data.category || "Article",
				title: post.data.title,
				description: post.data.description || "",
				metaRight: post.data.published.toLocaleDateString("en-US", {
					year: "numeric",
					month: "short",
					day: "numeric",
				}),
				accentColor: "#38bdf8",
				coverImage: resolveCoverCandidate(post.data.image, DEFAULT_COVERS.post),
			};
			return {
				params: { slug: `${slug}.jpg` },
				props: { payload },
			};
		});

	const eventPaths = events.map((event) => {
		const slug = removeFileExtension(event.id);
		const dateRange = formatEventDateRange(
			event.data.startDate,
			event.data.endDate,
		);
		const admission = getAdmissionMeta(event.data.entryType, event.data.htm);
		const payload: OgPayload = {
			kind: "event",
			badge: event.data.eventType || "ACG Event",
			title: event.data.title,
			description: `${dateRange} | ${event.data.venue}, ${event.data.city}`,
			metaRight: admission.label,
			accentColor: "#ff6b9d",
			coverImage: resolveCoverCandidate(event.data.image, DEFAULT_COVERS.event),
		};
		return {
			params: { slug: `events/${slug}.jpg` },
			props: { payload },
		};
	});

	const wikiPaths = wikiEntries.map((entry) => {
		const slug = removeFileExtension(entry.id);
		const updatedLabel = entry.data.updated
			? `Updated ${formatDateToYYYYMMDD(entry.data.updated)}`
			: entry.data.city || "Axia ACG Wiki";
		const payload: OgPayload = {
			kind: "wiki",
			badge: entry.data.category,
			title: entry.data.title,
			description: entry.data.summary || "",
			metaRight: updatedLabel,
			accentColor: "#22d3ee",
			coverImage: resolveCoverCandidate(entry.data.image, DEFAULT_COVERS.wiki),
		};
		return {
			params: { slug: `wiki/${slug}.jpg` },
			props: { payload },
		};
	});

	const performerPaths = performers.map((performer) => {
		const slug = removeFileExtension(performer.id);
		const subtitle = [
			performer.data.role,
			performer.data.city,
			performer.data.affiliation,
		]
			.filter(Boolean)
			.join(" | ");
		const payload: OgPayload = {
			kind: "performer",
			badge: performer.data.category || "Performer",
			title: performer.data.name,
			description: performer.data.bio || subtitle,
			metaRight: performer.data.city || "Performer Wiki",
			accentColor: "#a78bfa",
			coverImage: resolveCoverCandidate(
				performer.data.avatar,
				DEFAULT_COVERS.performer,
			),
		};
		return {
			params: { slug: `performers/${slug}.jpg` },
			props: { payload },
		};
	});

	const galleryPaths = galleryConfig.albums.map((album) => {
		const photos = scanAlbumPhotos(album.id);
		const cover = getAlbumCover(album, photos);
		const metaRight = [`${photos.length} Photos`, album.location || ""]
			.filter(Boolean)
			.join(" | ");
		const payload: OgPayload = {
			kind: "gallery",
			badge: "Gallery Album",
			title: album.name,
			description:
				album.description ||
				`Koleksi ${photos.length} visual pilihan di Axia Zone ID.`,
			metaRight,
			accentColor: "#38bdf8",
			coverImage: resolveCoverCandidate(cover, DEFAULT_COVERS.gallery),
		};
		return {
			params: { slug: `gallery/${album.id}.jpg` },
			props: { payload },
		};
	});

	const pageEntries: Array<{ slug: string; payload: OgPayload }> = [
		{
			slug: "pages/home.jpg",
			payload: {
				kind: "page",
				badge: "ACG Base & Schedule",
				title: siteConfig.title,
				description: siteConfig.subtitle || siteConfig.description || "",
				metaRight: "Bandung & Indonesia",
				accentColor: "#38bdf8",
				coverImage: DEFAULT_COVERS.home,
			},
		},
		{
			slug: "pages/events.jpg",
			payload: {
				kind: "page",
				badge: "Event Calendar",
				title: "Events & Schedule",
				description:
					"Jadwal dan arsip event Jejepangan & ACG di Bandung, Jabodetabek, dan seluruh Indonesia.",
				metaRight: `${events.length} Events Indexed`,
				accentColor: "#ff6b9d",
				coverImage: DEFAULT_COVERS.event,
			},
		},
		{
			slug: "pages/wiki.jpg",
			payload: {
				kind: "page",
				badge: "Wiki Hub",
				title: "Axia ACG Wiki",
				description:
					"Ensiklopedia mini skena Jejepangan & ACG Bandung/Indonesia: lore Axia, performer, seri event, dan komunitas.",
				metaRight: `${wikiEntries.length} Articles | ${performers.length} Performers`,
				accentColor: "#22d3ee",
				coverImage: DEFAULT_COVERS.wiki,
			},
		},
		{
			slug: "pages/performers.jpg",
			payload: {
				kind: "page",
				badge: "Performer Wiki",
				title: "Performer Directory",
				description:
					"Direktori performer skena Jejepangan & ACG lokal lengkap dengan profil dan jadwal tampil.",
				metaRight: `${performers.length} Performers`,
				accentColor: "#a78bfa",
				coverImage: DEFAULT_COVERS.performer,
			},
		},
		{
			slug: "pages/gallery.jpg",
			payload: {
				kind: "page",
				badge: "Showcase",
				title: "Axia Gallery",
				description:
					"Koleksi artwork karakter Axia, wallpaper desktop & mobile, serta dokumentasi visual.",
				metaRight: `${galleryConfig.albums.length} Albums`,
				accentColor: "#38bdf8",
				coverImage: DEFAULT_COVERS.gallery,
			},
		},
		{
			slug: "pages/about.jpg",
			payload: {
				kind: "page",
				badge: "About",
				title: `About ${siteConfig.title}`,
				description: siteConfig.subtitle || siteConfig.description || "",
				metaRight: "Kota Bandung",
				accentColor: "#38bdf8",
				coverImage: DEFAULT_COVERS.about,
			},
		},
		{
			slug: "pages/guestbook.jpg",
			payload: {
				kind: "page",
				badge: "Guestbook",
				title: "Guestbook & Info Event",
				description:
					"Titip info event Bandung & Jabodetabek, update profil performer, atau ngobrol santai seputar skena ACG.",
				metaRight: "Community Board",
				accentColor: "#22d3ee",
				coverImage: DEFAULT_COVERS.guestbook,
			},
		},
	];

	const pagePaths = pageEntries.map(({ slug, payload }) => ({
		params: { slug },
		props: { payload },
	}));

	return [
		...postPaths,
		...eventPaths,
		...wikiPaths,
		...performerPaths,
		...galleryPaths,
		...pagePaths,
	];
};

// OG 图用的中文字体从 @fontsource 包本地读取，构建期不再请求 Google Fonts。
// 该包把 CJK 按 unicode-range 切成百余个分片，Takumi 用 subsetOf + subsetRank 把它们
// 组织成同一个逻辑家族（font-family: subsetOf 会展开到全部分片）。
const OG_FONT_FAMILY = "Noto Sans SC";
const OG_FONT_DIR = "node_modules/@fontsource-variable/noto-sans-sc";
let ogFonts: FontDetails[] | undefined;

const loadOgFonts = (): FontDetails[] => {
	if (ogFonts) return ogFonts;

	const unicodeRanges: Record<string, string> = JSON.parse(
		fs.readFileSync(`${OG_FONT_DIR}/unicode.json`, "utf-8"),
	);

	const fonts: FontDetails[] = Object.entries(unicodeRanges).map(
		([chunk, range]) => {
			// 键格式不统一：数字分片是 "[4]"，具名子集是裸的 "latin"，而文件名一律不带方括号
			const name = chunk.replace(/^\[|\]$/g, "");
			// rank 取该分片覆盖的最小码位，与 Takumi loadGoogleFonts 内部的取值方式一致
			const starts = range
				.split(",")
				.map((r) => Number.parseInt(r.trim().replace(/^U\+/i, ""), 16))
				.filter((n) => Number.isFinite(n));
			return {
				name,
				data: fs.readFileSync(
					`${OG_FONT_DIR}/files/noto-sans-sc-${name}-wght-normal.woff2`,
				),
				subsetOf: OG_FONT_FAMILY,
				subsetRank: starts.length > 0 ? Math.min(...starts) : 0,
			};
		},
	);

	ogFonts = fonts;
	return fonts;
};

// Detect image format from magic bytes, returns mime type or null if unknown
const detectImageFormat = (buffer: Buffer): string | null => {
	if (buffer.length < 12) return null;

	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47 &&
		buffer[4] === 0x0d &&
		buffer[5] === 0x0a &&
		buffer[6] === 0x1a &&
		buffer[7] === 0x0a
	)
		return "image/png";

	// JPEG: FF D8 FF
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
		return "image/jpeg";

	// GIF: GIF87a or GIF89a
	if (
		buffer[0] === 0x47 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x38 &&
		(buffer[4] === 0x37 || buffer[4] === 0x39) &&
		buffer[5] === 0x61
	)
		return "image/gif";

	// WebP: RIFF ???? WEBP
	if (
		buffer[0] === 0x52 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x46 &&
		buffer[8] === 0x57 &&
		buffer[9] === 0x45 &&
		buffer[10] === 0x42 &&
		buffer[11] === 0x50
	)
		return "image/webp";

	return null;
};

// Formats natively supported — no conversion needed
const SUPPORTED_FORMATS = new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
]);

// 缓存 sharp 模块，避免重复动态导入
let sharpPromise: Promise<typeof import("sharp")["default"]> | null = null;
function getSharp() {
	if (!sharpPromise) {
		sharpPromise = import("sharp").then((m) => m.default);
	}
	return sharpPromise;
}

// Minimal 1×1 transparent PNG, hardcoded — no sharp call needed for fallback,
// so it still works even if sharp itself failed to load.
const TRANSPARENT_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

let transparentPngBuffer: ArrayBuffer | null = null;
function getTransparentPngArrayBuffer(): ArrayBuffer {
	if (!transparentPngBuffer) {
		const buf = Buffer.from(TRANSPARENT_PNG_BASE64, "base64");
		transparentPngBuffer = buf.buffer.slice(
			buf.byteOffset,
			buf.byteOffset + buf.byteLength,
		) as ArrayBuffer;
	}
	return transparentPngBuffer;
}

// Log a warning and fall back to a transparent PNG
const warnAndFallback = (imagePath: string, detail: string): ArrayBuffer => {
	console.warn(
		"\n \x1b[33m[OG Image] Warning \n" +
			` 无法加载或处理图片 "${imagePath}"，可能是文件缺失、网络错误或不被支持的格式。\n` +
			" 已使用透明图片替代。\n" +
			` Failed to load or process image "${imagePath}", possibly missing file, network error, or unsupported format.\n` +
			" A transparent image was used instead.\n" +
			` ${detail}\x1b[0m`,
	);
	return getTransparentPngArrayBuffer();
};

// Helper to load avatar/favicon with caching
const loadImageAsArrayBuffer = async (
	imagePath: string,
): Promise<ArrayBuffer> => {
	try {
		let buffer: Buffer;

		if (imagePath.startsWith("http")) {
			const res = await fetch(imagePath);
			if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
			buffer = Buffer.from(await res.arrayBuffer());
		} else {
			const normalized = imagePath.replace(/^\/+/, "").replace(/^\.\//, "");

			// Try resolving the file in order: src/ -> public/ -> path as-is
			const candidatePaths = [
				`./src/${normalized}`,
				`./public/${normalized}`,
				normalized,
			];

			const foundPath = candidatePaths.find((p) => fs.existsSync(p));

			if (!foundPath) {
				return warnAndFallback(
					imagePath,
					`Tried paths: ${candidatePaths.join(", ")}`,
				);
			}

			buffer = fs.readFileSync(foundPath);
		}

		const detectedFormat = detectImageFormat(buffer);

		if (!detectedFormat || !SUPPORTED_FORMATS.has(detectedFormat)) {
			const sharp = await getSharp();
			buffer = Buffer.from(
				await sharp(buffer as Buffer)
					.png()
					.toBuffer(),
			);
		}

		return buffer.buffer.slice(
			buffer.byteOffset,
			buffer.byteOffset + buffer.byteLength,
		) as ArrayBuffer;
	} catch (err) {
		return warnAndFallback(
			imagePath,
			`Error: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
};

export async function GET({
	props,
}: APIContext<{ payload: OgPayload }>): Promise<Response> {
	const { payload } = props;

	// Load and get static assets
	let iconPath = "/favicon/axia-192.png";
	if (siteConfig.favicon.length > 0) {
		const pngFavicon = siteConfig.favicon.find((f) =>
			f.src.toLowerCase().endsWith(".png"),
		);
		iconPath = (pngFavicon ?? siteConfig.favicon[0]).src;
	}

	const hue = siteConfig.themeColor.hue;
	const primaryColor = payload.accentColor || `hsl(${hue}, 90%, 65%)`;
	const textColor = "hsl(0, 0%, 96%)";
	const subtleTextColor = `hsl(${hue}, 18%, 78%)`;
	const backgroundColor = "#14192c";

	const description = payload.description;
	const pubDate = payload.metaRight;

	return new ImageResponse(
		{
			type: "div",
			props: {
				style: {
					height: "100%",
					width: "100%",
					position: "relative",
					display: "flex",
					flexDirection: "column",
					backgroundColor: backgroundColor,
					overflow: "hidden",
					fontFamily:
						'"Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
				},
				children: [
					{
						type: "img",
						props: {
							src: "og-cover",
							width: 1200,
							height: 630,
							style: {
								position: "absolute",
								top: 0,
								left: 0,
								width: 1200,
								height: 630,
								objectFit: "cover",
								objectPosition: "50% 25%",
							},
						},
					},
					{
						type: "div",
						props: {
							style: {
								position: "absolute",
								top: 0,
								left: 0,
								width: 1200,
								height: 630,
								backgroundImage:
									"linear-gradient(96deg, rgba(13, 18, 34, 0.94) 0%, rgba(15, 22, 42, 0.84) 48%, rgba(15, 22, 42, 0.32) 100%)",
							},
						},
					},
					{
						type: "div",
						props: {
							style: {
								position: "relative",
								height: "100%",
								width: "100%",
								display: "flex",
								flexDirection: "column",
								padding: "54px 60px",
							},
							children: [
								{
									type: "div",
									props: {
										style: {
											width: "100%",
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: "20px",
										},
										children: [
											{
												type: "div",
												props: {
													style: {
														display: "flex",
														alignItems: "center",
														gap: "16px",
													},
													children: [
														{
															type: "img",
															props: {
																src: "og-icon",
																width: 50,
																height: 50,
																style: {
																	borderRadius: "12px",
																	width: 50,
																	height: 50,
																	objectFit: "cover",
																},
															},
														},
														{
															type: "div",
															props: {
																style: {
																	fontSize: "32px",
																	fontWeight: 700,
																	color: textColor,
																},
																children: siteConfig.title,
															},
														},
													],
												},
											},
											{
												type: "div",
												props: {
													style: {
														fontSize: "22px",
														fontWeight: 700,
														color: "#0f162a",
														backgroundColor: primaryColor,
														padding: "8px 20px",
														borderRadius: "999px",
													},
													children: payload.badge,
												},
											},
										],
									},
								},
								{
									type: "div",
									props: {
										style: {
											display: "flex",
											flexDirection: "column",
											justifyContent: "center",
											flexGrow: 1,
											gap: "18px",
											maxWidth: "780px",
										},
										children: [
											{
												type: "div",
												props: {
													style: {
														display: "flex",
														alignItems: "flex-start",
													},
													children: [
														{
															type: "div",
															props: {
																style: {
																	width: "10px",
																	height: "64px",
																	backgroundColor: primaryColor,
																	borderRadius: "6px",
																	marginTop: "12px",
																	flexShrink: 0,
																},
															},
														},
														{
															type: "div",
															props: {
																style: {
																	fontSize: "62px",
																	fontWeight: 700,
																	color: textColor,
																	marginLeft: "22px",
																	overflow: "hidden",
																	textOverflow: "ellipsis",
																	lineClamp: 3,
																	WebkitLineClamp: 3,
																	WebkitBoxOrient: "vertical",
																	"text-fit": "grow per-line-all",
																	display: "flex",
																	flexDirection: "column",
																},
																children: payload.title,
															},
														},
													],
												},
											},
											...(description
												? [
														{
															type: "div",
															props: {
																style: {
																	fontSize: "29px",
																	color: subtleTextColor,
																	paddingLeft: "32px",
																	overflow: "hidden",
																	textOverflow: "ellipsis",
																	lineClamp: 2,
																	WebkitLineClamp: 2,
																	WebkitBoxOrient: "vertical",
																	"text-fit": "grow per-line-all",
																	display: "flex",
																	flexDirection: "column",
																},
																children: description,
															},
														},
													]
												: []),
										],
									},
								},
								{
									type: "div",
									props: {
										style: {
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
											width: "100%",
										},
										children: [
											{
												type: "div",
												props: {
													style: {
														display: "flex",
														alignItems: "center",
														gap: "16px",
													},
													children: [
														{
															type: "img",
															props: {
																src: "og-avatar",
																width: 56,
																height: 56,
																style: {
																	borderRadius: "50%",
																	width: 56,
																	height: 56,
																	objectFit: "cover",
																	border: "2px solid rgba(255,255,255,0.65)",
																},
															},
														},
														{
															type: "div",
															props: {
																style: {
																	fontSize: "26px",
																	fontWeight: 600,
																	color: textColor,
																},
																children: profileConfig.name,
															},
														},
													],
												},
											},
											{
												type: "div",
												props: {
													style: {
														fontSize: "24px",
														fontWeight: 600,
														color: textColor,
														backgroundColor: "rgba(15, 22, 42, 0.72)",
														padding: "8px 18px",
														borderRadius: "999px",
													},
													children: pubDate,
												},
											},
										],
									},
								},
							],
						},
					},
				],
			},
		},
		{
			width: 1200,
			height: 630,
			format: "jpeg",
			quality: 84,
			images: {
				cache: "auto",
				sources: [
					{
						src: "og-cover",
						data: () => loadImageAsArrayBuffer(payload.coverImage),
					},
					{
						src: "og-avatar",
						data: () => loadImageAsArrayBuffer(profileConfig.avatar ?? ""),
					},
					{
						src: "og-icon",
						data: () => loadImageAsArrayBuffer(iconPath),
					},
				],
			},
			fonts: loadOgFonts(),
			headers: {
				"Content-Type": "image/jpeg",
				"Cache-Control": "public, max-age=31536000, immutable",
			},
		},
	);
}
