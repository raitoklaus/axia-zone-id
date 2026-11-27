<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import { getEventCategoryTone } from "@/utils/event-tone";
import type { SerializedWikiEvent } from "@/utils/wiki-utils";

export let events: SerializedWikiEvent[] = [];

type TimeFilter = "all" | "upcoming" | "past";
type AdmissionFilter = "all" | "free" | "paid";
type ViewMode = "list" | "calendar";

const SAVED_EVENTS_STORAGE_KEY = "axia-saved-events-v1";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

let searchQuery = "";
let timeFilter: TimeFilter = "all";
let admissionFilter: AdmissionFilter = "all";
let regionFilter = "all";
let eventTypeFilter = "all";
let savedOnly = false;
let savedSlugs: Set<string> = new Set();
let activeView: ViewMode = "list";

let todayYmd = "";
let calendarYear = 2026;
let calendarMonth = 11; // 0-indexed (11 = Dec)
let selectedDayYmd = "";

let listTabEl: HTMLButtonElement | undefined;
let calendarTabEl: HTMLButtonElement | undefined;

function getJakartaTodayYmd(): string {
	try {
		return new Intl.DateTimeFormat("en-CA", {
			timeZone: "Asia/Jakarta",
		}).format(new Date());
	} catch {
		return new Date().toISOString().slice(0, 10);
	}
}

function parseUtcDayMs(ymd: string): number {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
	if (!match) return Number.NaN;
	return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function getCountdownLabel(
	startYmd: string,
	endYmd: string,
	currentYmd: string,
): string {
	if (!currentYmd) return "";
	const todayMs = parseUtcDayMs(currentYmd);
	const startMs = parseUtcDayMs(startYmd);
	const endMs = parseUtcDayMs(endYmd || startYmd);
	if (Number.isNaN(todayMs) || Number.isNaN(startMs) || Number.isNaN(endMs)) {
		return "";
	}

	const diffStart = Math.round((startMs - todayMs) / 86400000);
	const diffEnd = Math.round((endMs - todayMs) / 86400000);
	if (diffEnd < 0) return "";
	if (diffStart <= 0 && diffEnd >= 0) {
		return startYmd === endYmd ? "Today" : "Ongoing";
	}
	if (diffStart === 1) return "Tomorrow";
	if (diffStart <= 6) {
		const todayDow = new Date(todayMs).getUTCDay();
		const startDow = new Date(startMs).getUTCDay();
		const daysUntilSat = (6 - todayDow + 7) % 7;
		if ((startDow === 0 || startDow === 6) && diffStart <= daysUntilSat + 1) {
			return "This Weekend";
		}
		return `H-${diffStart}`;
	}
	if (diffStart <= 60) return `H-${diffStart}`;
	return "";
}

function formatYmd(year: number, monthIndex: number, day: number): string {
	return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatMonthTitle(year: number, monthIndex: number): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(Date.UTC(year, monthIndex, 1)));
}

function formatDayHeading(ymd: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
	if (!match) return ymd;
	return new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(
		new Date(
			Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
		),
	);
}

function initDefaultMonth(sourceEvents: SerializedWikiEvent[]): void {
	const upcoming = sourceEvents
		.filter((ev) => ev.isUpcoming)
		.sort((a, b) => a.startYmd.localeCompare(b.startYmd));
	const anchorYmd =
		upcoming[0]?.startYmd || sourceEvents[0]?.startYmd || todayYmd;
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anchorYmd);
	if (match) {
		calendarYear = Number(match[1]);
		calendarMonth = Number(match[2]) - 1;
		selectedDayYmd = anchorYmd;
	}
}

function readSavedEventSlugs(): Set<string> {
	try {
		const raw = window.localStorage.getItem(SAVED_EVENTS_STORAGE_KEY);
		if (!raw) return new Set();
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return new Set();
		return new Set(parsed.filter((v): v is string => typeof v === "string"));
	} catch {
		return new Set();
	}
}

function toggleSavedEvent(slug: string): void {
	const next = new Set(savedSlugs);
	if (next.has(slug)) {
		next.delete(slug);
	} else {
		next.add(slug);
	}
	savedSlugs = next;
	try {
		window.localStorage.setItem(
			SAVED_EVENTS_STORAGE_KEY,
			JSON.stringify(Array.from(next)),
		);
		window.dispatchEvent(new CustomEvent("axia-saved-events-change"));
	} catch {
		// Ignore storage write errors in private mode
	}
}

onMount(() => {
	todayYmd = getJakartaTodayYmd();
	initDefaultMonth(events);
	savedSlugs = readSavedEventSlugs();

	const handleSavedSync = () => {
		savedSlugs = readSavedEventSlugs();
	};
	const handleStorage = (ev: StorageEvent) => {
		if (ev.key === SAVED_EVENTS_STORAGE_KEY) {
			handleSavedSync();
		}
	};
	window.addEventListener("storage", handleStorage);
	window.addEventListener("axia-saved-events-change", handleSavedSync);
	return () => {
		window.removeEventListener("storage", handleStorage);
		window.removeEventListener("axia-saved-events-change", handleSavedSync);
	};
});

