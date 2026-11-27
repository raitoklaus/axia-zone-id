import { defineCollection, reference } from "astro:content";
import type { CollectionConfig } from "astro/content/config";
import { glob } from "astro/loaders";
import { type ZodType, z } from "astro/zod";

type PostData = {
	title: string;
	published: Date;
	updated?: Date;
	draft: boolean;
	description: string;
	image: string;
	useRandomCover: boolean;
	tags: string[];
	category: string | null;
	lang: string;
	pinned: boolean;
	author: string;
	sourceLink: string;
	licenseName: string;
	licenseUrl: string;
	comment: boolean;
	password: string;
	passwordHint: string;
	series: string;
	seriesOrder?: number;
	prevTitle: string;
	prevSlug: string;
	nextTitle: string;
	nextSlug: string;
};

type DynamicData = {
	published: Date;
	pinned: boolean;
	location: string;
};

type ProjectLink = {
	label: string;
	icon: string;
	value: string;
};

type ProjectData = {
	title: string;
	published: Date;
	draft: boolean;
	order?: number;
	description: string;
	image: string;
	useRandomCover: boolean;
	tags: string[];
	link: ProjectLink[];
	status: string;
	lang: string;
};

export type PerformerSocial = {
	label: string;
	url: string;
	icon: string;
};

export const PERFORMER_CATEGORIES: readonly [
	"Anisong Vocalist",
	"Band",
	"Chika Idol",
	"Fandom Idol",
	"Anikura DJ",
	"Collective Group",
	"Cosplayer",
	"Creator / Other",
] = [
	"Anisong Vocalist",
	"Band",
	"Chika Idol",
	"Fandom Idol",
	"Anikura DJ",
	"Collective Group",
	"Cosplayer",
	"Creator / Other",
] as const;

export const WIKI_CATEGORIES: readonly [
	"Event Series & Organizers",
	"Axia Lore & Community",
	"ACG & Jejepangan Scene",
	"Communities & Circles",
] = [
	"Event Series & Organizers",
	"Axia Lore & Community",
	"ACG & Jejepangan Scene",
	"Communities & Circles",
] as const;

export type WikiCategory = (typeof WIKI_CATEGORIES)[number];

export type WikiInfoboxItem = {
	label: string;
	value: string;
};

export type WikiLinkItem = {
	label: string;
	url: string;
	icon: string;
};

export type WikiData = {
	title: string;
	category: WikiCategory;
	summary: string;
	aliases: string[];
	city: string;
	status: string;
	founded: string;
	infobox: WikiInfoboxItem[];
	links: WikiLinkItem[];
	tags: string[];
	image: string;
	updated?: Date;
	featured: boolean;
	draft: boolean;
};

export type PerformerData = {
	name: string;
	role: string;
	category: string;
	bio: string;
	socials: PerformerSocial[];
	tags: string[];
	avatar: string;
	aliases: string[];
	city: string;
	activeYears: string;
	affiliation: string;
	status: string;
	infobox: WikiInfoboxItem[];
	draft: boolean;
};

export const EVENT_REGIONS: readonly [
	"Jabodetabek",
	"Jawa Barat",
	"Jawa Tengah & DIY",
	"Jawa Timur",
	"Bali & Nusa Tenggara",
	"Sumatera",
	"Kalimantan",
	"Sulawesi",
	"Maluku & Papua",
	"Online",
] = [
	"Jabodetabek",
	"Jawa Barat",
	"Jawa Tengah & DIY",
	"Jawa Timur",
	"Bali & Nusa Tenggara",
	"Sumatera",
	"Kalimantan",
	"Sulawesi",
	"Maluku & Papua",
	"Online",
] as const;

export const EVENT_TYPES: readonly [
	"Convention / Expo",
	"Matsuri / Bunkasai",
	"Idol / Anisong Live",
	"Anikura / DJ Night",
	"Cosplay Event",
	"Doujin / Creator Market",
	"Community Gathering",
] = [
	"Convention / Expo",
	"Matsuri / Bunkasai",
	"Idol / Anisong Live",
	"Anikura / DJ Night",
	"Cosplay Event",
	"Doujin / Creator Market",
	"Community Gathering",
] as const;

