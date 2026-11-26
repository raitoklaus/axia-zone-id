import { type CollectionEntry, getCollection, getEntries } from "astro:content";
import { formatDateToYYYYMMDD, isDateOnly } from "@/utils/date-utils";
import { removeFileExtension } from "@/utils/url-utils";

export type EventStatus =
	| "upcoming"
	| "ongoing"
	| "completed"
	| "cancelled"
	| "postponed";

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

export async function getUpcomingEvents(
	limit?: number,
): Promise<CollectionEntry<"events">[]> {
	const allEvents = await getAllEvents();
	const upcoming = allEvents
		.filter((event) => isEventUpcoming(event))
		.sort((a, b) => a.data.startDate.getTime() - b.data.startDate.getTime());

	return typeof limit === "number" ? upcoming.slice(0, limit) : upcoming;
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

export function getPerformerInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