initDefaultMonth(events);

$: availableRegions = Array.from(
	new Set(events.map((e) => e.region).filter(Boolean)),
);

$: availableTypes = Array.from(
	new Set(events.map((e) => e.eventType).filter(Boolean)),
);

$: savedCount = events.filter((e) => savedSlugs.has(e.slug)).length;

$: hasActiveFilters =
	searchQuery.trim() !== "" ||
	timeFilter !== "all" ||
	admissionFilter !== "all" ||
	regionFilter !== "all" ||
	eventTypeFilter !== "all" ||
	savedOnly;

$: filteredEvents = events.filter((ev) => {
	if (savedOnly && !savedSlugs.has(ev.slug)) return false;

	const timeMatch =
		timeFilter === "all" ||
		(timeFilter === "upcoming" ? ev.isUpcoming : !ev.isUpcoming);
	if (!timeMatch) return false;

	const admissionMatch =
		admissionFilter === "all" || ev.admissionKind === admissionFilter;
	if (!admissionMatch) return false;

	const regionMatch = regionFilter === "all" || ev.region === regionFilter;
	if (!regionMatch) return false;

	const typeMatch =
		eventTypeFilter === "all" || ev.eventType === eventTypeFilter;
	if (!typeMatch) return false;

	const q = searchQuery.trim().toLowerCase();
	if (!q) return true;

	const haystack = [
		ev.title,
		ev.venue,
		ev.city,
		ev.region,
		ev.eventType,
		ev.organizer,
		ev.admissionLabel,
		...ev.highlights,
		...ev.tags,
		...ev.lineup.map((p) => p.name),
	]
		.join(" ")
		.toLowerCase();
	return haystack.includes(q);
});

type MonthGroup = {
	monthKey: string;
	monthLabel: string;
	items: SerializedWikiEvent[];
};

function groupEventsByMonth(
	list: SerializedWikiEvent[],
	descending: boolean,
): MonthGroup[] {
	const sorted = [...list].sort((a, b) =>
		descending
			? b.startYmd.localeCompare(a.startYmd)
			: a.startYmd.localeCompare(b.startYmd),
	);
	const map = new Map<string, MonthGroup>();
	for (const ev of sorted) {
		let group = map.get(ev.monthKey);
		if (!group) {
			group = {
				monthKey: ev.monthKey,
				monthLabel: ev.monthLabel,
				items: [],
			};
			map.set(ev.monthKey, group);
		}
		group.items.push(ev);
	}
	return Array.from(map.values());
}

$: upcomingGroups = groupEventsByMonth(
	filteredEvents.filter((e) => e.isUpcoming),
	false,
);
$: pastGroups = groupEventsByMonth(
	filteredEvents.filter((e) => !e.isUpcoming),
	true,
);

$: activeCalendarMonthKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}`;

$: calendarMonthsWithEvents = Array.from(
	new Map(
		[...filteredEvents]
			.sort((a, b) => a.startYmd.localeCompare(b.startYmd))
			.map((ev) => [ev.monthKey, { key: ev.monthKey, label: ev.monthLabel }]),
	).values(),
);

type CalendarCell = {
	ymd: string;
	day: number;
	inCurrentMonth: boolean;
	isToday: boolean;
	events: SerializedWikiEvent[];
};

$: calendarCells = buildCalendarGrid(
	calendarYear,
	calendarMonth,
	filteredEvents,
	todayYmd,
);

function buildCalendarGrid(
	year: number,
	monthIndex: number,
	list: SerializedWikiEvent[],
	currentTodayYmd: string,
): CalendarCell[] {
	const firstDayUtc = new Date(Date.UTC(year, monthIndex, 1));
	const jsDow = firstDayUtc.getUTCDay(); // 0=Sun..6=Sat
	const mondayOffset = (jsDow + 6) % 7;
	const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
	const totalCells = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;

	const cells: CalendarCell[] = [];
	for (let i = 0; i < totalCells; i++) {
		const dt = new Date(Date.UTC(year, monthIndex, 1 - mondayOffset + i));
		const cellY = dt.getUTCFullYear();
		const cellM = dt.getUTCMonth();
		const cellD = dt.getUTCDate();
		const ymd = formatYmd(cellY, cellM, cellD);
		const dayEvents = list.filter(
			(ev) => ev.startYmd <= ymd && ymd <= (ev.endYmd || ev.startYmd),
		);
		cells.push({
			ymd,
			day: cellD,
			inCurrentMonth: cellY === year && cellM === monthIndex,
			isToday: Boolean(currentTodayYmd && ymd === currentTodayYmd),
			events: dayEvents,
		});
	}
	return cells;
}

$: monthEvents = filteredEvents.filter((ev) => {
	const monthStart = `${activeCalendarMonthKey}-01`;
	const monthEnd = `${activeCalendarMonthKey}-31`;
	const endYmd = ev.endYmd || ev.startYmd;
	return ev.startYmd <= monthEnd && endYmd >= monthStart;
});

$: selectedDayEvents = selectedDayYmd
	? filteredEvents.filter(
			(ev) =>
				ev.startYmd <= selectedDayYmd &&
				selectedDayYmd <= (ev.endYmd || ev.startYmd),
		)
	: [];

function resetFilters(): void {
	searchQuery = "";
	timeFilter = "all";
	admissionFilter = "all";
	regionFilter = "all";
	eventTypeFilter = "all";
	savedOnly = false;
}

function selectView(view: ViewMode, focusTab = false): void {
	activeView = view;
	if (focusTab) {
		const target = view === "list" ? listTabEl : calendarTabEl;
		target?.focus();
	}
}

function handleTabKeydown(event: KeyboardEvent): void {
	if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
		event.preventDefault();
		selectView(activeView === "list" ? "calendar" : "list", true);
	} else if (event.key === "Home") {
		event.preventDefault();
		selectView("list", true);
	} else if (event.key === "End") {
		event.preventDefault();
		selectView("calendar", true);
	}
}

function shiftMonth(delta: number): void {
	const dt = new Date(Date.UTC(calendarYear, calendarMonth + delta, 1));
	calendarYear = dt.getUTCFullYear();
	calendarMonth = dt.getUTCMonth();
	autoSelectDayInMonth();
}

function jumpToMonth(monthKey: string): void {
	const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
	if (!match) return;
	calendarYear = Number(match[1]);
	calendarMonth = Number(match[2]) - 1;
	autoSelectDayInMonth();
}

function jumpToToday(): void {
	const refYmd = todayYmd || getJakartaTodayYmd();
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(refYmd);
	if (!match) return;
	calendarYear = Number(match[1]);
	calendarMonth = Number(match[2]) - 1;
	selectedDayYmd = refYmd;
}

function autoSelectDayInMonth(): void {
	const prefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}`;
	const firstInMonth = filteredEvents.find(
		(ev) =>
			ev.startYmd.startsWith(prefix) || Boolean(ev.endYmd?.startsWith(prefix)),
	);
	if (firstInMonth) {
		selectedDayYmd = firstInMonth.startYmd.startsWith(prefix)
			? firstInMonth.startYmd
			: `${prefix}-01`;
	} else {
		selectedDayYmd = "";
	}
}

