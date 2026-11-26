import { type CollectionEntry, getCollection, getEntries } from "astro:content";
import {
	EVENT_ENTRY_TYPES,
	EVENT_REGIONS,
	EVENT_TIMEZONES,
	EVENT_TYPES,
	type EventEntryType,
	type EventRegion,
	type EventStatus,
	type EventTimezone,
	type EventType,
} from "@/content.config";
import { formatDateToYYYYMMDD, isDateOnly } from "@/utils/date-utils";
import {
	getEventUrl,
	getPerformerUrl,
	removeFileExtension,
} from "@/utils/url-utils";

export {
	EVENT_ENTRY_TYPES,
	EVENT_REGIONS,
	EVENT_TIMEZONES,
	EVENT_TYPES,
	type EventEntryType,
	type EventRegion,
	type EventStatus,
	type EventTimezone,
	type EventType,
};

export type SerializedEventLineupItem = {
	name: string;
	href: string;
};

export type SerializedWikiEvent = {
	id: string;
	slug: string;
	href: string;
	title: string;
	startYmd: string;
	endYmd: string;
	dateRange: string;
	monthKey: string;
	monthLabel: string;
	dateParts: {
		month: string;
		day: string;
		year: string;
	};
	venue: string;
	city: string;
	region: EventRegion;
	eventType: EventType;
	entryType: EventEntryType;
	admissionLabel: string;
	admissionClass: string;
	admissionKind: EventEntryType;
	time: string;
	timezone: EventTimezone;
	organizer: string;
	highlights: string[];
	status: EventStatus;
	statusLabel: string;
	statusClass: string;
	ticketUrl: string;
	description: string;
	tags: string[];
	lineup: SerializedEventLineupItem[];
	isUpcoming: boolean;
};

export async function getAllPerformers(): Promise<
	CollectionEntry<"performers">[]
