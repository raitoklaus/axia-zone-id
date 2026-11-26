(() => {
	const cms = window.CMS;
	if (!cms) {
		return;
	}

	const escapeHtml = (value) =>
		String(value ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");

	cms.registerPreviewStyle("./wp-preview.css");

	cms.registerEditorComponent({
		id: "wiki-link-card",
		label: "Wiki Link Card",
		fields: [
			{
				name: "collection",
				label: "Collection",
				widget: "select",
				options: ["performers", "events", "posts"],
				default: "performers",
			},
			{
				name: "slug",
				label: "Entry Slug",
				widget: "string",
				required: true,
			},
			{
				name: "label",
				label: "Custom Label (optional)",
				widget: "string",
				required: false,
			},
		],
		pattern:
			/^\[\[(performers|events|posts)\/([^\]|]+?)(?:\|([^\]]+))?\]\]$/,
		fromBlock: (match) => ({
			collection: match[1] || "performers",
			slug: (match[2] || "").trim(),
			label: (match[3] || "").trim(),
		}),
		toBlock: (data) => {
			const collection = data.collection || "performers";
			const slug = (data.slug || "").trim();
			const label = (data.label || "").trim();
			if (!slug) return "";
			return label
				? `[[${collection}/${slug}|${label}]]`
				: `[[${collection}/${slug}]]`;
		},
		toPreview: (data) => {
			const collection = escapeHtml(data.collection || "performers");
			const slug = escapeHtml(data.slug || "entry-slug");
			const label = data.label ? ` (${escapeHtml(data.label)})` : "";
			return `<div class="wp-preview-block"><div class="wp-preview-badge">Wiki Link</div><div><strong>[[${collection}/${slug}]]</strong>${label}</div></div>`;
		},
	});

	cms.registerEditorComponent({
		id: "callout",
		label: "Callout Box",
		fields: [
			{
				name: "type",
				label: "Callout Type",
				widget: "select",
				options: ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"],
				default: "NOTE",
			},
			{
				name: "body",
				label: "Message",
				widget: "text",
				required: true,
			},
		],
		pattern: /^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\r?\n((?:>.*(?:\r?\n|$))+)/,
		fromBlock: (match) => {
			const lines = (match[2] || "")
				.split(/\r?\n/)
				.filter((line) => line.startsWith(">"))
				.map((line) => line.replace(/^>\s?/, ""));
			return {
				type: match[1] || "NOTE",
				body: lines.join("\n").trim(),
			};
		},
		toBlock: (data) => {
			const type = data.type || "NOTE";
			const lines = String(data.body || "")
				.split(/\r?\n/)
				.map((line) => `> ${line}`);
			return `> [!${type}]\n${lines.join("\n")}`;
		},
		toPreview: (data) => {
			const type = String(data.type || "NOTE");
			const cls =
				type === "WARNING"
					? " wp-preview-callout-warning"
					: type === "CAUTION"
						? " wp-preview-callout-caution"
						: type === "TIP"
							? " wp-preview-callout-tip"
							: "";
			return `<div class="wp-preview-block${cls}"><div class="wp-preview-badge">${escapeHtml(type)}</div><div>${escapeHtml(data.body || "")}</div></div>`;
		},
	});

	cms.registerEditorComponent({
		id: "spoiler",
		label: "Spoiler Text",
		fields: [
			{
				name: "text",
				label: "Hidden Text",
				widget: "string",
				required: true,
			},
		],
		pattern: /^:spoiler\[([^\]]+)\]$/,
		fromBlock: (match) => ({
			text: match[1] || "",
		}),
		toBlock: (data) => `:spoiler[${data.text || ""}]`,
		toPreview: (data) =>
			`<span class="wp-preview-spoiler">Spoiler: ${escapeHtml(data.text || "")}</span>`,
	});

	cms.registerEditorComponent({
		id: "image-grid",
		label: "Image Gallery Grid",
		fields: [
			{
				name: "columns",
				label: "Columns (Preview)",
				widget: "select",
				options: ["2", "3"],
				default: "2",
			},
			{
				name: "images",
				label: "Images",
				widget: "list",
				fields: [
					{ name: "src", label: "Image", widget: "image", required: true },
					{ name: "alt", label: "Alt Text", widget: "string", required: false },
				],
			},
		],
		pattern: /^\[grid\]\r?\n([\s\S]*?)\r?\n\[\/grid\]$/,
		fromBlock: (match) => {
			const raw = match[1] || "";
			const images = [];
			const itemRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
			let m = itemRegex.exec(raw);
			while (m) {
				images.push({ alt: m[1] || "", src: m[2] || "" });
				m = itemRegex.exec(raw);
			}
			return { columns: images.length >= 3 ? "3" : "2", images };
		},
		toBlock: (data) => {
			const items = Array.isArray(data.images) ? data.images : [];
			const lines = items
				.filter((item) => item && item.src)
				.map((item) => `![${item.alt || ""}](${item.src})`);
			return `[grid]\n${lines.join("\n")}\n[/grid]`;
		},
		toPreview: (data) => {
			const cols = data.columns === "3" ? 3 : 2;
			const items = Array.isArray(data.images) ? data.images : [];
			const imgs = items
				.filter((item) => item && item.src)
				.map(
					(item) =>
						`<img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt || "")}" />`,
				)
				.join("");
			return `<div class="wp-preview-block"><div class="wp-preview-badge">Image Grid (${cols} cols)</div><div class="wp-preview-grid" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr));">${imgs || "No images added yet"}</div></div>`;
		},
	});

	cms.registerEditorComponent({
		id: "github-card",
		label: "GitHub Repository Card",
		fields: [
			{
				name: "repo",
				label: "Repository (owner/repo)",
				widget: "string",
				required: true,
			},
		],
		pattern: /^::github\{repo="([^"]+)"\}$/,
		fromBlock: (match) => ({
			repo: match[1] || "",
		}),
		toBlock: (data) => `::github{repo="${(data.repo || "").trim()}"}`,
		toPreview: (data) =>
			`<div class="wp-preview-block"><div class="wp-preview-badge">GitHub Card</div><div><strong>${escapeHtml(data.repo || "owner/repo")}</strong></div></div>`,
	});

	const extractYoutubeId = (input) => {
		const raw = String(input || "").trim();
		if (!raw) return "";
		const shortMatch = raw.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
		if (shortMatch) return shortMatch[1];
		const watchMatch = raw.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
		if (watchMatch) return watchMatch[1];
		const embedMatch = raw.match(/\/embed\/([a-zA-Z0-9_-]{6,})/);
		if (embedMatch) return embedMatch[1];
		return raw.replace(/[^a-zA-Z0-9_-]/g, "");
	};

	cms.registerEditorComponent({
		id: "youtube-embed",
		label: "YouTube Embed",
		fields: [
			{
				name: "id",
				label: "YouTube URL or Video ID",
				widget: "string",
				required: true,
			},
			{
				name: "title",
				label: "Video Title (Accessibility)",
				widget: "string",
				default: "YouTube video player",
				required: false,
			},
		],
		pattern:
			/^<iframe[^>]*src="https:\/\/www\.youtube\.com\/embed\/([a-zA-Z0-9_-]+)"[^>]*title="([^"]*)"[^>]*><\/iframe>$/,
		fromBlock: (match) => ({
			id: match[1] || "",
			title: match[2] || "YouTube video player",
		}),
		toBlock: (data) => {
			const videoId = extractYoutubeId(data.id);
			const title = (data.title || "YouTube video player").replace(/"/g, "'");
			if (!videoId) return "";
			return `<iframe width="100%" height="420" src="https://www.youtube.com/embed/${videoId}" title="${title}" frameborder="0" allowfullscreen></iframe>`;
		},
		toPreview: (data) => {
			const videoId = escapeHtml(extractYoutubeId(data.id));
			const title = escapeHtml(data.title || "YouTube video player");
			return `<div class="wp-preview-block"><div class="wp-preview-badge">YouTube Embed</div><div>${title} (<code>${videoId || "missing-id"}</code>)</div></div>`;
		},
	});

	cms.registerEditorComponent({
		id: "mermaid-diagram",
		label: "Mermaid Diagram",
		fields: [
			{
				name: "code",
				label: "Mermaid Definition",
				widget: "text",
				required: true,
			},
		],
		pattern: /^```mermaid\r?\n([\s\S]*?)\r?\n```$/,
		fromBlock: (match) => ({
			code: match[1] || "",
		}),
		toBlock: (data) =>
			`\`\`\`mermaid\n${data.code || "flowchart LR\n  A --> B"}\n\`\`\``,
		toPreview: (data) =>
			`<div class="wp-preview-block"><div class="wp-preview-badge">Mermaid Diagram</div><pre>${escapeHtml(data.code || "")}</pre></div>`,
	});

	/* ================= Firefly Live Preview Templates ================= */
	const React = cms.React;
	if (React && typeof cms.registerPreviewTemplate === "function") {
		const h = React.createElement;

		const toPlain = (val) => {
			if (val && typeof val.toJS === "function") {
				return val.toJS();
			}
			return val;
		};

		const getEntryData = (entry) => {
			if (!entry) return {};
			const raw =
				typeof entry.get === "function" ? entry.get("data") : entry.data;
			return toPlain(raw) || {};
		};

		const asArray = (val) => {
			const plain = toPlain(val);
			return Array.isArray(plain) ? plain : [];
		};

		const resolveAsset = (getAsset, path) => {
			if (!path) return "";
			try {
				const resolved = getAsset ? getAsset(path) : null;
				if (resolved && typeof resolved.toString === "function") {
					return resolved.toString();
				}
			} catch {
				// Fallback below
			}
			if (String(path).startsWith("/uploads/")) {
				return `/axia-zone-id${path}`;
			}
			return String(path);
		};

		const parseDate = (val) => {
			if (!val) return null;
			const d = val instanceof Date ? val : new Date(val);
			return Number.isNaN(d.getTime()) ? null : d;
		};

		const formatSingleDate = (val) => {
			const d = parseDate(val);
			if (!d) return val ? String(val) : "";
			return new Intl.DateTimeFormat("en-GB", {
				day: "numeric",
				month: "short",
				year: "numeric",
				timeZone: "UTC",
			}).format(d);
		};

		const formatDateRange = (start, end) => {
			const s = parseDate(start);
			if (!s) return start ? String(start) : "TBA";
			const e = parseDate(end);
			if (!e || s.toISOString().slice(0, 10) === e.toISOString().slice(0, 10)) {
				return formatSingleDate(s);
			}
			return `${formatSingleDate(s)} - ${formatSingleDate(e)}`;
		};

		const computeCountdown = (start, end) => {
			const s = parseDate(start);
			if (!s) return "";
			const e = parseDate(end) || s;
			let todayYmd;
			try {
				todayYmd = new Intl.DateTimeFormat("en-CA", {
					timeZone: "Asia/Jakarta",
				}).format(new Date());
			} catch {
				todayYmd = new Date().toISOString().slice(0, 10);
			}
			const todayMs = Date.parse(`${todayYmd}T00:00:00Z`);
			const startMs = Date.parse(`${s.toISOString().slice(0, 10)}T00:00:00Z`);
			const endMs = Date.parse(`${e.toISOString().slice(0, 10)}T00:00:00Z`);
			const diffStart = Math.round((startMs - todayMs) / 86400000);
			const diffEnd = Math.round((endMs - todayMs) / 86400000);
			if (diffEnd < 0) return "Ended";
			if (diffStart <= 0 && diffEnd >= 0) {
				return diffStart === diffEnd ? "Today" : "Ongoing";
			}
			if (diffStart === 1) return "Tomorrow";
			if (diffStart <= 30) return `In ${diffStart} days`;
			return "";
		};

		const getInitials = (name) => {
			const parts = String(name || "?")
				.trim()
				.split(/\s+/)
				.filter(Boolean);
			if (parts.length === 0) return "?";
			if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
			return (parts[0][0] + parts[1][0]).toUpperCase();
		};

		const normalizeInstagram = (ig) => {
			const raw = String(ig || "").trim();
			if (!raw) return null;
			if (raw.startsWith("http://") || raw.startsWith("https://")) {
				return { handle: raw.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, ""), url: raw };
			}
			const handle = raw.startsWith("@") ? raw : `@${raw}`;
			return {
				handle,
				url: `https://instagram.com/${handle.slice(1)}`,
			};
		};

		const PreviewLayout = ({ routeLabel, iframeDoc, hue, children }) => {
			const getInitialTheme = () => {
				try {
					const parentTheme =
						window.parent?.document?.documentElement?.dataset?.theme;
					if (parentTheme === "dark" || parentTheme === "light") {
						return parentTheme;
					}
				} catch {
					// Ignore cross-origin checks
				}
				return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
					? "dark"
					: "light";
			};

			const [theme, setTheme] = React.useState(getInitialTheme);
			const activeHue = Number.isFinite(Number(hue)) ? Number(hue) : 165;

			React.useEffect(() => {
				if (iframeDoc?.documentElement) {
					iframeDoc.documentElement.dataset.previewTheme = theme;
					iframeDoc.documentElement.style.setProperty("--hue", String(activeHue));
				}
			}, [theme, iframeDoc, activeHue]);

			return h(
				"div",
				{
					className: "axia-preview-shell",
					"data-preview-theme": theme,
					style: { "--hue": String(activeHue) },
				},
				h(
					"div",
					{ className: "axia-preview-inner" },
					h(
						"div",
						{ className: "axia-preview-topbar" },
						h(
							"div",
							{ className: "axia-topbar-brand" },
							h("span", { className: "axia-brand-dot", "aria-hidden": "true" }),
							h("span", { className: "axia-brand-name" }, "Axia Zone ID"),
							routeLabel
								? h("span", { className: "axia-route-pill" }, routeLabel)
								: null,
						),
						h(
							"button",
							{
								type: "button",
								className: "axia-theme-toggle",
								onClick: () =>
									setTheme((prev) => (prev === "dark" ? "light" : "dark")),
							},
							theme === "dark" ? "Preview: Dark" : "Preview: Light",
						),
					),
					children,
				),
			);
		};

		const EventsPreview = ({ entry, widgetFor, getAsset, document: iframeDoc }) => {
			const d = getEntryData(entry);
			const status = String(d.status || "upcoming").toLowerCase();
			const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
			const countdown = computeCountdown(d.startDate, d.endDate);
			const dateRange = formatDateRange(d.startDate, d.endDate);
			const entryType = d.entryType || "tba";
			const admissionLabel =
				d.htm ||
				(entryType === "free"
					? "Free Entry"
					: entryType === "paid"
						? "Paid HTM"
						: "HTM TBA");
			const ig = normalizeInstagram(d.instagram);
			const highlights = asArray(d.highlights);
			const tags = asArray(d.tags);
			const lineup = asArray(d.lineup);
			const coverUrl = resolveAsset(getAsset, d.image);

			return h(
				PreviewLayout,
				{ routeLabel: "/wiki/events/preview/", iframeDoc },
				h(
					"article",
					{ className: "axia-card" },
					h(
						"div",
						{ className: "axia-breadcrumb" },
						h("span", { className: "axia-breadcrumb-link" }, "All Events & Calendar"),
						h("span", { "aria-hidden": "true" }, "/"),
						h("span", null, "Performer Wiki"),
					),
					h(
						"header",
						{ className: "axia-header" },
						h(
							"div",
							{ className: "axia-title-row" },
							h("h1", { className: "axia-title" }, d.title || "Untitled Event"),
							d.draft
								? h("span", { className: "axia-badge axia-badge-draft" }, "Draft")
								: null,
							h(
								"span",
								{ className: `axia-badge axia-badge-status-${status}` },
								statusLabel,
							),
							countdown
								? h(
										"span",
										{ className: "axia-badge axia-badge-countdown" },
										countdown,
									)
								: null,
						),
						h(
							"div",
							{ className: "axia-badges" },
							d.eventType
								? h("span", { className: "axia-badge axia-badge-type" }, d.eventType)
								: null,
							h(
								"span",
								{ className: `axia-badge axia-badge-admission-${entryType}` },
								admissionLabel,
							),
						),
						d.description
							? h("p", { className: "axia-lead" }, d.description)
							: null,
						h(
							"dl",
							{ className: "axia-info-grid" },
							h(
								"div",
								{ className: "axia-info-item" },
								h("dt", null, "Date & Hours"),
								h(
									"dd",
									null,
									dateRange,
									d.time
										? h(
												"span",
												{ className: "axia-info-sub" },
												`${d.time} ${d.timezone || "WIB"}`,
											)
										: null,
								),
							),
							h(
								"div",
								{ className: "axia-info-item" },
								h("dt", null, "Venue & Region"),
								h(
									"dd",
									null,
									`${d.venue || "Venue TBA"}${d.city ? `, ${d.city}` : ""}${d.region ? ` (${d.region})` : ""}`,
									d.mapsUrl
										? h(
												"div",
												null,
												h(
													"span",
													{ className: "axia-inline-link" },
													"Google Maps Link Set",
												),
											)
										: null,
								),
							),
							h(
								"div",
								{ className: "axia-info-item" },
								h("dt", null, "Admission (HTM)"),
								h("dd", null, admissionLabel),
							),
							d.organizer || ig || d.officialUrl
								? h(
										"div",
										{ className: "axia-info-item" },
										h("dt", null, "Organizer & Links"),
										h(
											"dd",
											null,
											d.organizer ? h("div", null, d.organizer) : null,
											ig
												? h(
														"span",
														{ className: "axia-inline-link" },
														`IG: ${ig.handle} `,
													)
												: null,
											d.officialUrl
												? h(
														"span",
														{ className: "axia-inline-link" },
														"Official Link",
													)
												: null,
										),
									)
								: null,
						),
						highlights.length > 0
							? h(
									"div",
									null,
									h("div", { className: "axia-section-title" }, "Event Highlights"),
									h(
										"div",
										{ className: "axia-badges" },
										highlights.map((item, idx) =>
											h(
												"span",
												{ key: idx, className: "axia-badge axia-badge-highlight" },
												item,
											),
										),
									),
								)
							: null,
						tags.length > 0
							? h(
									"div",
									{ className: "axia-badges" },
									tags.map((tag, idx) =>
										h(
											"span",
											{ key: idx, className: "axia-badge axia-badge-tag" },
											`#${tag}`,
										),
									),
								)
							: null,
						h(
							"div",
							{ className: "axia-actions" },
							d.ticketUrl
								? h("span", { className: "axia-btn axia-btn-primary" }, "Get Tickets")
								: null,
							h(
								"span",
								{ className: "axia-btn axia-btn-regular" },
								"Add to Google Calendar",
							),
							h(
								"span",
								{ className: "axia-btn axia-btn-outline" },
								"Download .ics",
							),
						),
						coverUrl
							? h(
									"div",
									{ className: "axia-cover-wrap" },
									h("img", {
										src: coverUrl,
										alt: d.title || "Event cover",
										className: "axia-cover-img",
									}),
								)
							: null,
					),
					h(
						"section",
						{ className: "axia-section" },
						h(
							"h2",
							{ className: "axia-section-heading" },
							`Lineup (${lineup.length})`,
						),
						lineup.length > 0
							? h(
									"ul",
									{ className: "axia-lineup-grid" },
									lineup.map((slug, idx) =>
										h(
											"li",
											{ key: idx, className: "axia-lineup-card" },
											h(
												"div",
												{ className: "axia-lineup-avatar" },
												getInitials(String(slug).replace(/-/g, " ")),
											),
											h(
												"div",
												null,
												h("div", { className: "axia-lineup-slug" }, String(slug)),
												h("div", { className: "axia-lineup-sub" }, "Performer Wiki link"),
											),
										),
									),
								)
							: h("p", { className: "axia-lead" }, "Lineup to be announced."),
					),
					h("div", { className: "axia-prose" }, widgetFor("body")),
				),
			);
		};

		const PerformersPreview = ({
			entry,
			widgetFor,
			getAsset,
			document: iframeDoc,
		}) => {
			const d = getEntryData(entry);
			const avatarUrl = resolveAsset(getAsset, d.avatar);
			const tags = asArray(d.tags);
			const socials = asArray(d.socials);

			return h(
				PreviewLayout,
				{ routeLabel: "/wiki/performers/preview/", iframeDoc },
				h(
					"article",
					{ className: "axia-card" },
					h(
						"div",
						{ className: "axia-breadcrumb" },
						h("span", { className: "axia-breadcrumb-link" }, "Performer Wiki"),
						h("span", { "aria-hidden": "true" }, "/"),
						h("span", null, "Events & Schedule"),
					),
					h(
						"header",
						{ className: "axia-performer-header" },
						avatarUrl
							? h("img", {
									src: avatarUrl,
									alt: d.name || "Performer avatar",
									className: "axia-avatar",
								})
							: h("div", { className: "axia-avatar" }, getInitials(d.name)),
						h(
							"div",
							{ className: "axia-performer-meta" },
							h(
								"div",
								{ className: "axia-title-row" },
								h("h1", { className: "axia-title" }, d.name || "Performer Name"),
								d.category
									? h(
											"span",
											{ className: "axia-badge axia-badge-tag" },
											d.category,
										)
									: null,
								d.draft
									? h(
											"span",
											{ className: "axia-badge axia-badge-draft" },
											"Draft",
										)
									: null,
							),
							h(
								"p",
								{ className: "axia-subtitle-role" },
								d.role || "Primary Role",
							),
							d.bio ? h("p", { className: "axia-lead" }, d.bio) : null,
							tags.length > 0
								? h(
										"div",
										{ className: "axia-badges" },
										tags.map((tag, idx) =>
											h(
												"span",
												{ key: idx, className: "axia-badge axia-badge-tag" },
												`#${tag}`,
											),
										),
									)
								: null,
							socials.length > 0
								? h(
										"div",
										{ className: "axia-actions" },
										socials.map((s, idx) =>
											h(
												"span",
												{ key: idx, className: "axia-btn axia-btn-outline" },
												s.label || s.url || "Link",
											),
										),
									)
								: null,
						),
					),
					h("div", { className: "axia-prose" }, widgetFor("body")),
					h(
						"div",
						{ className: "axia-cover-note" },
						"Event Appearances (Upcoming & Past) are automatically linked on build from Events that list this performer in their lineup.",
					),
				),
			);
		};

		const PostsPreview = ({ entry, widgetFor, getAsset, document: iframeDoc }) => {
			const d = getEntryData(entry);
			const coverUrl = resolveAsset(getAsset, d.image);
			const tags = asArray(d.tags);

			return h(
				PreviewLayout,
				{ routeLabel: "/posts/preview/", iframeDoc },
				h(
					"article",
					{ className: "axia-card" },
					coverUrl
						? h(
								"div",
								{ className: "axia-cover-wrap" },
								h("img", {
									src: coverUrl,
									alt: d.title || "Post cover",
									className: "axia-cover-img",
								}),
							)
						: d.useRandomCover
							? h(
									"div",
									{ className: "axia-cover-note" },
									"Random Cover Enabled: Firefly will assign a random cover image from the cover API at build time.",
								)
							: null,
					h(
						"header",
						{ className: "axia-header" },
						h(
							"div",
							{ className: "axia-badges" },
							d.pinned
								? h("span", { className: "axia-badge axia-badge-tag" }, "Pinned")
								: null,
							d.draft
								? h("span", { className: "axia-badge axia-badge-draft" }, "Draft")
								: null,
							d.series
								? h(
										"span",
										{ className: "axia-badge axia-badge-type" },
										`Series: ${d.series}${d.seriesOrder ? ` #${d.seriesOrder}` : ""}`,
									)
								: null,
							d.password
								? h(
										"span",
										{ className: "axia-badge axia-badge-admission-paid" },
										"Password Protected",
									)
								: null,
						),
						h("h1", { className: "axia-title" }, d.title || "Untitled Post"),
						h(
							"div",
							{ className: "axia-meta-row" },
							d.published
								? h("span", null, `Published: ${formatSingleDate(d.published)}`)
								: null,
							d.updated
								? h("span", null, `Updated: ${formatSingleDate(d.updated)}`)
								: null,
							d.category ? h("span", null, `Category: ${d.category}`) : null,
							d.author ? h("span", null, `Author: ${d.author}`) : null,
						),
						d.description
							? h("p", { className: "axia-lead" }, d.description)
							: null,
					),
					h("div", { className: "axia-prose" }, widgetFor("body")),
					tags.length > 0
						? h(
								"div",
								{ className: "axia-badges" },
								tags.map((tag, idx) =>
									h(
										"span",
										{ key: idx, className: "axia-badge axia-badge-tag" },
										`#${tag}`,
									),
								),
							)
						: null,
					d.licenseName || d.sourceLink
						? h(
								"div",
								{ className: "axia-license-box" },
								d.licenseName
									? h("div", null, `License: ${d.licenseName}`)
									: null,
								d.sourceLink
									? h("div", null, `Source: ${d.sourceLink}`)
									: null,
							)
						: null,
				),
			);
		};

		const PagePreview = (routeLabel, defaultTitle) => ({
			entry,
			widgetFor,
			document: iframeDoc,
		}) => {
			const d = getEntryData(entry);
			return h(
				PreviewLayout,
				{ routeLabel, iframeDoc },
				h(
					"article",
					{ className: "axia-card" },
					h(
						"header",
						{ className: "axia-header" },
						h("h1", { className: "axia-title" }, d.title || defaultTitle),
						d.description
							? h("p", { className: "axia-lead" }, d.description)
							: null,
					),
					h("div", { className: "axia-prose" }, widgetFor("body")),
				),
			);
		};

		const MomentsPreview = ({ entry, widgetFor, document: iframeDoc }) => {
			const d = getEntryData(entry);
			return h(
				PreviewLayout,
				{ routeLabel: "/dynamic/", iframeDoc },
				h(
					"article",
					{ className: "axia-card" },
					h(
						"div",
						{ className: "axia-meta-row" },
						h("strong", null, "Axia Zone ID"),
						d.published
							? h("span", null, formatSingleDate(d.published))
							: null,
						d.location
							? h(
									"span",
									{ className: "axia-badge axia-badge-type" },
									d.location,
								)
							: null,
						d.pinned
							? h(
									"span",
									{ className: "axia-badge axia-badge-tag" },
									"Pinned",
								)
							: null,
					),
					h("div", { className: "axia-prose" }, widgetFor("body")),
				),
			);
		};

		const ProjectsPreview = ({
			entry,
			widgetFor,
			getAsset,
			document: iframeDoc,
		}) => {
			const d = getEntryData(entry);
			const coverUrl = resolveAsset(getAsset, d.image);
			const tags = asArray(d.tags);
			const links = asArray(d.link);

			return h(
				PreviewLayout,
				{ routeLabel: "/projects/", iframeDoc },
				h(
					"article",
					{ className: "axia-card" },
					coverUrl
						? h(
								"div",
								{ className: "axia-cover-wrap" },
								h("img", {
									src: coverUrl,
									alt: d.title || "Project cover",
									className: "axia-cover-img",
								}),
							)
						: null,
					h(
						"header",
						{ className: "axia-header" },
						h(
							"div",
							{ className: "axia-title-row" },
							h("h1", { className: "axia-title" }, d.title || "Untitled Project"),
							d.status
								? h(
										"span",
										{ className: "axia-badge axia-badge-tag" },
										d.status,
									)
								: null,
							d.draft
								? h(
										"span",
										{ className: "axia-badge axia-badge-draft" },
										"Draft",
									)
								: null,
						),
						d.description
							? h("p", { className: "axia-lead" }, d.description)
							: null,
						tags.length > 0
							? h(
									"div",
									{ className: "axia-badges" },
									tags.map((tag, idx) =>
										h(
											"span",
											{ key: idx, className: "axia-badge axia-badge-type" },
											`#${tag}`,
										),
									),
								)
							: null,
						links.length > 0
							? h(
									"div",
									{ className: "axia-actions" },
									links.map((item, idx) =>
										h(
											"span",
											{ key: idx, className: "axia-btn axia-btn-regular" },
											item.label || item.value || "Project Link",
										),
									),
								)
							: null,
					),
					h("div", { className: "axia-prose" }, widgetFor("body")),
				),
			);
		};

		const SiteSettingsPreview = ({ entry, document: iframeDoc }) => {
			const d = getEntryData(entry);
			const site = d.site || {};
			const banner = d.banner || {};
			const announcement = d.announcement || {};
			const profile = d.profile || {};
			const pages = d.pages || {};
			const hue = site.themeHue ?? 165;
			const subtitles = asArray(banner.subtitles);

			return h(
				PreviewLayout,
				{ routeLabel: "/ (Site Settings)", iframeDoc, hue },
				h(
					"div",
					{ className: "axia-card" },
					h(
						"div",
						{ className: "axia-settings-hero" },
						h("h2", null, banner.title || site.title || "Axia Zone ID"),
						h(
							"p",
							{ style: { margin: 0, opacity: 0.9 } },
							subtitles[0] || site.subtitle || "",
						),
						h(
							"div",
							{ className: "axia-badges" },
							h(
								"span",
								{ className: "axia-badge axia-badge-tag" },
								`Hue: ${hue}`,
							),
							h(
								"span",
								{ className: "axia-badge axia-badge-tag" },
								`Mode: ${site.defaultMode || "system"}`,
							),
							h(
								"span",
								{ className: "axia-badge axia-badge-tag" },
								`Layout: ${site.defaultPostLayout || "list"}`,
							),
						),
					),
					announcement.content
						? h(
								"div",
								{ className: "wp-preview-block" },
								h("div", { className: "wp-preview-badge" }, "Announcement Bar"),
								h("div", null, announcement.content),
							)
						: null,
					h(
						"div",
						{ className: "axia-info-grid" },
						h(
							"div",
							{ className: "axia-info-item" },
							h("dt", null, "Profile Card"),
							h("dd", null, profile.name || "Axia Zone ID"),
							profile.bio
								? h("span", { className: "axia-info-sub" }, profile.bio)
								: null,
						),
						h(
							"div",
							{ className: "axia-info-item" },
							h("dt", null, "Pagination & Timezone"),
							h(
								"dd",
								null,
								`${site.postsPerPage || 10} posts / page (${site.timezone || "Asia/Jakarta"})`,
							),
						),
					),
					h(
						"div",
						null,
						h("div", { className: "axia-section-title" }, "Enabled Pages"),
						h(
							"div",
							{ className: "axia-settings-grid" },
							Object.entries(pages).map(([key, enabled]) =>
								h(
									"div",
									{ key, className: "axia-toggle-chip" },
									h("span", null, key),
									h(
										"span",
										{
											className: `axia-badge ${enabled ? "axia-badge-admission-free" : "axia-badge-status-completed"}`,
										},
										enabled ? "On" : "Off",
									),
								),
							),
						),
					),
				),
			);
		};

		cms.registerPreviewTemplate("events", EventsPreview);
		cms.registerPreviewTemplate("performers", PerformersPreview);
		cms.registerPreviewTemplate("posts", PostsPreview);
		cms.registerPreviewTemplate("about", PagePreview("/about/", "About Axia Zone ID"));
		cms.registerPreviewTemplate(
			"guestbook",
			PagePreview("/guestbook/", "Guestbook"),
		);
		cms.registerPreviewTemplate("dynamic", MomentsPreview);
		cms.registerPreviewTemplate("projects", ProjectsPreview);
		cms.registerPreviewTemplate("site_settings", SiteSettingsPreview);
	}

	cms.init();
})();