function selectDayCell(cell: CalendarCell): void {
	if (!cell.inCurrentMonth) {
		const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cell.ymd);
		if (match) {
			calendarYear = Number(match[1]);
			calendarMonth = Number(match[2]) - 1;
		}
	}
	selectedDayYmd = cell.ymd;
}
</script>

<div class="flex flex-col gap-4">
	<!-- Search & Filters Card -->
	<div class="card-base p-4 md:p-5">
		<div class="flex flex-col gap-3.5">
			<div class="relative">
				<label for="event-search-input" class="sr-only">
					Search events by title, venue, city, region, organizer, or performer
				</label>
				<Icon
					icon="material-symbols:search"
					class="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4b526e] dark:text-slate-400 text-lg pointer-events-none"
				/>
				<input
					id="event-search-input"
					type="search"
					bind:value={searchQuery}
					placeholder="Search events, venues, cities, EO, highlights, or performers..."
					class="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-md border border-(--line-divider) bg-transparent text-[#2b314a] dark:text-slate-100 placeholder-[#4b526e] dark:placeholder-slate-400 focus:border-[#0c6fc4] focus:ring-1 focus:ring-[#0c6fc4] transition-colors text-sm"
				/>
			</div>

			<div class="grid gap-3 sm:grid-cols-2">
				<div>
					<label
						for="event-region-select"
						class="block text-xs font-bold uppercase tracking-wider text-[#4b526e] dark:text-slate-300 mb-1"
					>
						Region
					</label>
					<select
						id="event-region-select"
						bind:value={regionFilter}
						class="w-full min-h-[44px] px-3 py-2 rounded-md border border-(--line-divider) bg-(--card-bg) text-[#2b314a] dark:text-slate-100 text-sm cursor-pointer focus:border-[#0c6fc4]"
					>
						<option value="all">All Regions</option>
						{#each availableRegions as region}
							<option value={region}>{region}</option>
						{/each}
					</select>
				</div>

				<div>
					<label
						for="event-type-select"
						class="block text-xs font-bold uppercase tracking-wider text-[#4b526e] dark:text-slate-300 mb-1"
					>
						Event Type
					</label>
					<select
						id="event-type-select"
						bind:value={eventTypeFilter}
						class="w-full min-h-[44px] px-3 py-2 rounded-md border border-(--line-divider) bg-(--card-bg) text-[#2b314a] dark:text-slate-100 text-sm cursor-pointer focus:border-[#0c6fc4]"
					>
						<option value="all">All Event Types</option>
						{#each availableTypes as type}
							<option value={type}>{type}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="flex flex-wrap items-center justify-between gap-3 pt-1">
				<div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by timeframe">
					<button
						type="button"
						on:click={() => (timeFilter = "all")}
						aria-pressed={timeFilter === "all"}
						class="filter-pill min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
						class:active={timeFilter === "all"}
					>
						All ({events.length})
					</button>
					<button
						type="button"
						on:click={() => (timeFilter = "upcoming")}
						aria-pressed={timeFilter === "upcoming"}
						class="filter-pill min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
						class:active={timeFilter === "upcoming"}
					>
						Upcoming ({events.filter((e) => e.isUpcoming).length})
					</button>
					<button
						type="button"
						on:click={() => (timeFilter = "past")}
						aria-pressed={timeFilter === "past"}
						class="filter-pill min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
						class:active={timeFilter === "past"}
					>
						Past Archive ({events.filter((e) => !e.isUpcoming).length})
					</button>
					<button
						type="button"
						on:click={() => (savedOnly = !savedOnly)}
						aria-pressed={savedOnly}
						class="filter-pill inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
						class:active={savedOnly}
					>
						<Icon
							icon={savedOnly ? "material-symbols:bookmark-rounded" : "material-symbols:bookmark-outline-rounded"}
							class="text-base shrink-0"
						/>
						<span>Saved ({savedCount})</span>
					</button>
				</div>

				<div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by admission">
					<button
						type="button"
						on:click={() => (admissionFilter = "all")}
						aria-pressed={admissionFilter === "all"}
						class="filter-pill min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
						class:active={admissionFilter === "all"}
					>
						All HTM
					</button>
					<button
						type="button"
						on:click={() => (admissionFilter = "free")}
						aria-pressed={admissionFilter === "free"}
						class="filter-pill min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
						class:active={admissionFilter === "free"}
					>
						Free Entry
					</button>
					<button
						type="button"
						on:click={() => (admissionFilter = "paid")}
						aria-pressed={admissionFilter === "paid"}
						class="filter-pill min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
						class:active={admissionFilter === "paid"}
					>
						Paid HTM
					</button>
				</div>
			</div>

			<div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-(--line-divider)">
				<p class="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300">
					Showing <strong>{filteredEvents.length}</strong> of {events.length} events
				</p>

				<div class="flex items-center gap-3">
					{#if hasActiveFilters}
						<button
							type="button"
							on:click={resetFilters}
							class="min-h-[44px] px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-(--primary) hover:bg-(--btn-plain-bg-hover) cursor-pointer transition-colors"
						>
							Reset filters
						</button>
					{/if}

					<!-- Accessible View Tabs (List View / Calendar View) -->
					<div
						role="tablist"
						aria-label="Schedule display mode"
						class="flex items-center overflow-x-auto border-b border-(--line-divider)"
					>
						<button
							bind:this={listTabEl}
							type="button"
							id="events-tab-list"
							role="tab"
							aria-selected={activeView === "list"}
							tabindex={activeView === "list" ? 0 : -1}
							on:click={() => selectView("list")}
							on:keydown={handleTabKeydown}
							class="view-tab inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors"
						>
							<Icon icon="material-symbols:view-agenda-outline-rounded" class="text-base" />
							<span>List View</span>
						</button>
						<button
							bind:this={calendarTabEl}
							type="button"
							id="events-tab-calendar"
							role="tab"
							aria-selected={activeView === "calendar"}
							tabindex={activeView === "calendar" ? 0 : -1}
							on:click={() => selectView("calendar")}
							on:keydown={handleTabKeydown}
							class="view-tab inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors"
						>
							<Icon icon="material-symbols:calendar-month-rounded" class="text-base" />
							<span>Calendar View</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>

	{#if events.length === 0}
		<div class="card-base flex flex-col items-center justify-center py-14 px-6 text-center">
			<Icon
				icon="material-symbols:calendar-month-rounded"
				class="text-5xl mb-3 text-neutral-500 dark:text-neutral-400"
			/>
			<p class="text-base font-medium text-neutral-800 dark:text-neutral-200">
				No events have been added yet.
			</p>
			<p class="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
				Add Markdown entries under <code>src/content/events/</code> or via the online CMS.
			</p>
		</div>
	{:else if filteredEvents.length === 0}
		<div class="card-base flex flex-col items-center justify-center py-12 px-6 text-center">
			<Icon
				icon="material-symbols:search-off-rounded"
				class="text-4xl mb-3 text-neutral-500 dark:text-neutral-400"
			/>
			<p class="text-sm font-medium text-neutral-800 dark:text-neutral-200">
				No events match the active search or filters.
			</p>
			<button
				type="button"
				on:click={resetFilters}
				class="mt-3 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-(--btn-regular-bg) text-(--btn-content) hover:bg-(--btn-regular-bg-hover) cursor-pointer transition-colors"
			>
				Reset filters
			</button>
		</div>
	{:else}
		<!-- Panel 1: Month-Grouped List View -->
		<div
			role="tabpanel"
			aria-labelledby="events-tab-list"
			hidden={activeView !== "list"}
		>
			<div class="flex flex-col gap-8">
				{#if upcomingGroups.length > 0}
					<section>
						<h3 class="text-lg md:text-xl font-extrabold uppercase tracking-wider text-[#2b314a] dark:text-slate-100 mb-4" style="font-family: var(--font-montserrat, sans-serif)">
							Upcoming Events
						</h3>
						<div class="flex flex-col gap-6">
							{#each upcomingGroups as group}
								<div>
									<h4 class="text-xs font-extrabold uppercase tracking-[0.12em] text-[#0c6fc4] dark:text-[#7ee8ff] mb-3" style="font-family: var(--font-montserrat, sans-serif)">
										{group.monthLabel}
									</h4>
									<ul role="list" class="grid gap-4 list-none p-0 m-0" style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));">
										{#each group.items as ev}
											{@const countdown = getCountdownLabel(ev.startYmd, ev.endYmd, todayYmd)}
											{@const tone = getEventCategoryTone(ev.eventType)}
											<li class="flex">
												<article class="axia-sekai-card flex flex-col w-full min-w-0">
													<div class="axia-split-bar">
														<time datetime={ev.startYmd} class="axia-split-date">
															<span>{ev.startYmd.replaceAll("-", ".")}</span>
														</time>
														<div class="axia-split-type" data-cat-tone={tone}>
															<span class="truncate">
																{ev.eventType || "ACG Event"}{ev.region ? ` · ${ev.region}` : ""}
															</span>
															<span class="shrink-0 opacity-95">
																{ev.statusLabel}
															</span>
														</div>
													</div>

													<div class="p-5 flex-1 flex flex-col gap-3 min-w-0">
														<div class="flex flex-wrap items-center gap-2">
															<h5 class="text-lg font-bold text-[#2b314a] dark:text-slate-100 leading-snug">
																<a href={ev.href} class="hover:text-[#0c6fc4] dark:hover:text-[#7ee8ff] transition-colors">
																	{ev.title}
																</a>
															</h5>
															{#if countdown}
																<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-900 border border-sky-300 dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-700/60">
																	{countdown}
																</span>
															{/if}
															<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ev.admissionClass}`}>
																{ev.admissionLabel}
															</span>
														</div>

														<p class="text-sm text-[#4b526e] dark:text-slate-300">
															{ev.dateRange}{ev.time ? ` (${ev.time} ${ev.timezone})` : ""} · {ev.venue}, {ev.city}
														</p>

														{#if ev.organizer}
															<p class="text-xs text-[#4b526e] dark:text-slate-300">
																Organizer: {ev.organizer}
															</p>
														{/if}

														{#if ev.description}
															<p class="text-sm text-[#4b526e] dark:text-slate-300 line-clamp-2">
																{ev.description}
															</p>
														{/if}

														{#if ev.highlights.length > 0}
															<ul role="list" aria-label={`Highlights for ${ev.title}`} class="flex flex-wrap gap-1.5 list-none p-0 m-0">
																{#each ev.highlights.slice(0, 5) as item}
																	<li class="px-2 py-0.5 rounded text-xs font-medium border border-(--line-divider) text-[#4b526e] dark:text-slate-300">
																		{item}
																	</li>
																{/each}
															</ul>
														{/if}

														{#if ev.lineup.length > 0}
															<ul
																role="list"
																aria-label={`Lineup for ${ev.title}`}
																class="flex flex-wrap items-center gap-2 list-none p-0 m-0"
															>
																{#each ev.lineup as performer}
																	<li>
																		<a
																			href={performer.href}
																			class="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-full text-xs font-medium bg-(--btn-regular-bg) text-(--btn-content) hover:bg-(--btn-regular-bg-hover) transition-colors"
																		>
																			<Icon icon="material-symbols:person-rounded" class="text-sm shrink-0" />
																			<span>{performer.name}</span>
																		</a>
																	</li>
																{/each}
															</ul>
														{/if}

														<div class="mt-auto pt-3 border-t border-black/8 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
															<a
																href={ev.href}
																class="inline-flex items-center gap-1 min-h-[44px] sm:min-h-[36px] text-xs font-bold uppercase tracking-wider text-[#0c6fc4] dark:text-[#7ee8ff] hover:underline"
																style="font-family: var(--font-montserrat, sans-serif)"
															>
																<span>Event Details</span>
																<Icon icon="material-symbols:chevron-right-rounded" class="text-base" />
															</a>

															<div class="flex items-center gap-2">
																<button
																	type="button"
																	on:click={() => toggleSavedEvent(ev.slug)}
																	aria-pressed={savedSlugs.has(ev.slug)}
																	aria-label={savedSlugs.has(ev.slug) ? `Remove ${ev.title} from My Schedule` : `Save ${ev.title} to My Schedule`}
																	class="save-event-btn inline-flex items-center gap-1 min-h-[44px] sm:min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors"
																	class:saved={savedSlugs.has(ev.slug)}
																>
																	<Icon
																		icon={savedSlugs.has(ev.slug) ? "material-symbols:bookmark-rounded" : "material-symbols:bookmark-outline-rounded"}
																		class="text-sm shrink-0"
																	/>
																	<span>{savedSlugs.has(ev.slug) ? "Saved" : "Save"}</span>
																</button>

																{#if ev.ticketUrl}
																	<a
																		href={ev.ticketUrl}
																		target="_blank"
																		rel="noopener noreferrer"
																		class="axia-pill-cta axia-pill-cta-primary"
																	>
																		<span>Tickets</span>
																		<span class="sr-only"> for {ev.title}</span>
																		<Icon icon="material-symbols:open-in-new-rounded" class="text-sm shrink-0" />
																	</a>
																{/if}
															</div>
														</div>
													</div>
												</article>
											</li>
										{/each}
									</ul>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				{#if pastGroups.length > 0}
					<section>
						<h3 class="text-lg md:text-xl font-extrabold uppercase tracking-wider text-[#2b314a] dark:text-slate-100 mb-4" style="font-family: var(--font-montserrat, sans-serif)">
							Past Events Archive
						</h3>
						<div class="flex flex-col gap-6">
							{#each pastGroups as group}
								<div>
									<h4 class="text-xs font-extrabold uppercase tracking-[0.12em] text-[#4b526e] dark:text-slate-300 mb-3" style="font-family: var(--font-montserrat, sans-serif)">
										{group.monthLabel}
									</h4>
									<ul role="list" class="grid gap-4 list-none p-0 m-0" style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));">
										{#each group.items as ev}
											<li class="flex">
												<article class="axia-sekai-card flex flex-col w-full min-w-0">
													<div class="axia-split-bar">
														<time datetime={ev.startYmd} class="axia-split-date">
															<span>{ev.startYmd.replaceAll("-", ".")}</span>
														</time>
														<div class="axia-split-type" data-cat-tone="past">
															<span class="truncate">
																{ev.eventType || "ACG Event"}{ev.region ? ` · ${ev.region}` : ""}
															</span>
															<span class="shrink-0 opacity-95">
																{ev.statusLabel}
															</span>
														</div>
													</div>

													<div class="p-5 flex-1 flex flex-col gap-3 min-w-0">
														<div class="flex flex-wrap items-center gap-2">
															<h5 class="text-lg font-bold text-[#2b314a] dark:text-slate-100 leading-snug">
																<a href={ev.href} class="hover:text-[#0c6fc4] dark:hover:text-[#7ee8ff] transition-colors">
																	{ev.title}
																</a>
															</h5>
															<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ev.admissionClass}`}>
																{ev.admissionLabel}
															</span>
														</div>

														<p class="text-sm text-[#4b526e] dark:text-slate-300">
															{ev.dateRange} · {ev.venue}, {ev.city}
														</p>

														{#if ev.description}
															<p class="text-sm text-[#4b526e] dark:text-slate-300 line-clamp-2">
																{ev.description}
															</p>
														{/if}

														{#if ev.lineup.length > 0}
															<ul
																role="list"
																aria-label={`Lineup for ${ev.title}`}
																class="flex flex-wrap items-center gap-2 list-none p-0 m-0"
															>
																{#each ev.lineup as performer}
																	<li>
																		<a
																			href={performer.href}
																			class="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-full text-xs font-medium bg-(--btn-regular-bg) text-(--btn-content) hover:bg-(--btn-regular-bg-hover) transition-colors"
																		>
																			<Icon icon="material-symbols:person-rounded" class="text-sm shrink-0" />
																			<span>{performer.name}</span>
																		</a>
																	</li>
																{/each}
															</ul>
														{/if}

														<div class="mt-auto pt-3 border-t border-black/8 dark:border-white/10 flex items-center justify-between gap-2">
															<a
																href={ev.href}
																class="inline-flex items-center gap-1 min-h-[44px] sm:min-h-[36px] text-xs font-bold uppercase tracking-wider text-[#0c6fc4] dark:text-[#7ee8ff] hover:underline"
																style="font-family: var(--font-montserrat, sans-serif)"
															>
																<span>Event Details</span>
																<Icon icon="material-symbols:chevron-right-rounded" class="text-base" />
															</a>
															<button
																type="button"
																on:click={() => toggleSavedEvent(ev.slug)}
																aria-pressed={savedSlugs.has(ev.slug)}
																aria-label={savedSlugs.has(ev.slug) ? `Remove ${ev.title} from My Schedule` : `Save ${ev.title} to My Schedule`}
																class="save-event-btn inline-flex items-center gap-1 min-h-[44px] sm:min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors"
																class:saved={savedSlugs.has(ev.slug)}
															>
																<Icon
																	icon={savedSlugs.has(ev.slug) ? "material-symbols:bookmark-rounded" : "material-symbols:bookmark-outline-rounded"}
																	class="text-sm shrink-0"
																/>
																<span>{savedSlugs.has(ev.slug) ? "Saved" : "Save"}</span>
															</button>
														</div>
													</div>
												</article>
											</li>
										{/each}
									</ul>
								</div>
							{/each}
						</div>
					</section>
				{/if}
			</div>
		</div>

		<!-- Panel 2: Interactive Monthly Calendar Grid -->
		<div
			role="tabpanel"
			aria-labelledby="events-tab-calendar"
			hidden={activeView !== "calendar"}
		>
			<div class="card-base p-4 sm:p-6 flex flex-col gap-4">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<h3 class="text-lg md:text-xl font-bold text-neutral-900 dark:text-neutral-100">
						{formatMonthTitle(calendarYear, calendarMonth)}
					</h3>

					<div class="flex items-center gap-2">
						<button
							type="button"
							on:click={() => shiftMonth(-1)}
							aria-label="Previous month"
							class="min-h-[44px] min-w-[44px] px-3 rounded-lg border border-(--line-divider) hover:border-(--primary) hover:text-(--primary) inline-flex items-center justify-center cursor-pointer transition-colors"
						>
							<Icon icon="material-symbols:chevron-left-rounded" class="text-xl" />
						</button>
						<button
							type="button"
							on:click={jumpToToday}
							class="min-h-[44px] px-3.5 rounded-lg bg-(--btn-regular-bg) text-(--btn-content) hover:bg-(--btn-regular-bg-hover) text-xs sm:text-sm font-medium cursor-pointer transition-colors"
						>
							Today
						</button>
						<button
							type="button"
							on:click={() => shiftMonth(1)}
							aria-label="Next month"
							class="min-h-[44px] min-w-[44px] px-3 rounded-lg border border-(--line-divider) hover:border-(--primary) hover:text-(--primary) inline-flex items-center justify-center cursor-pointer transition-colors"
						>
							<Icon icon="material-symbols:chevron-right-rounded" class="text-xl" />
						</button>
					</div>
				</div>

				{#if calendarMonthsWithEvents.length > 0}
					<div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Jump to month with events">
						<span class="text-xs font-medium text-neutral-600 dark:text-neutral-300 mr-1">
							Jump to:
						</span>
						{#each calendarMonthsWithEvents as m}
							<button
								type="button"
								on:click={() => jumpToMonth(m.key)}
								aria-pressed={activeCalendarMonthKey === m.key}
								class="filter-pill min-h-[36px] px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors"
								class:active={activeCalendarMonthKey === m.key}
							>
								{m.label}
							</button>
						{/each}
					</div>
				{/if}

				<!-- Mon-Sun Grid Header -->
				<div class="grid grid-cols-7 gap-1 sm:gap-2 text-center">
					{#each WEEKDAYS as dayName}
						<div class="py-2 rounded bg-[#2f3550] text-white text-xs font-bold uppercase tracking-wider" style="font-family: var(--font-montserrat, sans-serif)">
							{dayName}
						</div>
					{/each}
				</div>

				<!-- Calendar Cells -->
				<div class="grid grid-cols-7 gap-1 sm:gap-2">
					{#each calendarCells as cell}
						{@const isSelected = selectedDayYmd === cell.ymd}
						<button
							type="button"
							on:click={() => selectDayCell(cell)}
							aria-pressed={isSelected}
							aria-label={`${formatDayHeading(cell.ymd)}, ${cell.events.length} event${cell.events.length === 1 ? "" : "s"}`}
							class="calendar-cell min-h-[52px] sm:min-h-[82px] p-1.5 sm:p-2 rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer min-w-0"
							class:outside-month={!cell.inCurrentMonth}
							class:is-today={cell.isToday}
							class:is-selected={isSelected}
							class:has-events={cell.events.length > 0}
						>
							<div class="flex items-center justify-between gap-1 w-full">
								<span class="text-xs sm:text-sm font-bold leading-none">
									{cell.day}
								</span>
								{#if cell.events.length > 0}
									<span class="text-[0.65rem] font-bold px-1.5 py-0.5 rounded bg-(--primary) text-white dark:text-neutral-950 leading-none">
										{cell.events.length}
									</span>
								{/if}
							</div>

							{#if cell.events.length > 0}
								<div class="hidden sm:flex flex-col gap-1 mt-1 w-full">
									{#each cell.events.slice(0, 2) as ev}
										<span class="block w-full truncate text-[0.6875rem] font-medium px-1.5 py-0.5 rounded bg-(--btn-regular-bg) text-(--btn-content)">
											{ev.title}
										</span>
									{/each}
									{#if cell.events.length > 2}
										<span class="text-[0.65rem] font-medium text-neutral-600 dark:text-neutral-300">
											+{cell.events.length - 2} more
										</span>
									{/if}
								</div>
							{/if}
						</button>
					{/each}
				</div>

				<!-- Selected Day Details -->
				<div class="pt-4 border-t border-(--line-divider)">
					{#if selectedDayYmd}
						<h4 class="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-3">
							Events on {formatDayHeading(selectedDayYmd)} ({selectedDayEvents.length})
						</h4>
						{#if selectedDayEvents.length > 0}
							<ul role="list" class="flex flex-col gap-3 list-none p-0 m-0">
								{#each selectedDayEvents as ev}
									<li>
										<article class="rounded-xl border border-(--line-divider) bg-(--page-bg)/60 dark:bg-white/[0.03] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
											<div class="min-w-0">
												<div class="flex flex-wrap items-center gap-2">
													<h5 class="text-base font-bold text-neutral-900 dark:text-neutral-100">
														<a href={ev.href} class="hover:text-(--primary) transition-colors">
															{ev.title}
														</a>
													</h5>
													{#if ev.eventType}
														<span class="px-2 py-0.5 rounded-md text-xs font-medium bg-neutral-200/75 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
															{ev.eventType}
														</span>
													{/if}
													<span class={`px-2 py-0.5 rounded-md text-xs font-semibold ${ev.admissionClass}`}>
														{ev.admissionLabel}
													</span>
												</div>
												<p class="text-sm text-neutral-700 dark:text-neutral-300 mt-1">
													{ev.dateRange}{ev.time ? ` (${ev.time} ${ev.timezone})` : ""} · {ev.venue}, {ev.city}
												</p>
												{#if ev.lineup.length > 0}
													<div class="flex flex-wrap items-center gap-1.5 mt-2">
														{#each ev.lineup as performer}
															<a
																href={performer.href}
																class="px-2.5 py-1 rounded-md text-xs font-medium bg-(--btn-regular-bg) text-(--btn-content) hover:bg-(--btn-regular-bg-hover)"
															>
																{performer.name}
															</a>
														{/each}
													</div>
												{/if}
											</div>
											<div class="flex flex-wrap items-center gap-2 shrink-0">
												<button
													type="button"
													on:click={() => toggleSavedEvent(ev.slug)}
													aria-pressed={savedSlugs.has(ev.slug)}
													aria-label={savedSlugs.has(ev.slug) ? `Remove ${ev.title} from My Schedule` : `Save ${ev.title} to My Schedule`}
													class="save-event-btn inline-flex items-center gap-1 min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-colors"
													class:saved={savedSlugs.has(ev.slug)}
												>
													<Icon
														icon={savedSlugs.has(ev.slug) ? "material-symbols:bookmark-rounded" : "material-symbols:bookmark-outline-rounded"}
														class="text-base shrink-0"
													/>
													<span>{savedSlugs.has(ev.slug) ? "Saved" : "Save"}</span>
												</button>
												<a
													href={ev.href}
													class="min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium border border-(--line-divider) hover:border-(--primary) hover:text-(--primary) inline-flex items-center"
												>
													Details
												</a>
												{#if ev.ticketUrl}
													<a
														href={ev.ticketUrl}
														target="_blank"
														rel="noopener noreferrer"
														class="min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-(--primary) dark:text-neutral-950 inline-flex items-center gap-1"
													>
														<span>Tickets</span>
														<span class="sr-only"> for {ev.title}</span>
														<Icon icon="material-symbols:open-in-new-rounded" class="text-sm" />
													</a>
												{/if}
											</div>
										</article>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="text-sm text-neutral-600 dark:text-neutral-300">
								No matching events scheduled on this date. Select a highlighted date above or switch to another month ({monthEvents.length} event{monthEvents.length === 1 ? "" : "s"} in {formatMonthTitle(calendarYear, calendarMonth)}).
							</p>
						{/if}
					{:else}
						<p class="text-sm text-neutral-600 dark:text-neutral-300">
							Select any highlighted day in the calendar above to inspect event details ({monthEvents.length} event{monthEvents.length === 1 ? "" : "s"} in {formatMonthTitle(calendarYear, calendarMonth)}).
						</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.filter-pill {
		background: var(--btn-regular-bg);
		color: var(--btn-content);
	}
	.filter-pill:hover {
		background: var(--btn-regular-bg-hover);
	}
	.filter-pill.active {
		background: #2f3550;
		color: #fff;
	}
	:global(:root.dark) .filter-pill.active {
		background: #0c6fc4;
		color: #fff;
	}

	.save-event-btn {
		border: 1px solid var(--line-divider);
		background: transparent;
		color: var(--btn-content);
	}
	.save-event-btn:hover {
		border-color: #0c6fc4;
		color: #0c6fc4;
	}
	.save-event-btn.saved {
		background: #0c6fc4;
		border-color: #0c6fc4;
		color: #ffffff;
	}
	:global(:root.dark) .save-event-btn.saved {
		background: #0c6fc4;
		border-color: #38bdf8;
		color: #ffffff;
	}

	.view-tab {
		position: relative;
		color: var(--content-meta);
	}
	.view-tab:hover {
		color: #0c6fc4;
	}
	.view-tab[aria-selected="true"] {
		color: #0c6fc4;
	}
	:global(:root.dark) .view-tab:hover,
	:global(:root.dark) .view-tab[aria-selected="true"] {
		color: #7ee8ff;
	}
	.view-tab[aria-selected="true"]::after {
		content: "";
		position: absolute;
		inset: auto 0 0;
		border-block-end: 3px solid #0c6fc4;
	}
	:global(:root.dark) .view-tab[aria-selected="true"]::after {
		border-block-end-color: #5ce1ff;
	}

	.calendar-cell {
		border-color: var(--line-divider);
		background: transparent;
		color: inherit;
	}
	.calendar-cell:hover {
		border-color: #0c6fc4;
	}
	.calendar-cell.outside-month {
		opacity: 0.42;
	}
	.calendar-cell.has-events {
		background: color-mix(in oklab, var(--btn-regular-bg) 55%, transparent);
	}
	.calendar-cell.is-today {
		border-color: #0c6fc4;
	}
	.calendar-cell.is-selected {
		border-color: #0c6fc4;
		outline: 2px solid #0c6fc4;
		outline-offset: -2px;
	}
	:global(:root.dark) .calendar-cell.is-selected {
		border-color: #5ce1ff;
		outline-color: #5ce1ff;
	}
</style>