> {
	const entries = await getCollection("performers", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	return entries.sort((a, b) =>
		a.data.name.localeCompare(b.data.name, undefined, { sensitivity: "base" }),
	);
}

export async function getAllEvents(): Promise<CollectionEntry<"events">[]> {
	const entries = await getCollection("events", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	return entries.sort(
		(a, b) => a.data.startDate.getTime() - b.data.startDate.getTime(),
	);
}

export function isEventUpcoming(
	event: CollectionEntry<"events">,
	referenceDate: Date = new Date(),
): boolean {
	const { status, startDate, endDate } = event.data;
	if (status === "completed" || status === "cancelled") {
		return false;
	}
	const comparisonDate = endDate ?? startDate;
	return (
		formatDateToYYYYMMDD(comparisonDate) >= formatDateToYYYYMMDD(referenceDate)
	);
}

export type HomeScheduleScope = "kota-bandung" | "jabodetabek-major";

export function isKotaBandungEvent(event: CollectionEntry<"events">): boolean {
	const normalizedCity = event.data.city.trim().toLowerCase();
	return (
		normalizedCity.includes("bandung") &&
		!normalizedCity.includes("barat") &&
		!normalizedCity.includes("kabupaten")
	);
}

export function isJabodetabekMajorEvent(
	event: CollectionEntry<"events">,
): boolean {
	return (
		event.data.region === "Jabodetabek" &&
		(event.data.majorEvent === true ||
			event.data.eventType === "Convention / Expo" ||
			event.data.eventType === "Idol / Anisong Live")
	);
}

export function getHomeScheduleScope(
	event: CollectionEntry<"events">,
): HomeScheduleScope | null {
	if (isKotaBandungEvent(event)) {
		return "kota-bandung";
	}
	if (isJabodetabekMajorEvent(event)) {
		return "jabodetabek-major";
	}
	return null;
}

export async function getUpcomingEvents(
	limit?: number,
): Promise<CollectionEntry<"events">[]> {
	const allEvents = await getAllEvents();
	const upcoming = allEvents
		.filter((event) => isEventUpcoming(event))
		.sort((a, b) => a.data.startDate.getTime() - b.data.startDate.getTime());

	return typeof limit === "number" ? upcoming.slice(0, limit) : upcoming;
}

export async function getHomepageUpcomingEvents(
	limit?: number,
): Promise<CollectionEntry<"events">[]> {
	const upcoming = await getUpcomingEvents();
	const scoped = upcoming
		.filter((event) => getHomeScheduleScope(event) !== null)
		.sort((a, b) => {
			const priorityA = getHomeScheduleScope(a) === "kota-bandung" ? 0 : 1;
			const priorityB = getHomeScheduleScope(b) === "kota-bandung" ? 0 : 1;
			if (priorityA !== priorityB) {
				return priorityA - priorityB;
			}
			return a.data.startDate.getTime() - b.data.startDate.getTime();
		});

	return typeof limit === "number" ? scoped.slice(0, limit) : scoped;
}

export async function getPastEvents(): Promise<CollectionEntry<"events">[]> {
	const allEvents = await getAllEvents();
	return allEvents
		.filter((event) => !isEventUpcoming(event))
		.sort((a, b) => b.data.startDate.getTime() - a.data.startDate.getTime());
}

export async function getEventsForPerformer(performerId: string): Promise<{
	upcoming: CollectionEntry<"events">[];
	past: CollectionEntry<"events">[];
}> {
	const normalizedId = removeFileExtension(performerId);
	const allEvents = await getAllEvents();

	const matching = allEvents.filter((event) =>
		event.data.lineup.some(
			(ref) => removeFileExtension(ref.id) === normalizedId,
		),
	);

	const upcoming = matching
		.filter((event) => isEventUpcoming(event))
		.sort((a, b) => a.data.startDate.getTime() - b.data.startDate.getTime());
	const past = matching
		.filter((event) => !isEventUpcoming(event))
		.sort((a, b) => b.data.startDate.getTime() - a.data.startDate.getTime());

	return { upcoming, past };
}

export async function resolveEventLineup(
	event: CollectionEntry<"events">,
): Promise<CollectionEntry<"performers">[]> {
	if (!event.data.lineup || event.data.lineup.length === 0) {
		return [];
	}

	const resolved = await getEntries(event.data.lineup);
	return resolved.filter(
		(entry): entry is CollectionEntry<"performers"> =>
			Boolean(entry) &&
			(import.meta.env.PROD ? entry.data.draft !== true : true),
	);
}

export function formatEventDateRange(startDate: Date, endDate?: Date): string {
	const formatMonthDay = (d: Date, includeYear: boolean): string => {
		const options: Intl.DateTimeFormatOptions = {
			month: "short",
			day: "numeric",
			...(includeYear ? { year: "numeric" } : {}),
			...(isDateOnly(d) ? { timeZone: "UTC" } : {}),
		};
		return new Intl.DateTimeFormat("en-US", options).format(d);
	};

	if (
		!endDate ||
		formatDateToYYYYMMDD(startDate) === formatDateToYYYYMMDD(endDate)
	) {
		return formatMonthDay(startDate, true);
	}

	const startYmd = formatDateToYYYYMMDD(startDate);
	const endYmd = formatDateToYYYYMMDD(endDate);
	const sameYear = startYmd.slice(0, 4) === endYmd.slice(0, 4);
	const sameMonth = sameYear && startYmd.slice(5, 7) === endYmd.slice(5, 7);

	if (sameMonth) {
		const dayPart = new Intl.DateTimeFormat("en-US", {
			day: "numeric",
			...(isDateOnly(endDate) ? { timeZone: "UTC" } : {}),
		}).format(endDate);
		const monthPart = new Intl.DateTimeFormat("en-US", {
			month: "short",
			...(isDateOnly(startDate) ? { timeZone: "UTC" } : {}),
		}).format(startDate);
		const startDay = new Intl.DateTimeFormat("en-US", {
			day: "numeric",
			...(isDateOnly(startDate) ? { timeZone: "UTC" } : {}),
		}).format(startDate);
		const yearPart = startYmd.slice(0, 4);
		return `${monthPart} ${startDay} - ${dayPart}, ${yearPart}`;
	}

	return `${formatMonthDay(startDate, !sameYear)} - ${formatMonthDay(endDate, true)}`;
}

export function getEventCalendarParts(date: Date): {
	month: string;
	day: string;
	year: string;
} {
	const useUtc = isDateOnly(date);
	const month = new Intl.DateTimeFormat("en-US", {
		month: "short",
		...(useUtc ? { timeZone: "UTC" } : {}),
	})
		.format(date)
		.toUpperCase();
	const day = new Intl.DateTimeFormat("en-US", {
		day: "2-digit",
		...(useUtc ? { timeZone: "UTC" } : {}),
	}).format(date);
	const year = formatDateToYYYYMMDD(date).slice(0, 4);
	return { month, day, year };
}

export function formatEventMonthKey(date: Date): string {
	return formatDateToYYYYMMDD(date).slice(0, 7);
}

export function formatEventMonthLabel(monthKey: string): string {
	const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
	if (!match) return monthKey;
	const year = Number(match[1]);
	const monthIndex = Number(match[2]) - 1;
	const utcDate = new Date(Date.UTC(year, monthIndex, 1));
	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	}).format(utcDate);
}