export const EVENT_ENTRY_TYPES: readonly ["free", "paid", "tba"] = [
	"free",
	"paid",
	"tba",
] as const;

export const EVENT_TIMEZONES: readonly ["WIB", "WITA", "WIT"] = [
	"WIB",
	"WITA",
	"WIT",
] as const;

export type EventRegion = (typeof EVENT_REGIONS)[number] | "";
export type EventType = (typeof EVENT_TYPES)[number] | "";
export type EventEntryType = (typeof EVENT_ENTRY_TYPES)[number];
export type EventTimezone = (typeof EVENT_TIMEZONES)[number];

export type EventStatus =
	| "upcoming"
	| "ongoing"
	| "completed"
	| "cancelled"
	| "postponed";

export type EventData = {
	title: string;
	startDate: Date;
	endDate?: Date;
	venue: string;
	city: string;
	region: EventRegion;
	eventType: EventType;
	entryType: EventEntryType;
	htm: string;
	time: string;
	timezone: EventTimezone;
	organizer: string;
	instagram: string;
	officialUrl: string;
	mapsUrl: string;
	highlights: string[];
	status: EventStatus;
	majorEvent: boolean;
	ticketUrl: string;
	lineup: { collection: "performers"; id: string }[];
	description: string;
	tags: string[];
	image: string;
	draft: boolean;
};

type ContentCollection<T> = CollectionConfig<
	ZodType<T>,
	ReturnType<typeof glob>
>;

const optionalDate = z.preprocess(
	(val) => (val === "" || val === null || val === undefined ? undefined : val),
	z.coerce.date().optional(),
);

const optionalNumber = z.preprocess(
	(val) =>
		val === "" || val === null || val === undefined ? undefined : Number(val),
	z.number().optional(),
);

const postsCollection: ContentCollection<PostData> = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
	schema: z.object({
		title: z.string(),
		published: z.coerce.date(),
		updated: optionalDate,
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		useRandomCover: z.boolean().optional().default(false),
		tags: z.array(z.string()).optional().default([]),
		category: z.string().optional().nullable().default(""),
		lang: z.string().optional().default(""),
		pinned: z.boolean().optional().default(false),
		author: z.string().optional().default(""),
		sourceLink: z.string().optional().default(""),
		licenseName: z.string().optional().default(""),
		licenseUrl: z.string().optional().default(""),
		comment: z.boolean().optional().default(true),
		password: z.string().optional().default(""),
		passwordHint: z.string().optional().default(""),
		series: z.string().optional().default(""),
		seriesOrder: optionalNumber,

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});

type SpecData = {
	title?: string;
	description?: string;
	[key: string]: unknown;
};

const specCollection: ContentCollection<SpecData> = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/spec" }),
	schema: z
		.object({
			title: z.string().optional(),
			description: z.string().optional(),
		})
		.passthrough(),
});

const dynamicCollection: ContentCollection<DynamicData> = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/dynamic" }),
	schema: z.object({
		published: z.coerce.date(),
		pinned: z.boolean().optional().default(false),
		location: z.string().optional().default(""),
	}),
});

const projectsCollection: ContentCollection<ProjectData> = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
	schema: z.object({
		title: z.string(),
		published: z.coerce.date(),
		draft: z.boolean().optional().default(false),
		order: optionalNumber,
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		useRandomCover: z.boolean().optional().default(false),
		tags: z.array(z.string()).optional().default([]),
		link: z
			.array(
				z.object({
					label: z.string(),
					icon: z.string().optional().default(""),
					value: z.string(),
				}),
			)
			.optional()
			.default([]),
		status: z.string().optional().default(""),
		lang: z.string().optional().default(""),
	}),
});