export function getEventStatusMeta(status: EventStatus): {
	label: string;
	className: string;
} {
	switch (status) {
		case "ongoing":
			return {
				label: "Ongoing",
				className:
					"bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700/60",
			};
		case "completed":
			return {
				label: "Past Event",
				className:
					"bg-neutral-200/80 text-neutral-800 border border-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700",
			};
		case "postponed":
			return {
				label: "Postponed",
				className:
					"bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700/60",
			};
		case "cancelled":
			return {
				label: "Cancelled",
				className:
					"bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-700/60",
			};
		default:
			return {
				label: "Upcoming",
				className:
					"bg-(--btn-regular-bg) text-(--btn-content) border border-(--primary)/25",
			};
	}
}

export function getAdmissionMeta(
	entryType: EventEntryType,
	htm: string,
): {
	label: string;
	className: string;
	kind: EventEntryType;
} {
	const cleaned = htm.trim();
	if (entryType === "free") {
		return {
			kind: "free",
			label: cleaned || "Free Entry",
			className:
				"bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700/60",
		};
	}
	if (entryType === "paid") {
		const paidLabel = cleaned
			? /^htm\b/i.test(cleaned)
				? cleaned
				: `HTM ${cleaned}`
			: "Paid HTM";
		return {
			kind: "paid",
			label: paidLabel,
			className:
				"bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700/60",
		};
	}
	return {
		kind: "tba",
		label: cleaned || "HTM TBA",
		className:
			"bg-neutral-100 text-neutral-800 border border-neutral-300 dark:bg-neutral-800/80 dark:text-neutral-200 dark:border-neutral-700",
	};
}

export function normalizeInstagramLink(value: string): {
	handle: string;
	url: string;
} | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	if (/^https?:\/\//i.test(trimmed)) {
		try {
			const parsed = new URL(trimmed);
			const segment = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
			const handle = segment ? `@${segment.replace(/^@/, "")}` : "Instagram";
			return { handle, url: parsed.toString() };
		} catch {
			return null;
		}
	}

	const cleanHandle = trimmed.replace(/^@+/, "").split(/[/?#]/)[0];
	if (!cleanHandle) return null;
	return {
		handle: `@${cleanHandle}`,
		url: `https://www.instagram.com/${encodeURIComponent(cleanHandle)}/`,
	};
}

export function getIanaTimezone(timezone: EventTimezone): string {
	switch (timezone) {
		case "WITA":
			return "Asia/Makassar";
		case "WIT":
			return "Asia/Jayapura";
		default:
			return "Asia/Jakarta";
	}
}

function addDaysYmd(ymd: string, days: number): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
	if (!match) return ymd;
	const dt = new Date(
		Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days),
	);
	return dt.toISOString().slice(0, 10);
}

function parseTimeRange(
	timeStr: string,
): { start: string; end: string } | null {
	const match = /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/.exec(timeStr);
	if (!match) return null;
	const pad = (n: string) => n.padStart(2, "0");
	return {
		start: `${pad(match[1])}${match[2]}00`,
		end: `${pad(match[3])}${match[4]}00`,
	};
}

export function buildGoogleCalendarUrl(
	event: CollectionEntry<"events">,
	absoluteEventUrl: string,
): string {
	const startYmd = formatDateToYYYYMMDD(event.data.startDate);
	const endYmd = event.data.endDate
		? formatDateToYYYYMMDD(event.data.endDate)
		: startYmd;
	const isSingleDay = startYmd === endYmd;
	const parsedTime = isSingleDay ? parseTimeRange(event.data.time) : null;

	const compact = (ymd: string) => ymd.replaceAll("-", "");
	const datesParam = parsedTime
		? `${compact(startYmd)}T${parsedTime.start}/${compact(endYmd)}T${parsedTime.end}`
		: `${compact(startYmd)}/${compact(addDaysYmd(endYmd, 1))}`;

	const admission = getAdmissionMeta(event.data.entryType, event.data.htm);
	const detailLines = [
		event.data.description,
		`Admission: ${admission.label}`,
		event.data.organizer ? `Organizer: ${event.data.organizer}` : "",
		absoluteEventUrl ? `Event info: ${absoluteEventUrl}` : "",
	].filter(Boolean);

	const params = new URLSearchParams({
		action: "TEMPLATE",
		text: event.data.title,
		dates: datesParam,
		location: `${event.data.venue}, ${event.data.city}`,
		details: detailLines.join("\n"),
	});
	if (parsedTime) {
		params.set("ctz", getIanaTimezone(event.data.timezone));
	}

	return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcsText(value: string): string {
	return value
		.replaceAll("\\", "\\\\")
		.replaceAll(";", "\\;")
		.replaceAll(",", "\\,")
		.replaceAll("\r\n", "\\n")
		.replaceAll("\n", "\\n");
}

export function buildIcsContent(
	event: CollectionEntry<"events">,
	absoluteEventUrl: string,
): string {
	const startYmd = formatDateToYYYYMMDD(event.data.startDate);
	const endYmd = event.data.endDate
		? formatDateToYYYYMMDD(event.data.endDate)
		: startYmd;
	const compact = (ymd: string) => ymd.replaceAll("-", "");
	const dtStart = compact(startYmd);
	const dtEndExclusive = compact(addDaysYmd(endYmd, 1));
	const stamp = new Date()
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}Z$/, "Z");
	const admission = getAdmissionMeta(event.data.entryType, event.data.htm);
	const descParts = [
		event.data.description,
		event.data.time ? `Hours: ${event.data.time} ${event.data.timezone}` : "",
		`Admission: ${admission.label}`,
		event.data.organizer ? `Organizer: ${event.data.organizer}` : "",
		absoluteEventUrl ? `More info: ${absoluteEventUrl}` : "",
	].filter(Boolean);

	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Axia Zone ID//Event Schedule//EN",
		"CALSCALE:GREGORIAN",
		"BEGIN:VEVENT",
		`UID:${removeFileExtension(event.id)}@axia-zone-id`,
		`DTSTAMP:${stamp}`,
		`DTSTART;VALUE=DATE:${dtStart}`,
		`DTEND;VALUE=DATE:${dtEndExclusive}`,
		`SUMMARY:${escapeIcsText(event.data.title)}`,
		`LOCATION:${escapeIcsText(`${event.data.venue}, ${event.data.city}`)}`,
		`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`,
		...(absoluteEventUrl ? [`URL:${absoluteEventUrl}`] : []),
		"END:VEVENT",
		"END:VCALENDAR",
	];

	return `${lines.join("\r\n")}\r\n`;
}

export async function serializeEventsForBrowser(): Promise<
	SerializedWikiEvent[]
> {
	const allEvents = await getAllEvents();
	return Promise.all(
		allEvents.map(async (event) => {
			const lineup = await resolveEventLineup(event);
			const startYmd = formatDateToYYYYMMDD(event.data.startDate);
			const endYmd = event.data.endDate
				? formatDateToYYYYMMDD(event.data.endDate)
				: startYmd;
			const monthKey = formatEventMonthKey(event.data.startDate);
			const statusMeta = getEventStatusMeta(event.data.status);
			const admissionMeta = getAdmissionMeta(
				event.data.entryType,
				event.data.htm,
			);

			return {
				id: event.id,
				slug: removeFileExtension(event.id),
				href: getEventUrl(event.id),
				title: event.data.title,
				startYmd,
				endYmd,
				dateRange: formatEventDateRange(
					event.data.startDate,
					event.data.endDate,
				),
				monthKey,
				monthLabel: formatEventMonthLabel(monthKey),
				dateParts: getEventCalendarParts(event.data.startDate),
				venue: event.data.venue,
				city: event.data.city,
				region: event.data.region,
				eventType: event.data.eventType,
				entryType: event.data.entryType,
				admissionLabel: admissionMeta.label,
				admissionClass: admissionMeta.className,
				admissionKind: admissionMeta.kind,
				time: event.data.time,
				timezone: event.data.timezone,
				organizer: event.data.organizer,
				highlights: event.data.highlights,
				status: event.data.status,
				statusLabel: statusMeta.label,
				statusClass: statusMeta.className,
				ticketUrl: event.data.ticketUrl,
				description: event.data.description,
				tags: event.data.tags,
				lineup: lineup.map((p) => ({
					name: p.data.name,
					href: getPerformerUrl(p.id),
				})),
				isUpcoming: isEventUpcoming(event),
			};
		}),
	);
}

export function getPerformerInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export {
	type EventCategoryTone,
	getEventCategoryTone,
} from "@/utils/event-tone";