const performersCollection: ContentCollection<PerformerData> = defineCollection(
	{
		loader: glob({
			pattern: "**/*.{md,mdx}",
			base: "./src/content/performers",
		}),
		schema: z.object({
			name: z.string(),
			role: z.string(),
			category: z.string().optional().default(""),
			bio: z.string().optional().default(""),
			socials: z
				.array(
					z.object({
						label: z.string(),
						url: z.string(),
						icon: z.string().optional().default(""),
					}),
				)
				.optional()
				.default([]),
			tags: z.array(z.string()).optional().default([]),
			avatar: z.string().optional().default(""),
			aliases: z.array(z.string()).optional().default([]),
			city: z.string().optional().default(""),
			activeYears: z.string().optional().default(""),
			affiliation: z.string().optional().default(""),
			status: z.string().optional().default("Active"),
			infobox: z
				.array(
					z.object({
						label: z.string(),
						value: z.string(),
					}),
				)
				.optional()
				.default([]),
			draft: z.boolean().optional().default(false),
		}),
	},
);

const wikiCollection: ContentCollection<WikiData> = defineCollection({
	loader: glob({
		pattern: "**/*.{md,mdx}",
		base: "./src/content/wiki",
	}),
	schema: z.object({
		title: z.string(),
		category: z
			.enum(WIKI_CATEGORIES)
			.optional()
			.default("ACG & Jejepangan Scene"),
		summary: z.string().optional().default(""),
		aliases: z.array(z.string()).optional().default([]),
		city: z.string().optional().default(""),
		status: z.string().optional().default("Active"),
		founded: z.string().optional().default(""),
		infobox: z
			.array(
				z.object({
					label: z.string(),
					value: z.string(),
				}),
			)
			.optional()
			.default([]),
		links: z
			.array(
				z.object({
					label: z.string(),
					url: z.string(),
					icon: z.string().optional().default(""),
				}),
			)
			.optional()
			.default([]),
		tags: z.array(z.string()).optional().default([]),
		image: z.string().optional().default(""),
		updated: optionalDate,
		featured: z.boolean().optional().default(false),
		draft: z.boolean().optional().default(false),
	}),
});

const performerRef = z.preprocess(
	(val) =>
		typeof val === "string"
			? val
					.trim()
					.replace(/^.*\//, "")
					.replace(/\.(md|mdx|markdown)$/i, "")
			: val,
	reference("performers"),
);

const eventsCollection: ContentCollection<EventData> = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/events" }),
	schema: z.object({
		title: z.string(),
		startDate: z.coerce.date(),
		endDate: optionalDate,
		venue: z.string(),
		city: z.string(),
		region: z.enum(EVENT_REGIONS).or(z.literal("")).optional().default(""),
		eventType: z.enum(EVENT_TYPES).or(z.literal("")).optional().default(""),
		entryType: z.enum(EVENT_ENTRY_TYPES).optional().default("tba"),
		htm: z.string().optional().default(""),
		time: z.string().optional().default(""),
		timezone: z.enum(EVENT_TIMEZONES).optional().default("WIB"),
		organizer: z.string().optional().default(""),
		instagram: z.string().optional().default(""),
		officialUrl: z.string().optional().default(""),
		mapsUrl: z.string().optional().default(""),
		highlights: z.array(z.string()).optional().default([]),
		status: z
			.enum(["upcoming", "ongoing", "completed", "cancelled", "postponed"])
			.optional()
			.default("upcoming"),
		majorEvent: z.boolean().optional().default(false),
		ticketUrl: z.string().optional().default(""),
		lineup: z.array(performerRef).optional().default([]),
		description: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		image: z.string().optional().default(""),
		draft: z.boolean().optional().default(false),
	}),
});

export const collections: {
	dynamic: typeof dynamicCollection;
	posts: typeof postsCollection;
	spec: typeof specCollection;
	projects: typeof projectsCollection;
	performers: typeof performersCollection;
	wiki: typeof wikiCollection;
	events: typeof eventsCollection;
} = {
	dynamic: dynamicCollection,
	posts: postsCollection,
	spec: specCollection,
	projects: projectsCollection,
	performers: performersCollection,
	wiki: wikiCollection,
	events: eventsCollection,
};
