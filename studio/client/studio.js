const API = "/__studio/api";

const COLLECTION_LABELS = {
	posts: "Posts",
	events: "Events",
	wiki: "Wiki",
	performers: "Performers",
	dynamic: "Moments",
	projects: "Projects",
	spec: "Pages",
};

const WIDGET_LABELS = {
	profile: "Profile Card",
	announcement: "Announcement",
	music: "Music Player",
	categories: "Categories",
	tags: "Tags",
	dynamic: "Latest Moments",
	stats: "Site Statistics",
	siteInfo: "Build Info",
	calendar: "Site Calendar",
	sidebarToc: "Table of Contents",
	advertisement: "Advertisement",
};

const EVENT_REGIONS = [
	"",
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
];

const EVENT_TYPES = [
	"",
	"Convention / Expo",
	"Matsuri / Bunkasai",
	"Idol / Anisong Live",
	"Anikura / DJ Night",
	"Cosplay Event",
	"Doujin / Creator Market",
	"Community Gathering",
];

const PERFORMER_CATEGORIES = [
	"",
	"Anisong Vocalist",
	"Band",
	"Chika Idol",
	"Fandom Idol",
	"Anikura DJ",
	"Collective Group",
	"Cosplayer",
	"Creator / Other",
];

const WIKI_CATEGORIES = [
	"Event Series & Organizers",
	"Axia Lore & Community",
	"ACG & Jejepangan Scene",
	"Communities & Circles",
];

const state = {
	activeTab: "design",
	viewport: "desktop",
	inspect: false,
	inlineEdit: false,
	autoSave: false,
	previewRoute: "/",
	settings: null,
	savedSettingsStr: "",
	collections: {},
	activeCollection: "posts",
	contentQuery: "",
	activeEntry: null,
	savedEntryStr: "",
	rawContentMode: false,
	frontmatterOpen: true,
	mediaItems: [],
	mediaFilter: "all",
	gitStatus: { available: true, branch: "main", files: [] },
	verifyResult: null,
	verifying: false,
	publishing: false,
	collapsedSections: {},
	lineupSearch: "",
};

const els = {
	workbench: document.getElementById("workbench"),
	frame: document.getElementById("preview-frame"),
	previewWrapper: document.getElementById("preview-wrapper"),
	routeInput: document.getElementById("route-url-input"),
	quickRoute: document.getElementById("quick-route-select"),
	editCurrentBtn: document.getElementById("edit-current-btn"),
	inspectBtn: document.getElementById("inspect-toggle-btn"),
	inlineEditBtn: document.getElementById("inline-edit-btn"),
	autosaveCheckbox: document.getElementById("autosave-checkbox"),
	saveBtn: document.getElementById("save-btn"),
	discardBtn: document.getElementById("discard-btn"),
	reloadBtn: document.getElementById("reload-frame-btn"),
	resizer: document.getElementById("resizer"),
	toast: document.getElementById("toast"),
	modalBackdrop: document.getElementById("modal-backdrop"),
	modalPanel: document.getElementById("modal-panel"),
};

let autoSaveTimer = null;
let toastTimer = null;

function esc(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function showToast(text) {
	els.toast.textContent = text;
	els.toast.classList.add("is-visible");
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		els.toast.classList.remove("is-visible");
	}, 2600);
}

async function apiFetch(path, options = {}) {
	const res = await fetch(`${API}${path}`, {
		headers: {
			"Content-Type": "application/json",
			...(options.headers || {}),
		},
		...options,
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(data.error || `Request failed (${res.status})`);
	}
	return data;
}

function isSettingsDirty() {
	if (!state.settings) return false;
	return JSON.stringify(state.settings) !== state.savedSettingsStr;
}

function isEntryDirty() {
	if (!state.activeEntry) return false;
	const current = JSON.stringify({
		data: state.activeEntry.data,
		body: state.activeEntry.body,
		raw: state.rawContentMode ? state.activeEntry.raw : null,
	});
	return current !== state.savedEntryStr;
}

function isDirty() {
	return isSettingsDirty() || isEntryDirty();
}

function updateDirtyButtons() {
	const dirty = isDirty();
	els.saveBtn.disabled = !dirty;
	els.discardBtn.disabled = !dirty;
	els.saveBtn.classList.toggle("is-dirty", dirty);
}

function postToFrame(payload) {
	try {
		els.frame.contentWindow?.postMessage(payload, window.location.origin);
	} catch {
		// Ignore frame messaging errors
	}
}

function sendPreviewPatch(partial = null) {
	if (!state.settings) return;
	const s = state.settings;
	const payload = partial || {
		themeHue: Number(s.site?.themeHue ?? 244),
		defaultMode: s.site?.defaultMode,
		pageWidth: Number(s.site?.pageWidth ?? 100),
		navbarTitle: s.site?.navbarTitle,
		banner: {
			title: s.banner?.title,
			subtitles: s.banner?.subtitles,
			dimOpacity: Number(s.banner?.dimOpacity ?? 0.24),
			position: s.banner?.position,
		},
		announcement: {
			content: s.announcement?.content,
			linkText: s.announcement?.linkText,
		},
		profile: {
			name: s.profile?.name,
			bio: s.profile?.bio,
		},
	};
	postToFrame({ type: "axia-studio:preview", payload });
}

function resolveMediaPreviewUrl(valuePath) {
	const raw = String(valuePath || "").trim();
	if (!raw) return "";
	if (
		raw.startsWith("http://") ||
		raw.startsWith("https://") ||
		raw.startsWith("/")
	) {
		return raw;
	}
	if (raw.startsWith("assets/")) {
		return `/__studio/api/media/file?p=${encodeURIComponent(`src/${raw}`)}`;
	}
	return raw;
}

function findEntryByRoute(pathname) {
	const clean = pathname.endsWith("/") ? pathname : `${pathname}/`;
	for (const col of Object.keys(state.collections)) {
		for (const item of state.collections[col] || []) {
			if (item.route === clean) {
				return { collection: col, slug: item.slug };
			}
		}
	}
	return null;
}

function updateEditCurrentButton() {
	const match = findEntryByRoute(state.previewRoute);
	if (match) {
		els.editCurrentBtn.classList.remove("is-hidden");
		els.editCurrentBtn.dataset.collection = match.collection;
		els.editCurrentBtn.dataset.slug = match.slug;
	} else {
		els.editCurrentBtn.classList.add("is-hidden");
	}
}

function navigatePreview(routePath) {
	const clean = routePath.startsWith("/") ? routePath : `/${routePath}`;
	state.previewRoute = clean;
	els.routeInput.value = clean;
	els.frame.src = clean;
	updateEditCurrentButton();
}

function scheduleAutoSave() {
	updateDirtyButtons();
	if (!state.autoSave) return;
	clearTimeout(autoSaveTimer);
	autoSaveTimer = setTimeout(() => {
		saveAll(true);
	}, 600);
}

async function saveAll(silent = false) {
	try {
		if (isSettingsDirty()) {
			await apiFetch("/settings", {
				method: "PUT",
				body: JSON.stringify(state.settings),
			});
			state.savedSettingsStr = JSON.stringify(state.settings);
		}
		if (isEntryDirty() && state.activeEntry) {
			const bodyPayload = state.rawContentMode
				? {
						collection: state.activeEntry.collection,
						slug: state.activeEntry.slug,
						raw: state.activeEntry.raw,
					}
				: {
						collection: state.activeEntry.collection,
						slug: state.activeEntry.slug,
						data: state.activeEntry.data,
						body: state.activeEntry.body,
					};
			await apiFetch("/content/entry", {
				method: "PUT",
				body: JSON.stringify(bodyPayload),
			});
			if (state.rawContentMode) {
				await openContentEntry(
					state.activeEntry.collection,
					state.activeEntry.slug,
					false,
				);
			} else {
				state.savedEntryStr = JSON.stringify({
					data: state.activeEntry.data,
					body: state.activeEntry.body,
					raw: null,
				});
			}
			await refreshCollections();
		}
		updateDirtyButtons();
		await refreshGitStatus();
		if (!silent) showToast("Saved to disk");
	} catch (err) {
		showToast(`Save error: ${err.message}`);
	}
}

function discardAll() {
	const hadInlineOrEntryEdit = state.inlineEdit || isEntryDirty();
	if (isSettingsDirty()) {
		state.settings = JSON.parse(state.savedSettingsStr);
		sendPreviewPatch();
	}
	if (isEntryDirty() && state.savedEntryStr) {
		const snap = JSON.parse(state.savedEntryStr);
		state.activeEntry.data = snap.data;
		state.activeEntry.body = snap.body;
		if (snap.raw !== null) {
			state.activeEntry.raw = snap.raw;
		}
	}
	updateDirtyButtons();
	renderWorkbench();
	if (hadInlineOrEntryEdit) {
		els.frame.contentWindow?.location.reload();
	}
	showToast("Reverted unsaved changes");
}

async function refreshCollections() {
	const data = await apiFetch("/content");
	state.collections = data.collections || {};
	updateEditCurrentButton();
}

async function refreshMedia() {
	const data = await apiFetch("/media");
	state.mediaItems = data.items || [];
}

async function refreshGitStatus() {
	try {
		state.gitStatus = await apiFetch("/git/status");
		if (state.activeTab === "publish") renderWorkbench();
	} catch {
		// Ignore git status error
	}
}

async function openContentEntry(collection, slug, navigateFrame = true) {
	if (
		state.activeEntry &&
		state.activeEntry.collection === collection &&
		state.activeEntry.slug === slug &&
		isEntryDirty()
	) {
		state.activeTab = "content";
		setActiveTabButton("content");
		renderWorkbench();
		if (navigateFrame && state.activeEntry.route) {
			navigatePreview(state.activeEntry.route);
		}
		return;
	}
	const entry = await apiFetch(
		`/content/entry?collection=${encodeURIComponent(collection)}&slug=${encodeURIComponent(slug)}`,
	);
	state.activeCollection = collection;
	state.activeEntry = entry;
	state.rawContentMode = false;
	state.savedEntryStr = JSON.stringify({
		data: entry.data,
		body: entry.body,
		raw: null,
	});
	state.activeTab = "content";
	setActiveTabButton("content");
	updateDirtyButtons();
	renderWorkbench();
	if (navigateFrame && entry.route) {
		navigatePreview(entry.route);
	}
}

function setActiveTabButton(tabName) {
	for (const btn of document.querySelectorAll(".mode-tab")) {
		btn.classList.toggle("is-active", btn.dataset.tab === tabName);
	}
}

function closeModal() {
	els.modalBackdrop.classList.add("is-hidden");
	els.modalPanel.innerHTML = "";
}

function openModal(title, bodyHtml, footerHtml = "", bindFn = null) {
	els.modalPanel.innerHTML = `
		<div class="modal-header">
			<span>${esc(title)}</span>
			<button type="button" class="mini-btn" data-close-modal>Close</button>
		</div>
		<div class="modal-body">${bodyHtml}</div>
		${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ""}
	`;
	els.modalBackdrop.classList.remove("is-hidden");
	for (const btn of els.modalPanel.querySelectorAll("[data-close-modal]")) {
		btn.addEventListener("click", closeModal);
	}
	if (bindFn) bindFn(els.modalPanel);
}

function renderAccordion(id, title, bodyHtml) {
	const collapsed = Boolean(state.collapsedSections[id]);
	return `
		<section class="section-card ${collapsed ? "is-collapsed" : ""}" data-section-id="${esc(id)}">
			<div class="section-header" data-toggle-section="${esc(id)}">
				<span>${esc(title)}</span>
				<span>${collapsed ? "+" : "-"}</span>
			</div>
			<div class="section-body">${bodyHtml}</div>
		</section>
	`;
}

function renderDesignTab() {
	const s = state.settings;
	if (!s) return "<p>Loading settings...</p>";

	const desktopWps = Array.isArray(s.banner?.desktopImages)
		? s.banner.desktopImages
		: [];
	const mobileWps = Array.isArray(s.banner?.mobileImages)
		? s.banner.mobileImages
		: [];

	const identityBody = `
		<div class="field">
			<label>Theme Hue <span>${esc(s.site.themeHue)}</span></label>
			<input type="range" min="0" max="360" data-setting="site.themeHue" data-type="number" value="${esc(s.site.themeHue)}" />
			<div class="hue-presets">
				${[
					{ hue: 244, color: "oklch(0.65 0.2 244)", title: "Axia Azure (244)" },
					{ hue: 205, color: "oklch(0.65 0.18 205)", title: "Sky Cyan (205)" },
					{ hue: 170, color: "oklch(0.68 0.16 170)", title: "Mint (170)" },
					{ hue: 330, color: "oklch(0.66 0.18 330)", title: "Sakura (330)" },
				]
					.map(
						(p) =>
							`<button type="button" class="hue-swatch" title="${esc(p.title)}" style="background:${p.color}" data-hue-preset="${p.hue}"></button>`,
					)
					.join("")}
			</div>
		</div>
		<div class="field-row">
			<div class="field">
				<label>Color Mode</label>
				<select data-setting="site.defaultMode">
					<option value="light" ${s.site.defaultMode === "light" ? "selected" : ""}>Light</option>
					<option value="dark" ${s.site.defaultMode === "dark" ? "selected" : ""}>Dark</option>
					<option value="system" ${s.site.defaultMode === "system" ? "selected" : ""}>System</option>
				</select>
			</div>
			<div class="field">
				<label>UI Language</label>
				<select data-setting="site.uiLang">
					<option value="en" ${s.site.uiLang !== "id" ? "selected" : ""}>English (en)</option>
					<option value="id" ${s.site.uiLang === "id" ? "selected" : ""}>Bahasa Indonesia (id)</option>
				</select>
			</div>
		</div>
		<div class="field">
			<label>Page Width (rem) <span>${esc(s.site.pageWidth)}rem</span></label>
			<input type="range" min="70" max="120" data-setting="site.pageWidth" data-type="number" value="${esc(s.site.pageWidth)}" />
		</div>
		<div class="field-row">
			<div class="field">
				<label>Site Title</label>
				<input type="text" data-setting="site.title" value="${esc(s.site.title)}" />
			</div>
			<div class="field">
				<label>Navbar Title</label>
				<input type="text" data-setting="site.navbarTitle" value="${esc(s.site.navbarTitle)}" />
			</div>
		</div>
		<div class="field">
			<label>Site Subtitle</label>
			<input type="text" data-setting="site.subtitle" value="${esc(s.site.subtitle)}" />
		</div>
		<div class="field">
			<label>Meta Description</label>
			<textarea data-setting="site.description">${esc(s.site.description)}</textarea>
		</div>
	`;

	const bannerBody = `
		<div class="field-row">
			<div class="field">
				<label>Banner Mode</label>
				<select data-setting="banner.mode">
					<option value="banner" ${s.banner.mode === "banner" ? "selected" : ""}>Banner</option>
					<option value="fullscreen" ${s.banner.mode === "fullscreen" ? "selected" : ""}>Fullscreen</option>
					<option value="overlay" ${s.banner.mode === "overlay" ? "selected" : ""}>Overlay</option>
					<option value="none" ${s.banner.mode === "none" ? "selected" : ""}>None</option>
				</select>
			</div>
			<div class="field">
				<label>Focal Position</label>
				<select data-setting="banner.position">
					${["50% 20%", "center", "top", "bottom", "50% 35%"]
						.map(
							(pos) =>
								`<option value="${pos}" ${s.banner.position === pos ? "selected" : ""}>${pos}</option>`,
						)
						.join("")}
				</select>
			</div>
		</div>
		<div class="field">
			<label>Banner Dim Opacity <span>${esc(s.banner.dimOpacity)}</span></label>
			<input type="range" min="0" max="0.8" step="0.02" data-setting="banner.dimOpacity" data-type="number" value="${esc(s.banner.dimOpacity)}" />
		</div>
		<div class="field">
			<label>Hero Title</label>
			<input type="text" data-setting="banner.title" value="${esc(s.banner.title)}" />
		</div>
		<div class="field">
			<label>Hero Subtitles (one per line)</label>
			<textarea data-banner-subtitles>${esc((s.banner.subtitles || []).join("\n"))}</textarea>
		</div>
		<div class="field-row">
			<label class="toggle-row">
				<span>Show Hero Text</span>
				<input type="checkbox" data-setting="banner.homeTextEnable" ${s.banner.homeTextEnable ? "checked" : ""} />
			</label>
			<label class="toggle-row">
				<span>Typewriter</span>
				<input type="checkbox" data-setting="banner.typewriterEnable" ${s.banner.typewriterEnable ? "checked" : ""} />
			</label>
		</div>
		<div class="field-row">
			<label class="toggle-row">
				<span>Waves Animation</span>
				<input type="checkbox" data-setting="banner.wavesEnable" ${s.banner.wavesEnable ? "checked" : ""} />
			</label>
			<label class="toggle-row">
				<span>Carousel</span>
				<input type="checkbox" data-setting="banner.carouselEnable" ${s.banner.carouselEnable ? "checked" : ""} />
			</label>
		</div>
		<div class="field">
			<label>
				Desktop Wallpapers (${desktopWps.length})
				<button type="button" class="mini-btn" data-add-wp="desktopImages">+ Add</button>
			</label>
			<div class="wallpaper-strip">
				${desktopWps
					.map(
						(wp, idx) => `
						<div class="wallpaper-tile" title="Click to preview on Hero: ${esc(wp)}" data-preview-wp="${esc(resolveMediaPreviewUrl(wp))}">
							<img src="${esc(resolveMediaPreviewUrl(wp))}" alt="Desktop wallpaper ${idx + 1}" loading="lazy" />
							<button type="button" class="remove-wp" data-remove-wp="desktopImages:${idx}" aria-label="Remove wallpaper">&times;</button>
						</div>
					`,
					)
					.join("")}
			</div>
		</div>
		<div class="field">
			<label>
				Mobile Wallpapers (${mobileWps.length})
				<button type="button" class="mini-btn" data-add-wp="mobileImages">+ Add</button>
			</label>
			<div class="wallpaper-strip">
				${mobileWps
					.map(
						(wp, idx) => `
						<div class="wallpaper-tile" title="Click to preview: ${esc(wp)}" data-preview-wp="${esc(resolveMediaPreviewUrl(wp))}">
							<img src="${esc(resolveMediaPreviewUrl(wp))}" alt="Mobile wallpaper ${idx + 1}" loading="lazy" />
							<button type="button" class="remove-wp" data-remove-wp="mobileImages:${idx}" aria-label="Remove wallpaper">&times;</button>
						</div>
					`,
					)
					.join("")}
			</div>
		</div>
	`;

	const announcementBody = `
		<div class="field">
			<label>Announcement Content</label>
			<textarea data-setting="announcement.content">${esc(s.announcement.content)}</textarea>
		</div>
		<div class="field-row">
			<div class="field">
				<label>Button Text</label>
				<input type="text" data-setting="announcement.linkText" value="${esc(s.announcement.linkText)}" />
			</div>
			<div class="field">
				<label>Button URL</label>
				<input type="text" data-setting="announcement.linkUrl" value="${esc(s.announcement.linkUrl)}" />
			</div>
		</div>
		<div class="field-row">
			<label class="toggle-row">
				<span>Show Action Link</span>
				<input type="checkbox" data-setting="announcement.linkEnable" ${s.announcement.linkEnable ? "checked" : ""} />
			</label>
			<label class="toggle-row">
				<span>Closable</span>
				<input type="checkbox" data-setting="announcement.closable" ${s.announcement.closable ? "checked" : ""} />
			</label>
		</div>
	`;

	const profileBody = `
		<div class="field">
			<label>Display Name</label>
			<input type="text" data-setting="profile.name" value="${esc(s.profile.name)}" />
		</div>
		<div class="field">
			<label>Bio</label>
			<textarea data-setting="profile.bio">${esc(s.profile.bio)}</textarea>
		</div>
		<div class="field">
			<label>Avatar Image</label>
			<div class="inline-input-group">
				<input type="text" data-setting="profile.avatar" value="${esc(s.profile.avatar)}" />
				<button type="button" class="btn-secondary" data-pick-media-for="setting:profile.avatar">Pick</button>
			</div>
		</div>
	`;

	const analyticsObj = s.analytics || {
		umamiWebsiteId: "",
		umamiScriptUrl: "https://cloud.umami.is/script.js",
		trackOutboundLinks: true,
		collectWebVitals: true,
	};
	const analyticsBody = `
		<div class="field">
			<label>Umami Website ID (blank disables tracking)</label>
			<input type="text" data-setting="analytics.umamiWebsiteId" value="${esc(analyticsObj.umamiWebsiteId || "")}" placeholder="e.g. a1b2c3d4-..." />
		</div>
		<div class="field">
			<label>Umami Script URL</label>
			<input type="text" data-setting="analytics.umamiScriptUrl" value="${esc(analyticsObj.umamiScriptUrl || "https://cloud.umami.is/script.js")}" />
		</div>
		<div class="field-row">
			<label class="toggle-row">
				<span>Outbound Links</span>
				<input type="checkbox" data-setting="analytics.trackOutboundLinks" ${analyticsObj.trackOutboundLinks !== false ? "checked" : ""} />
			</label>
			<label class="toggle-row">
				<span>Web Vitals</span>
				<input type="checkbox" data-setting="analytics.collectWebVitals" ${analyticsObj.collectWebVitals !== false ? "checked" : ""} />
			</label>
		</div>
	`;

	return (
		renderAccordion("identity", "Theme & Site Identity", identityBody) +
		renderAccordion("banner", "Hero Banner & Wallpapers", bannerBody) +
		renderAccordion("announcement", "Announcement Widget", announcementBody) +
		renderAccordion("profile", "Profile Card", profileBody) +
		renderAccordion("analytics", "Privacy Analytics (Umami)", analyticsBody)
	);
}

function renderWidgetListHtml(sideKey, list) {
	const opposite = sideKey === "left" ? "Right" : "Left";
	return `
		<div class="widget-list" data-widget-list="${sideKey}">
			${list
				.map(
					(item, idx) => `
					<div class="widget-item ${item.enable ? "" : "is-disabled"}" draggable="true" data-widget-side="${sideKey}" data-widget-idx="${idx}">
						<div class="widget-top">
							<label style="display:flex;align-items:center;gap:6px;font-weight:700;cursor:pointer;">
								<input type="checkbox" data-widget-toggle="${sideKey}:${idx}:enable" ${item.enable ? "checked" : ""} />
								<span>${esc(WIDGET_LABELS[item.type] || item.type)}</span>
							</label>
							<div class="widget-controls">
								<button type="button" class="mini-btn ${item.position === "top" ? "is-on" : ""}" data-widget-pos="${sideKey}:${idx}">
									${esc(item.position === "top" ? "Top" : "Sticky")}
								</button>
								<button type="button" class="mini-btn ${item.showOnPostPage ? "is-on" : ""}" data-widget-toggle="${sideKey}:${idx}:showOnPostPage">
									Posts
								</button>
								<button type="button" class="mini-btn" data-widget-move="${sideKey}:${idx}:up" ${idx === 0 ? "disabled" : ""} title="Move up">Up</button>
								<button type="button" class="mini-btn" data-widget-move="${sideKey}:${idx}:down" ${idx === list.length - 1 ? "disabled" : ""} title="Move down">Dn</button>
								<button type="button" class="mini-btn" data-widget-swap="${sideKey}:${idx}" title="Move to ${opposite} sidebar">-&gt; ${opposite}</button>
							</div>
						</div>
					</div>
				`,
				)
				.join("")}
		</div>
	`;
}

function renderLayoutTab() {
	const s = state.settings;
	if (!s) return "<p>Loading layout settings...</p>";

	const sidebar = s.sidebar || {
		enable: true,
		position: "both",
		tabletSidebar: "left",
		hideSidebarOnPostPage: false,
		left: [],
		right: [],
	};

	const homepageBody = `
		<div class="field-row">
			<label class="toggle-row">
				<span>Upcoming Schedule</span>
				<input type="checkbox" data-setting="site.showHomeSchedule" ${s.site.showHomeSchedule !== false ? "checked" : ""} />
			</label>
			<label class="toggle-row">
				<span>Wiki Spotlight</span>
				<input type="checkbox" data-setting="site.showHomeWikiSpotlight" ${s.site.showHomeWikiSpotlight === true ? "checked" : ""} />
			</label>
		</div>
		<div class="field-row">
			<label class="toggle-row">
				<span>Category Bar</span>
				<input type="checkbox" data-setting="site.categoryBar" ${s.site.categoryBar !== false ? "checked" : ""} />
			</label>
			<label class="toggle-row">
				<span>Loading Screen</span>
				<input type="checkbox" data-setting="site.showLoadingScreen" ${s.site.showLoadingScreen !== false ? "checked" : ""} />
			</label>
		</div>
		<div class="field-row">
			<label class="toggle-row">
				<span>Last Modified Card</span>
				<input type="checkbox" data-setting="site.showLastModified" ${s.site.showLastModified !== false ? "checked" : ""} />
			</label>
			<label class="toggle-row">
				<span>Related Posts</span>
				<input type="checkbox" data-setting="site.relatedPosts" ${s.site.relatedPosts !== false ? "checked" : ""} />
			</label>
		</div>
		<div class="field-row">
			<div class="field">
				<label>Post List Layout</label>
				<select data-setting="site.defaultPostLayout">
					<option value="list" ${s.site.defaultPostLayout !== "grid" ? "selected" : ""}>List</option>
					<option value="grid" ${s.site.defaultPostLayout === "grid" ? "selected" : ""}>Grid</option>
				</select>
			</div>
			<div class="field">
				<label>Posts Per Page</label>
				<input type="number" min="1" max="50" data-setting="site.postsPerPage" data-type="number" value="${esc(s.site.postsPerPage)}" />
			</div>
		</div>
		<p class="entry-meta">Layout &amp; widget structure updates in the live site on Save (or Auto-Save) via Astro HMR.</p>
	`;

	const pageEntries = [
		["friends", "Friends"],
		["guestbook", "Guestbook"],
		["dynamic", "Moments"],
		["projects", "Projects"],
		["gallery", "Gallery"],
		["booknav", "Bookmark Nav"],
		["sponsor", "Sponsor"],
		["bilibili", "Bilibili"],
		["bangumi", "Bangumi"],
		["vndb", "VNDB"],
		["mal", "MyAnimeList"],
	];
	const pagesBody = `
		<div class="field-row">
			${pageEntries
				.map(
					([k, label]) => `
					<label class="toggle-row">
						<span>${esc(label)}</span>
						<input type="checkbox" data-setting="pages.${esc(k)}" ${s.pages?.[k] ? "checked" : ""} />
					</label>
				`,
				)
				.join("")}
		</div>
	`;

	const sidebarLeftBody = `
		<div class="field-row">
			<label class="toggle-row">
				<span>Enable Sidebars</span>
				<input type="checkbox" data-setting="sidebar.enable" ${sidebar.enable !== false ? "checked" : ""} />
			</label>
			<label class="toggle-row">
				<span>Hide On Posts</span>
				<input type="checkbox" data-setting="sidebar.hideSidebarOnPostPage" ${sidebar.hideSidebarOnPostPage === true ? "checked" : ""} />
			</label>
		</div>
		<div class="field-row">
			<div class="field">
				<label>Sidebar Mode</label>
				<select data-setting="sidebar.position">
					<option value="both" ${sidebar.position === "both" ? "selected" : ""}>Both Sides</option>
					<option value="left" ${sidebar.position === "left" ? "selected" : ""}>Left Only</option>
					<option value="right" ${sidebar.position === "right" ? "selected" : ""}>Right Only</option>
				</select>
			</div>
			<div class="field">
				<label>Tablet Sidebar</label>
				<select data-setting="sidebar.tabletSidebar">
					<option value="left" ${sidebar.tabletSidebar !== "right" ? "selected" : ""}>Left</option>
					<option value="right" ${sidebar.tabletSidebar === "right" ? "selected" : ""}>Right</option>
				</select>
			</div>
		</div>
		${renderWidgetListHtml("left", sidebar.left || [])}
	`;

	const sidebarRightBody = renderWidgetListHtml("right", sidebar.right || []);

	return (
		renderAccordion("homepage", "Homepage & Feed Sections", homepageBody) +
		renderAccordion(
			"sidebar-left",
			"Left Sidebar & Global Layout",
			sidebarLeftBody,
		) +
		renderAccordion(
			"sidebar-right",
			"Right Sidebar Widgets",
			sidebarRightBody,
		) +
		renderAccordion("pages", "Enabled Site Pages", pagesBody)
	);
}

function renderFrontmatterFields(col, data) {
	const arrVal = (key) =>
		Array.isArray(data[key]) ? data[key].join(", ") : String(data[key] || "");

	const imageField = (key, label) => `
		<div class="field">
			<label>${esc(label)}</label>
			<div class="inline-input-group">
				<input type="text" data-fm="${esc(key)}" value="${esc(data[key] || "")}" placeholder="/uploads/... or /gallery/..." />
				<button type="button" class="btn-secondary" data-pick-media-for="fm:${esc(key)}">Pick</button>
			</div>
		</div>
	`;

	if (col === "posts") {
		return `
			<div class="field">
				<label>Title</label>
				<input type="text" data-fm="title" value="${esc(data.title || "")}" />
			</div>
			<div class="field-row">
				<div class="field">
					<label>Published</label>
					<input type="date" data-fm="published" value="${esc(data.published || "")}" />
				</div>
				<div class="field">
					<label>Updated</label>
					<input type="date" data-fm="updated" value="${esc(data.updated || "")}" />
				</div>
			</div>
			<div class="field">
				<label>Description</label>
				<textarea data-fm="description">${esc(data.description || "")}</textarea>
			</div>
			${imageField("image", "Cover Image")}
			<div class="field-row">
				<div class="field">
					<label>Category</label>
					<input type="text" data-fm="category" value="${esc(data.category || "")}" />
				</div>
				<div class="field">
					<label>Tags (comma separated)</label>
					<input type="text" data-fm-list="tags" value="${esc(arrVal("tags"))}" />
				</div>
			</div>
			<div class="field-row">
				<div class="field">
					<label>Series</label>
					<input type="text" data-fm="series" value="${esc(data.series || "")}" />
				</div>
				<div class="field">
					<label>Series Order</label>
					<input type="number" data-fm="seriesOrder" data-fm-type="number" value="${esc(data.seriesOrder ?? "")}" />
				</div>
			</div>
			<div class="field-row">
				<label class="toggle-row">
					<span>Pinned</span>
					<input type="checkbox" data-fm="pinned" ${data.pinned ? "checked" : ""} />
				</label>
				<label class="toggle-row">
					<span>Draft</span>
					<input type="checkbox" data-fm="draft" ${data.draft ? "checked" : ""} />
				</label>
			</div>
		`;
	}

	if (col === "events") {
		const performers = state.collections.performers || [];
		const selectedLineup = new Set(
			Array.isArray(data.lineup) ? data.lineup : [],
		);
		const q = state.lineupSearch.toLowerCase().trim();
		const filteredPerf = performers.filter(
			(p) =>
				!q ||
				p.title.toLowerCase().includes(q) ||
				p.slug.toLowerCase().includes(q),
		);
		return `
			<div class="field">
				<label>Event Title</label>
				<input type="text" data-fm="title" value="${esc(data.title || "")}" />
			</div>
			<div class="field-row">
				<div class="field">
					<label>Start Date</label>
					<input type="date" data-fm="startDate" value="${esc(data.startDate || "")}" />
				</div>
				<div class="field">
					<label>End Date</label>
					<input type="date" data-fm="endDate" value="${esc(data.endDate || "")}" />
				</div>
			</div>
			<div class="field-row">
				<div class="field">
					<label>Venue</label>
					<input type="text" data-fm="venue" value="${esc(data.venue || "")}" />
				</div>
				<div class="field">
					<label>City</label>
					<input type="text" data-fm="city" value="${esc(data.city || "")}" />
				</div>
			</div>
			<div class="field-row">
				<div class="field">
					<label>Region</label>
					<select data-fm="region">
						${EVENT_REGIONS.map((r) => `<option value="${esc(r)}" ${data.region === r ? "selected" : ""}>${esc(r || "(None)")}</option>`).join("")}
					</select>
				</div>
				<div class="field">
					<label>Event Type</label>
					<select data-fm="eventType">
						${EVENT_TYPES.map((t) => `<option value="${esc(t)}" ${data.eventType === t ? "selected" : ""}>${esc(t || "(None)")}</option>`).join("")}
					</select>
				</div>
			</div>
			<div class="field-row">
				<div class="field">
					<label>Entry Type</label>
					<select data-fm="entryType">
						${["free", "paid", "tba"].map((e) => `<option value="${e}" ${data.entryType === e ? "selected" : ""}>${e}</option>`).join("")}
					</select>
				</div>
				<div class="field">
					<label>HTM / Price Label</label>
					<input type="text" data-fm="htm" value="${esc(data.htm || "")}" />
				</div>
			</div>
			<div class="field-row">
				<div class="field">
					<label>Hours</label>
					<input type="text" data-fm="time" value="${esc(data.time || "")}" />
				</div>
				<div class="field">
					<label>Status</label>
					<select data-fm="status">
						${["upcoming", "ongoing", "completed", "postponed", "cancelled"]
							.map(
								(st) =>
									`<option value="${st}" ${data.status === st ? "selected" : ""}>${st}</option>`,
							)
							.join("")}
					</select>
				</div>
			</div>
			<div class="field-row">
				<div class="field">
					<label>Organizer</label>
					<input type="text" data-fm="organizer" value="${esc(data.organizer || "")}" />
				</div>
				<div class="field">
					<label>Highlights (comma separated)</label>
					<input type="text" data-fm-list="highlights" value="${esc(arrVal("highlights"))}" />
				</div>
			</div>
			<div class="field">
				<label>Performer Lineup (${selectedLineup.size} selected)</label>
				<input type="text" data-lineup-search placeholder="Filter performers..." value="${esc(state.lineupSearch)}" />
				<div class="relation-box">
					${filteredPerf
						.map(
							(p) => `
							<label class="relation-item">
								<input type="checkbox" data-lineup-slug="${esc(p.slug)}" ${selectedLineup.has(p.slug) ? "checked" : ""} />
								<span>${esc(p.title)} <small style="color:#64748b">(${esc(p.slug)})</small></span>
							</label>
						`,
						)
						.join("")}
				</div>
			</div>
			<div class="field">
				<label>Description</label>
				<textarea data-fm="description">${esc(data.description || "")}</textarea>
			</div>
			${imageField("image", "Banner Image")}
			<div class="field-row">
				<label class="toggle-row">
					<span>Major Event (Home)</span>
					<input type="checkbox" data-fm="majorEvent" ${data.majorEvent ? "checked" : ""} />
				</label>
				<label class="toggle-row">
					<span>Draft</span>
					<input type="checkbox" data-fm="draft" ${data.draft ? "checked" : ""} />
				</label>
			</div>
		`;
	}

	if (col === "wiki") {
		return `
			<div class="field">
				<label>Title</label>
				<input type="text" data-fm="title" value="${esc(data.title || "")}" />
			</div>
			<div class="field-row">
				<div class="field">
					<label>Category</label>
					<select data-fm="category">
						${WIKI_CATEGORIES.map((c) => `<option value="${esc(c)}" ${data.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
					</select>
				</div>
				<div class="field">
					<label>Updated</label>
					<input type="date" data-fm="updated" value="${esc(data.updated || "")}" />
				</div>
			</div>
			<div class="field">
				<label>Summary</label>
				<textarea data-fm="summary">${esc(data.summary || "")}</textarea>
			</div>
			<div class="field-row">
				<div class="field">
					<label>City</label>
					<input type="text" data-fm="city" value="${esc(data.city || "")}" />
				</div>
				<div class="field">
					<label>Status</label>
					<input type="text" data-fm="status" value="${esc(data.status || "")}" />
				</div>
			</div>
			${imageField("image", "Wiki Image")}
			<div class="field">
				<label>Tags (comma separated)</label>
				<input type="text" data-fm-list="tags" value="${esc(arrVal("tags"))}" />
			</div>
			<div class="field-row">
				<label class="toggle-row">
					<span>Featured</span>
					<input type="checkbox" data-fm="featured" ${data.featured ? "checked" : ""} />
				</label>
				<label class="toggle-row">
					<span>Draft</span>
					<input type="checkbox" data-fm="draft" ${data.draft ? "checked" : ""} />
				</label>
			</div>
		`;
	}

	if (col === "performers") {
		return `
			<div class="field-row">
				<div class="field">
					<label>Name</label>
					<input type="text" data-fm="name" value="${esc(data.name || "")}" />
				</div>
				<div class="field">
					<label>Primary Role</label>
					<input type="text" data-fm="role" value="${esc(data.role || "")}" />
				</div>
			</div>
			<div class="field-row">
				<div class="field">
					<label>Category</label>
					<select data-fm="category">
						${PERFORMER_CATEGORIES.map((c) => `<option value="${esc(c)}" ${data.category === c ? "selected" : ""}>${esc(c || "(None)")}</option>`).join("")}
					</select>
				</div>
				<div class="field">
					<label>City</label>
					<input type="text" data-fm="city" value="${esc(data.city || "")}" />
				</div>
			</div>
			<div class="field-row">
				<div class="field">
					<label>Affiliation</label>
					<input type="text" data-fm="affiliation" value="${esc(data.affiliation || "")}" />
				</div>
				<div class="field">
					<label>Active Years</label>
					<input type="text" data-fm="activeYears" value="${esc(data.activeYears || "")}" />
				</div>
			</div>
			<div class="field">
				<label>Bio</label>
				<textarea data-fm="bio">${esc(data.bio || "")}</textarea>
			</div>
			${imageField("avatar", "Avatar Image")}
			<div class="field">
				<label>Tags (comma separated)</label>
				<input type="text" data-fm-list="tags" value="${esc(arrVal("tags"))}" />
			</div>
			<label class="toggle-row">
				<span>Draft</span>
				<input type="checkbox" data-fm="draft" ${data.draft ? "checked" : ""} />
			</label>
		`;
	}

	if (col === "dynamic") {
		return `
			<div class="field-row">
				<div class="field">
					<label>Published (ISO Date/Time)</label>
					<input type="text" data-fm="published" value="${esc(data.published || "")}" />
				</div>
				<div class="field">
					<label>Location</label>
					<input type="text" data-fm="location" value="${esc(data.location || "")}" />
				</div>
			</div>
			<label class="toggle-row">
				<span>Pinned</span>
				<input type="checkbox" data-fm="pinned" ${data.pinned ? "checked" : ""} />
			</label>
		`;
	}

	if (col === "projects") {
		return `
			<div class="field">
				<label>Title</label>
				<input type="text" data-fm="title" value="${esc(data.title || "")}" />
			</div>
			<div class="field-row">
				<div class="field">
					<label>Published</label>
					<input type="date" data-fm="published" value="${esc(data.published || "")}" />
				</div>
				<div class="field">
					<label>Status</label>
					<select data-fm="status">
						${["active", "planning", "developing", "published", "archived"]
							.map(
								(st) =>
									`<option value="${st}" ${data.status === st ? "selected" : ""}>${st}</option>`,
							)
							.join("")}
					</select>
				</div>
			</div>
			<div class="field">
				<label>Description</label>
				<textarea data-fm="description">${esc(data.description || "")}</textarea>
			</div>
			${imageField("image", "Project Image")}
		`;
	}

	return `
		<div class="field">
			<label>Page Title</label>
			<input type="text" data-fm="title" value="${esc(data.title || "")}" />
		</div>
		<div class="field">
			<label>Description</label>
			<textarea data-fm="description">${esc(data.description || "")}</textarea>
		</div>
	`;
}

function renderContentTab() {
	if (state.activeEntry) {
		const entry = state.activeEntry;
		const headerBar = `
			<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
				<button type="button" class="btn-secondary" data-back-to-list>&lt;- All ${esc(COLLECTION_LABELS[entry.collection] || entry.collection)}</button>
				<div style="display:flex;align-items:center;gap:6px;">
					<button type="button" class="mini-btn" data-toggle-raw-entry>${state.rawContentMode ? "Visual Form" : "Raw File"}</button>
					<button type="button" class="mini-btn" data-preview-entry="${esc(entry.route)}">Open Preview</button>
					${entry.collection !== "spec" ? `<button type="button" class="btn-danger" data-delete-entry>Delete</button>` : ""}
				</div>
			</div>
			<div class="entry-meta">Editing <strong>${esc(entry.collection)}/${esc(entry.slug)}${esc(entry.ext)}</strong> (${esc(entry.route)})</div>
		`;

		if (state.rawContentMode) {
			return `
				${headerBar}
				<div class="field">
					<label>Full Raw Markdown / MDX File</label>
					<textarea id="raw-entry-textarea" class="mdx-editor" style="min-height:500px">${esc(entry.raw || "")}</textarea>
				</div>
			`;
		}

		const fmCard = `
			<section class="section-card ${state.frontmatterOpen ? "" : "is-collapsed"}">
				<div class="section-header" data-toggle-fm>
					<span>Frontmatter Fields (${esc(COLLECTION_LABELS[entry.collection])})</span>
					<span>${state.frontmatterOpen ? "-" : "+"}</span>
				</div>
				<div class="section-body">
					${renderFrontmatterFields(entry.collection, entry.data || {})}
				</div>
			</section>
		`;

		const toolbar = `
			<div class="editor-toolbar">
				<button type="button" class="mini-btn" data-fmt="h2">H2</button>
				<button type="button" class="mini-btn" data-fmt="h3">H3</button>
				<button type="button" class="mini-btn" data-fmt="bold">Bold</button>
				<button type="button" class="mini-btn" data-fmt="italic">Italic</button>
				<button type="button" class="mini-btn" data-fmt="link">Link</button>
				<button type="button" class="mini-btn" data-fmt="list">List</button>
				<button type="button" class="mini-btn" data-fmt="quote">Quote</button>
				<button type="button" class="mini-btn is-on" data-block="wikilink">+ Wiki Link</button>
				<button type="button" class="mini-btn is-on" data-block="callout">+ Callout</button>
				<button type="button" class="mini-btn" data-block="spoiler">+ Spoiler</button>
				<button type="button" class="mini-btn" data-block="image">+ Image</button>
				<button type="button" class="mini-btn" data-block="code">+ Code</button>
				<button type="button" class="mini-btn" data-block="mermaid">+ Mermaid</button>
				<button type="button" class="mini-btn" data-block="github">+ GitHub</button>
				${
					entry.ext === ".mdx"
						? `<button type="button" class="mini-btn" data-block="steps">+ Steps</button>
						   <button type="button" class="mini-btn" data-block="timeline">+ Timeline</button>
						   <button type="button" class="mini-btn" data-block="tabs">+ Tabs</button>`
						: ""
				}
			</div>
		`;

		return `
			${headerBar}
			${fmCard}
			<div class="field">
				<label>Body (${esc(entry.ext)})</label>
				${toolbar}
				<textarea id="entry-body-textarea" class="mdx-editor">${esc(entry.body || "")}</textarea>
			</div>
		`;
	}

	const cols = Object.keys(COLLECTION_LABELS);
	const list = state.collections[state.activeCollection] || [];
	const q = state.contentQuery.toLowerCase().trim();
	const filtered = list.filter(
		(item) =>
			!q ||
			item.title.toLowerCase().includes(q) ||
			item.slug.toLowerCase().includes(q) ||
			item.subtitle.toLowerCase().includes(q),
	);

	return `
		<div class="pill-bar">
			${cols
				.map(
					(c) => `
					<button type="button" class="filter-pill ${state.activeCollection === c ? "is-active" : ""}" data-select-col="${esc(c)}">
						${esc(COLLECTION_LABELS[c])} (${(state.collections[c] || []).length})
					</button>
				`,
				)
				.join("")}
		</div>
		<div class="inline-input-group">
			<input type="text" id="content-search-input" placeholder="Search entries..." value="${esc(state.contentQuery)}" />
			${
				state.activeCollection !== "spec"
					? `<button type="button" class="btn-primary" data-new-entry>+ New</button>`
					: ""
			}
		</div>
		<div class="entry-list">
			${
				filtered.length === 0
					? `<p class="entry-meta">No entries match your search.</p>`
					: filtered
							.map(
								(item) => `
								<button type="button" class="entry-row" data-open-entry="${esc(item.collection)}:${esc(item.slug)}">
									<div>
										<div class="entry-title">${esc(item.title)}</div>
										<div class="entry-meta">${esc(item.slug)}${item.date ? ` · ${esc(item.date)}` : ""}</div>
									</div>
									<span class="entry-badge">${esc(item.draft ? "Draft" : item.status || item.ext)}</span>
								</button>
							`,
							)
							.join("")
			}
		</div>
	`;
}

function renderMediaTab(forPicker = false) {
	const folders = [
		"all",
		"DesktopWallpaper",
		"MobileWallpaper",
		"gallery/axia-showcase",
		"gallery/axia-wallpapers",
		"uploads",
	];
	const items = state.mediaItems.filter(
		(item) => state.mediaFilter === "all" || item.folder === state.mediaFilter,
	);

	return `
		<div class="upload-zone" id="media-upload-zone">
			<strong>Drop an image here or click to upload</strong>
			<div class="entry-meta">Saves directly to public/uploads/ (webp, png, jpg, svg, gif)</div>
			<input type="file" id="media-file-input" accept="image/*" class="is-hidden" />
		</div>
		<div class="pill-bar">
			${folders
				.map(
					(f) => `
					<button type="button" class="filter-pill ${state.mediaFilter === f ? "is-active" : ""}" data-media-folder="${esc(f)}">
						${esc(f === "all" ? "All Media" : f)}
					</button>
				`,
				)
				.join("")}
		</div>
		<div class="media-grid">
			${items
				.map(
					(item) => `
					<div class="media-card">
						<img src="${esc(item.previewUrl)}" alt="${esc(item.name)}" loading="lazy" />
						<div class="media-card-body">
							<div class="media-name" title="${esc(item.valuePath)}">${esc(item.name)}</div>
							<div style="display:flex;gap:4px;flex-wrap:wrap;">
								${
									forPicker
										? `<button type="button" class="mini-btn is-on" data-choose-media="${esc(item.valuePath)}">Select</button>`
										: `<button type="button" class="mini-btn" data-copy-media="${esc(item.valuePath)}">Copy Path</button>
										   <button type="button" class="mini-btn" data-preview-wp="${esc(item.previewUrl)}">Preview Hero</button>`
								}
							</div>
						</div>
					</div>
				`,
				)
				.join("")}
		</div>
	`;
}

function renderPublishTab() {
	const gs = state.gitStatus;
	const vr = state.verifyResult;

	const gitSection = `
		<div style="display:flex;justify-content:space-between;align-items:center;">
			<div><strong>Branch:</strong> ${esc(gs.branch || "main")}</div>
			<button type="button" class="mini-btn" data-refresh-git>Refresh</button>
		</div>
		${
			!gs.available
				? `<p class="entry-meta">Git executable not detected in PATH or GitHub Desktop.</p>`
				: gs.files.length === 0
					? `<p class="entry-meta">Working tree is clean (0 modified files).</p>`
					: `<div class="entry-list">
							${gs.files
								.map(
									(f) => `
									<div class="entry-row" style="cursor:default;padding:6px 8px;">
										<span class="entry-meta" style="margin:0;color:#1e293b">${esc(f.path)}</span>
										<span class="entry-badge">${esc(f.status)}</span>
									</div>
								`,
								)
								.join("")}
						</div>`
		}
	`;

	const verifySection = `
		<button type="button" class="btn-secondary" data-run-verify ${state.verifying ? "disabled" : ""}>
			${state.verifying ? "Running Check + Build + Links..." : "Run Full Verify (Check, Type-Check, Build, Links)"}
		</button>
		${
			vr
				? `<div style="display:flex;flex-direction:column;gap:6px;">
						${vr.steps
							.map(
								(st) => `
								<div class="verify-step">
									<div class="verify-step-head">
										<span class="${st.ok ? "status-ok" : "status-fail"}">${st.ok ? "PASS" : "FAIL"} - ${esc(st.name)}</span>
										<span class="entry-meta">${(st.durationMs / 1000).toFixed(1)}s</span>
									</div>
									${!st.ok || st.name === "pnpm run check:links" ? `<pre class="verify-log">${esc(st.output.slice(-1500))}</pre>` : ""}
								</div>
							`,
							)
							.join("")}
					</div>`
				: ""
		}
	`;

	const pushSection = `
		<div class="pill-bar">
			${["feat: ", "fix: ", "content: ", "chore: "]
				.map(
					(prefix) =>
						`<button type="button" class="mini-btn" data-commit-prefix="${esc(prefix)}">${esc(prefix.trim())}</button>`,
				)
				.join("")}
		</div>
		<div class="field">
			<label>Commit Message</label>
			<input type="text" id="commit-message-input" placeholder="content: update site settings and pages" />
		</div>
		<button type="button" class="btn-primary" data-commit-push ${state.publishing ? "disabled" : ""}>
			${state.publishing ? "Pushing to main..." : "Commit & Push to main"}
		</button>
	`;

	return (
		renderAccordion("git-status", "Working Tree Status", gitSection) +
		renderAccordion("verify", "Verify Before Publishing", verifySection) +
		renderAccordion("push", "Commit & Push to GitHub", pushSection)
	);
}

function renderWorkbench() {
	let html = "";
	if (state.activeTab === "design") html = renderDesignTab();
	else if (state.activeTab === "layout") html = renderLayoutTab();
	else if (state.activeTab === "content") html = renderContentTab();
	else if (state.activeTab === "media") html = renderMediaTab(false);
	else if (state.activeTab === "publish") html = renderPublishTab();

	els.workbench.innerHTML = html;
	bindWorkbenchEvents();
}

function setNestedPath(obj, dotPath, value) {
	const parts = dotPath.split(".");
	let cur = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		const k = parts[i];
		if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
		cur = cur[k];
	}
	cur[parts[parts.length - 1]] = value;
}

function insertAtCursor(textarea, snippet) {
	if (!textarea) return;
	const start = textarea.selectionStart ?? textarea.value.length;
	const end = textarea.selectionEnd ?? start;
	const before = textarea.value.slice(0, start);
	const after = textarea.value.slice(end);
	textarea.value = `${before}${snippet}${after}`;
	state.activeEntry.body = textarea.value;
	textarea.focus();
	const pos = start + snippet.length;
	textarea.setSelectionRange(pos, pos);
	scheduleAutoSave();
}

function wrapSelection(textarea, left, right, fallback) {
	if (!textarea) return;
	const start = textarea.selectionStart ?? 0;
	const end = textarea.selectionEnd ?? start;
	const selected = textarea.value.slice(start, end) || fallback;
	const before = textarea.value.slice(0, start);
	const after = textarea.value.slice(end);
	textarea.value = `${before}${left}${selected}${right}${after}`;
	state.activeEntry.body = textarea.value;
	textarea.focus();
	textarea.setSelectionRange(
		start + left.length,
		start + left.length + selected.length,
	);
	scheduleAutoSave();
}

function openMediaPickerModal(onPick) {
	openModal(
		"Select or Upload Media",
		`<div id="picker-media-root">${renderMediaTab(true)}</div>`,
		"",
		(panel) => {
			const rebindPicker = () => {
				const root = panel.querySelector("#picker-media-root");
				if (!root) return;
				root.innerHTML = renderMediaTab(true);
				bindMediaZone(root, () => {
					rebindPicker();
				});
				for (const btn of root.querySelectorAll("[data-media-folder]")) {
					btn.addEventListener("click", () => {
						state.mediaFilter = btn.dataset.mediaFolder;
						rebindPicker();
					});
				}
				for (const btn of root.querySelectorAll("[data-choose-media]")) {
					btn.addEventListener("click", () => {
						onPick(btn.dataset.chooseMedia);
						closeModal();
					});
				}
			};
			rebindPicker();
		},
	);
}

function openWikiLinkModal(textarea) {
	const entries = ["performers", "events", "wiki", "posts"].flatMap((col) =>
		(state.collections[col] || []).map((item) => ({
			col,
			slug: item.slug,
			title: item.title,
		})),
	);

	const bodyHtml = `
		<div class="field">
			<label>Search Entry</label>
			<input type="text" id="wl-search" placeholder="Filter by title, slug, or collection..." />
		</div>
		<div class="field-row">
			<div class="field">
				<label>Insert Mode</label>
				<select id="wl-mode">
					<option value="inline">Inline Link (inside text)</option>
					<option value="card">Standalone Rich Link Card</option>
				</select>
			</div>
			<div class="field">
				<label>Custom Label (optional)</label>
				<input type="text" id="wl-label" placeholder="Leave blank for entry title" />
			</div>
		</div>
		<div class="relation-box" id="wl-results" style="max-height:240px"></div>
	`;

	openModal("Insert Wiki Link", bodyHtml, "", (panel) => {
		const searchEl = panel.querySelector("#wl-search");
		const resultsEl = panel.querySelector("#wl-results");
		const renderResults = () => {
			const q = searchEl.value.toLowerCase().trim();
			const matches = entries.filter(
				(e) =>
					!q ||
					e.title.toLowerCase().includes(q) ||
					e.slug.toLowerCase().includes(q) ||
					e.col.includes(q),
			);
			resultsEl.innerHTML = matches
				.map(
					(e) => `
					<button type="button" class="entry-row" style="padding:6px 8px" data-wl-pick="${esc(e.col)}/${esc(e.slug)}">
						<div>
							<div class="entry-title">${esc(e.title)}</div>
							<div class="entry-meta">[[${esc(e.col)}/${esc(e.slug)}]]</div>
						</div>
						<span class="entry-badge">${esc(e.col)}</span>
					</button>
				`,
				)
				.join("");
			for (const btn of resultsEl.querySelectorAll("[data-wl-pick]")) {
				btn.addEventListener("click", () => {
					const target = btn.dataset.wlPick;
					const mode = panel.querySelector("#wl-mode").value;
					const customLabel = panel.querySelector("#wl-label").value.trim();
					const tag = customLabel
						? `[[${target}|${customLabel}]]`
						: `[[${target}]]`;
					const snippet = mode === "card" ? `\n\n${tag}\n\n` : tag;
					insertAtCursor(textarea, snippet);
					closeModal();
				});
			}
		};
		searchEl.addEventListener("input", renderResults);
		renderResults();
	});
}

function openCalloutModal(textarea) {
	openModal(
		"Insert Callout Box",
		`
		<div class="field">
			<label>Type</label>
			<select id="co-type">
				<option value="NOTE">NOTE</option>
				<option value="TIP">TIP</option>
				<option value="IMPORTANT">IMPORTANT</option>
				<option value="WARNING">WARNING</option>
				<option value="CAUTION">CAUTION</option>
			</select>
		</div>
		<div class="field">
			<label>Message</label>
			<textarea id="co-msg" placeholder="Write callout text..."></textarea>
		</div>
		`,
		`<button type="button" class="btn-primary" id="co-insert">Insert Callout</button>`,
		(panel) => {
			panel.querySelector("#co-insert").addEventListener("click", () => {
				const type = panel.querySelector("#co-type").value;
				const msg = (
					panel.querySelector("#co-msg").value || "Callout text"
				).trim();
				const lines = msg
					.split(/\r?\n/)
					.map((l) => `> ${l}`)
					.join("\n");
				insertAtCursor(textarea, `\n\n> [!${type}]\n${lines}\n\n`);
				closeModal();
			});
		},
	);
}

function openNewEntryModal() {
	openModal(
		`Create New ${COLLECTION_LABELS[state.activeCollection] || "Entry"}`,
		`
		<div class="field">
			<label>Title / Name</label>
			<input type="text" id="new-entry-title" placeholder="e.g. Bandung Anisong Night 2027" />
		</div>
		<div class="field">
			<label>Filename Slug</label>
			<input type="text" id="new-entry-slug" placeholder="bandung-anisong-night-2027" />
		</div>
		`,
		`<button type="button" class="btn-primary" id="new-entry-submit">Create Entry</button>`,
		(panel) => {
			const titleEl = panel.querySelector("#new-entry-title");
			const slugEl = panel.querySelector("#new-entry-slug");
			let slugTouched = false;
			slugEl.addEventListener("input", () => {
				slugTouched = true;
			});
			titleEl.addEventListener("input", () => {
				if (!slugTouched) {
					slugEl.value = titleEl.value
						.toLowerCase()
						.trim()
						.replace(/[^a-z0-9]+/g, "-")
						.replace(/^-+|-+$/g, "");
				}
			});
			panel
				.querySelector("#new-entry-submit")
				.addEventListener("click", async () => {
					try {
						const res = await apiFetch("/content/entry", {
							method: "POST",
							body: JSON.stringify({
								collection: state.activeCollection,
								title: titleEl.value.trim(),
								slug: slugEl.value.trim(),
							}),
						});
						closeModal();
						await refreshCollections();
						await openContentEntry(res.collection, res.slug, true);
						showToast(`Created ${res.collection}/${res.slug}`);
					} catch (err) {
						showToast(`Create error: ${err.message}`);
					}
				});
		},
	);
}

function bindMediaZone(container, onUploaded) {
	const zone = container.querySelector("#media-upload-zone");
	const input = container.querySelector("#media-file-input");
	if (!zone || !input) return;

	const handleFile = (file) => {
		if (!file) return;
		const reader = new FileReader();
		reader.onload = async () => {
			try {
				const uploaded = await apiFetch("/media/upload", {
					method: "POST",
					body: JSON.stringify({
						filename: file.name,
						dataUrl: String(reader.result || ""),
					}),
				});
				await refreshMedia();
				showToast(`Uploaded ${uploaded.valuePath}`);
				onUploaded();
			} catch (err) {
				showToast(`Upload error: ${err.message}`);
			}
		};
		reader.readAsDataURL(file);
	};

	zone.addEventListener("click", () => input.click());
	input.addEventListener("change", () => handleFile(input.files?.[0]));
	zone.addEventListener("dragover", (e) => {
		e.preventDefault();
		zone.classList.add("is-dragover");
	});
	zone.addEventListener("dragleave", () => {
		zone.classList.remove("is-dragover");
	});
	zone.addEventListener("drop", (e) => {
		e.preventDefault();
		zone.classList.remove("is-dragover");
		handleFile(e.dataTransfer?.files?.[0]);
	});
}

function bindWorkbenchEvents() {
	for (const hdr of els.workbench.querySelectorAll("[data-toggle-section]")) {
		hdr.addEventListener("click", () => {
			const id = hdr.dataset.toggleSection;
			state.collapsedSections[id] = !state.collapsedSections[id];
			renderWorkbench();
		});
	}

	for (const el of els.workbench.querySelectorAll("[data-setting]")) {
		const eventName =
			el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input";
		el.addEventListener(eventName, () => {
			const key = el.dataset.setting;
			let val;
			if (el.type === "checkbox") val = el.checked;
			else if (el.dataset.type === "number" || el.type === "range")
				val = Number(el.value);
			else val = el.value;
			setNestedPath(state.settings, key, val);

			const labelValSpan = el.closest(".field")?.querySelector("label span");
			if (labelValSpan && el.type === "range") {
				labelValSpan.textContent =
					key === "site.pageWidth" ? `${val}rem` : String(val);
			}
			sendPreviewPatch();
			scheduleAutoSave();
		});
	}

	const subTa = els.workbench.querySelector("[data-banner-subtitles]");
	if (subTa) {
		subTa.addEventListener("input", () => {
			state.settings.banner.subtitles = subTa.value
				.split(/\r?\n/)
				.map((s) => s.trim())
				.filter(Boolean);
			sendPreviewPatch();
			scheduleAutoSave();
		});
	}

	for (const swatch of els.workbench.querySelectorAll("[data-hue-preset]")) {
		swatch.addEventListener("click", () => {
			state.settings.site.themeHue = Number(swatch.dataset.huePreset);
			sendPreviewPatch();
			scheduleAutoSave();
			renderWorkbench();
		});
	}

	for (const tile of els.workbench.querySelectorAll("[data-preview-wp]")) {
		tile.addEventListener("click", (e) => {
			if (e.target.closest(".remove-wp")) return;
			sendPreviewPatch({
				banner: { previewImageUrl: tile.dataset.previewWp },
			});
			showToast("Previewing wallpaper on Hero");
		});
	}

	for (const btn of els.workbench.querySelectorAll("[data-remove-wp]")) {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			const [key, idxStr] = btn.dataset.removeWp.split(":");
			const arr = state.settings.banner?.[key];
			if (Array.isArray(arr)) {
				arr.splice(Number(idxStr), 1);
				scheduleAutoSave();
				renderWorkbench();
			}
		});
	}

	for (const btn of els.workbench.querySelectorAll("[data-add-wp]")) {
		btn.addEventListener("click", () => {
			const key = btn.dataset.addWp;
			openMediaPickerModal((selectedPath) => {
				if (!Array.isArray(state.settings.banner[key])) {
					state.settings.banner[key] = [];
				}
				state.settings.banner[key].push(selectedPath);
				sendPreviewPatch({
					banner: { previewImageUrl: resolveMediaPreviewUrl(selectedPath) },
				});
				scheduleAutoSave();
				renderWorkbench();
			});
		});
	}

	for (const btn of els.workbench.querySelectorAll("[data-pick-media-for]")) {
		btn.addEventListener("click", () => {
			const spec = btn.dataset.pickMediaFor;
			openMediaPickerModal((selectedPath) => {
				if (spec.startsWith("setting:")) {
					setNestedPath(state.settings, spec.slice(8), selectedPath);
					sendPreviewPatch();
				} else if (spec.startsWith("fm:") && state.activeEntry) {
					state.activeEntry.data[spec.slice(3)] = selectedPath;
				}
				scheduleAutoSave();
				renderWorkbench();
			});
		});
	}

	// Sidebar widget controls
	for (const cb of els.workbench.querySelectorAll("[data-widget-toggle]")) {
		cb.addEventListener("click", () => {
			const [side, idxStr, prop] = cb.dataset.widgetToggle.split(":");
			const item = state.settings.sidebar?.[side]?.[Number(idxStr)];
			if (!item) return;
			item[prop] = cb.tagName === "INPUT" ? cb.checked : !item[prop];
			scheduleAutoSave();
			renderWorkbench();
		});
	}

	for (const btn of els.workbench.querySelectorAll("[data-widget-pos]")) {
		btn.addEventListener("click", () => {
			const [side, idxStr] = btn.dataset.widgetPos.split(":");
			const item = state.settings.sidebar?.[side]?.[Number(idxStr)];
			if (!item) return;
			item.position = item.position === "top" ? "sticky" : "top";
			scheduleAutoSave();
			renderWorkbench();
		});
	}

	for (const btn of els.workbench.querySelectorAll("[data-widget-move]")) {
		btn.addEventListener("click", () => {
			const [side, idxStr, dir] = btn.dataset.widgetMove.split(":");
			const list = state.settings.sidebar?.[side];
			const idx = Number(idxStr);
			const nextIdx = dir === "up" ? idx - 1 : idx + 1;
			if (!list || nextIdx < 0 || nextIdx >= list.length) return;
			const [moved] = list.splice(idx, 1);
			list.splice(nextIdx, 0, moved);
			scheduleAutoSave();
			renderWorkbench();
		});
	}

	for (const btn of els.workbench.querySelectorAll("[data-widget-swap]")) {
		btn.addEventListener("click", () => {
			const [side, idxStr] = btn.dataset.widgetSwap.split(":");
			const other = side === "left" ? "right" : "left";
			const srcList = state.settings.sidebar?.[side];
			const dstList = state.settings.sidebar?.[other];
			const idx = Number(idxStr);
			if (!srcList || !dstList || !srcList[idx]) return;
			const [moved] = srcList.splice(idx, 1);
			dstList.push(moved);
			scheduleAutoSave();
			renderWorkbench();
		});
	}

	let dragMeta = null;
	for (const item of els.workbench.querySelectorAll(
		".widget-item[draggable='true']",
	)) {
		item.addEventListener("dragstart", () => {
			dragMeta = {
				side: item.dataset.widgetSide,
				idx: Number(item.dataset.widgetIdx),
			};
		});
		item.addEventListener("dragover", (e) => {
			if (dragMeta) e.preventDefault();
		});
		item.addEventListener("drop", (e) => {
			e.preventDefault();
			if (!dragMeta) return;
			const toSide = item.dataset.widgetSide;
			const toIdx = Number(item.dataset.widgetIdx);
			const srcList = state.settings.sidebar?.[dragMeta.side];
			const dstList = state.settings.sidebar?.[toSide];
			if (!srcList || !dstList) return;
			const [moved] = srcList.splice(dragMeta.idx, 1);
			dstList.splice(toIdx, 0, moved);
			dragMeta = null;
			scheduleAutoSave();
			renderWorkbench();
		});
	}

	// Content List Controls
	for (const btn of els.workbench.querySelectorAll("[data-select-col]")) {
		btn.addEventListener("click", () => {
			state.activeCollection = btn.dataset.selectCol;
			renderWorkbench();
		});
	}

	const searchInput = els.workbench.querySelector("#content-search-input");
	if (searchInput) {
		searchInput.addEventListener("input", () => {
			const pos = searchInput.selectionStart;
			state.contentQuery = searchInput.value;
			renderWorkbench();
			const refocused = els.workbench.querySelector("#content-search-input");
			if (refocused) {
				refocused.focus();
				refocused.setSelectionRange(pos, pos);
			}
		});
	}

	for (const btn of els.workbench.querySelectorAll("[data-open-entry]")) {
		btn.addEventListener("click", () => {
			const [col, slug] = btn.dataset.openEntry.split(":");
			openContentEntry(col, slug, true);
		});
	}

	const newBtn = els.workbench.querySelector("[data-new-entry]");
	if (newBtn) newBtn.addEventListener("click", openNewEntryModal);

	// Content Entry Editor Controls
	const backBtn = els.workbench.querySelector("[data-back-to-list]");
	if (backBtn) {
		backBtn.addEventListener("click", () => {
			if (isEntryDirty() && !window.confirm("Discard unsaved entry changes?")) {
				return;
			}
			state.activeEntry = null;
			state.savedEntryStr = "";
			updateDirtyButtons();
			renderWorkbench();
		});
	}

	const toggleRawBtn = els.workbench.querySelector("[data-toggle-raw-entry]");
	if (toggleRawBtn) {
		toggleRawBtn.addEventListener("click", () => {
			state.rawContentMode = !state.rawContentMode;
			renderWorkbench();
		});
	}

	const previewEntryBtn = els.workbench.querySelector("[data-preview-entry]");
	if (previewEntryBtn) {
		previewEntryBtn.addEventListener("click", () => {
			navigatePreview(previewEntryBtn.dataset.previewEntry);
		});
	}

	const deleteBtn = els.workbench.querySelector("[data-delete-entry]");
	if (deleteBtn) {
		deleteBtn.addEventListener("click", async () => {
			if (
				!window.confirm(
					`Delete ${state.activeEntry.collection}/${state.activeEntry.slug}? This cannot be undone.`,
				)
			) {
				return;
			}
			try {
				await apiFetch(
					`/content/entry?collection=${encodeURIComponent(state.activeEntry.collection)}&slug=${encodeURIComponent(state.activeEntry.slug)}`,
					{ method: "DELETE" },
				);
				state.activeEntry = null;
				state.savedEntryStr = "";
				await refreshCollections();
				updateDirtyButtons();
				renderWorkbench();
				showToast("Entry deleted");
			} catch (err) {
				showToast(`Delete error: ${err.message}`);
			}
		});
	}

	const toggleFm = els.workbench.querySelector("[data-toggle-fm]");
	if (toggleFm) {
		toggleFm.addEventListener("click", () => {
			state.frontmatterOpen = !state.frontmatterOpen;
			renderWorkbench();
		});
	}

	for (const el of els.workbench.querySelectorAll("[data-fm]")) {
		const ev =
			el.tagName === "SELECT" || el.type === "checkbox" || el.type === "date"
				? "change"
				: "input";
		el.addEventListener(ev, () => {
			const key = el.dataset.fm;
			if (el.type === "checkbox") {
				state.activeEntry.data[key] = el.checked;
			} else if (el.dataset.fmType === "number") {
				state.activeEntry.data[key] =
					el.value === "" ? undefined : Number(el.value);
			} else {
				state.activeEntry.data[key] = el.value;
			}
			scheduleAutoSave();
		});
	}

	for (const el of els.workbench.querySelectorAll("[data-fm-list]")) {
		el.addEventListener("input", () => {
			const key = el.dataset.fmList;
			state.activeEntry.data[key] = el.value
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
			scheduleAutoSave();
		});
	}

	const lineupSearchEl = els.workbench.querySelector("[data-lineup-search]");
	if (lineupSearchEl) {
		lineupSearchEl.addEventListener("input", () => {
			const pos = lineupSearchEl.selectionStart;
			state.lineupSearch = lineupSearchEl.value;
			renderWorkbench();
			const reEl = els.workbench.querySelector("[data-lineup-search]");
			if (reEl) {
				reEl.focus();
				reEl.setSelectionRange(pos, pos);
			}
		});
	}

	for (const cb of els.workbench.querySelectorAll("[data-lineup-slug]")) {
		cb.addEventListener("change", () => {
			const slug = cb.dataset.lineupSlug;
			const current = new Set(
				Array.isArray(state.activeEntry.data.lineup)
					? state.activeEntry.data.lineup
					: [],
			);
			if (cb.checked) current.add(slug);
			else current.delete(slug);
			state.activeEntry.data.lineup = [...current];
			scheduleAutoSave();
		});
	}

	const bodyTa = els.workbench.querySelector("#entry-body-textarea");
	if (bodyTa) {
		bodyTa.addEventListener("input", () => {
			state.activeEntry.body = bodyTa.value;
			scheduleAutoSave();
		});
	}

	const rawTa = els.workbench.querySelector("#raw-entry-textarea");
	if (rawTa) {
		rawTa.addEventListener("input", () => {
			state.activeEntry.raw = rawTa.value;
			scheduleAutoSave();
		});
	}

	for (const btn of els.workbench.querySelectorAll("[data-fmt]")) {
		btn.addEventListener("click", () => {
			const fmt = btn.dataset.fmt;
			if (fmt === "h2") insertAtCursor(bodyTa, "\n## Heading\n");
			else if (fmt === "h3") insertAtCursor(bodyTa, "\n### Subheading\n");
			else if (fmt === "bold") wrapSelection(bodyTa, "**", "**", "bold text");
			else if (fmt === "italic") wrapSelection(bodyTa, "*", "*", "italic text");
			else if (fmt === "link")
				wrapSelection(bodyTa, "[", "](https://)", "link text");
			else if (fmt === "list") insertAtCursor(bodyTa, "\n- Item 1\n- Item 2\n");
			else if (fmt === "quote") insertAtCursor(bodyTa, "\n> Quote text\n");
		});
	}

	for (const btn of els.workbench.querySelectorAll("[data-block]")) {
		btn.addEventListener("click", () => {
			const block = btn.dataset.block;
			if (block === "wikilink") openWikiLinkModal(bodyTa);
			else if (block === "callout") openCalloutModal(bodyTa);
			else if (block === "spoiler")
				wrapSelection(bodyTa, ":spoiler[", "]", "hidden text");
			else if (block === "image") {
				openMediaPickerModal((selectedPath) => {
					insertAtCursor(bodyTa, `\n\n![Image](${selectedPath})\n\n`);
				});
			} else if (block === "code") {
				insertAtCursor(
					bodyTa,
					'\n\n```ts title="example.ts"\nconsole.log("Axia Zone ID");\n```\n\n',
				);
			} else if (block === "mermaid") {
				insertAtCursor(
					bodyTa,
					"\n\n```mermaid\nflowchart LR\n    A[Start] --> B[End]\n```\n\n",
				);
			} else if (block === "github") {
				insertAtCursor(
					bodyTa,
					'\n\n::github{repo="raitoklaus/axia-zone-id"}\n\n',
				);
			} else if (block === "steps") {
				insertAtCursor(
					bodyTa,
					'\n\n<Steps>\n\t<StepItem title="Step One" icon="edit">\n\t\tDescription here.\n\t</StepItem>\n\t<StepItem title="Step Two" type="tip" icon="rocket">\n\t\tNext step here.\n\t</StepItem>\n</Steps>\n\n',
				);
			} else if (block === "timeline") {
				insertAtCursor(
					bodyTa,
					'\n\n<Timeline>\n\t<TimelineItem date="2026-12-01" title="Milestone" icon="star">\n\t\tDetails here.\n\t</TimelineItem>\n</Timeline>\n\n',
				);
			} else if (block === "tabs") {
				insertAtCursor(
					bodyTa,
					'\n\n<TabGroup labels={["Tab One", "Tab Two"]} client:load>\n\t```yaml\n\tkey: value\n\t```\n\n\t```yaml\n\tkey: value2\n\t```\n</TabGroup>\n\n',
				);
			}
		});
	}

	// Media Tab Controls
	if (state.activeTab === "media") {
		bindMediaZone(els.workbench, renderWorkbench);
		for (const btn of els.workbench.querySelectorAll("[data-media-folder]")) {
			btn.addEventListener("click", () => {
				state.mediaFilter = btn.dataset.mediaFolder;
				renderWorkbench();
			});
		}
		for (const btn of els.workbench.querySelectorAll("[data-copy-media]")) {
			btn.addEventListener("click", async () => {
				await navigator.clipboard?.writeText(btn.dataset.copyMedia);
				showToast(`Copied ${btn.dataset.copyMedia}`);
			});
		}
	}

	// Publish Tab Controls
	const refreshGitBtn = els.workbench.querySelector("[data-refresh-git]");
	if (refreshGitBtn) refreshGitBtn.addEventListener("click", refreshGitStatus);

	const runVerifyBtn = els.workbench.querySelector("[data-run-verify]");
	if (runVerifyBtn) {
		runVerifyBtn.addEventListener("click", async () => {
			state.verifying = true;
			renderWorkbench();
			try {
				state.verifyResult = await apiFetch("/action/verify", {
					method: "POST",
					body: JSON.stringify({}),
				});
				showToast(
					state.verifyResult.ok
						? "All verification checks passed"
						: "Verification failed",
				);
			} catch (err) {
				showToast(`Verify error: ${err.message}`);
			} finally {
				state.verifying = false;
				renderWorkbench();
			}
		});
	}

	for (const btn of els.workbench.querySelectorAll("[data-commit-prefix]")) {
		btn.addEventListener("click", () => {
			const msgEl = els.workbench.querySelector("#commit-message-input");
			if (msgEl) {
				msgEl.value = btn.dataset.commitPrefix;
				msgEl.focus();
			}
		});
	}

	const pushBtn = els.workbench.querySelector("[data-commit-push]");
	if (pushBtn) {
		pushBtn.addEventListener("click", async () => {
			const msg = els.workbench
				.querySelector("#commit-message-input")
				?.value?.trim();
			if (!msg) {
				showToast("Enter a commit message first");
				return;
			}
			if (isDirty()) {
				await saveAll(true);
			}
			state.publishing = true;
			renderWorkbench();
			try {
				const res = await apiFetch("/action/publish", {
					method: "POST",
					body: JSON.stringify({ message: msg }),
				});
				await refreshGitStatus();
				showToast(res.ok ? "Committed & pushed to main" : "Push failed");
			} catch (err) {
				showToast(`Publish error: ${err.message}`);
			} finally {
				state.publishing = false;
				renderWorkbench();
			}
		});
	}
}

function bindTopBarAndGlobalEvents() {
	for (const tabBtn of document.querySelectorAll(".mode-tab")) {
		tabBtn.addEventListener("click", () => {
			state.activeTab = tabBtn.dataset.tab;
			setActiveTabButton(state.activeTab);
			if (state.activeTab === "publish") refreshGitStatus();
			renderWorkbench();
		});
	}

	els.quickRoute.addEventListener("change", () => {
		navigatePreview(els.quickRoute.value);
	});

	els.routeInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			navigatePreview(els.routeInput.value.trim() || "/");
		}
	});

	els.editCurrentBtn.addEventListener("click", () => {
		const { collection, slug } = els.editCurrentBtn.dataset;
		if (collection && slug) {
			openContentEntry(collection, slug, false);
		}
	});

	els.inspectBtn.addEventListener("click", () => {
		state.inspect = !state.inspect;
		if (state.inspect && state.inlineEdit) {
			state.inlineEdit = false;
			els.inlineEditBtn.classList.remove("is-active");
			postToFrame({ type: "axia-studio:inline-edit", enabled: false });
		}
		els.inspectBtn.classList.toggle("is-active", state.inspect);
		postToFrame({ type: "axia-studio:inspect", enabled: state.inspect });
	});

	els.inlineEditBtn.addEventListener("click", () => {
		state.inlineEdit = !state.inlineEdit;
		if (state.inlineEdit && state.inspect) {
			state.inspect = false;
			els.inspectBtn.classList.remove("is-active");
			postToFrame({ type: "axia-studio:inspect", enabled: false });
		}
		els.inlineEditBtn.classList.toggle("is-active", state.inlineEdit);
		postToFrame({ type: "axia-studio:inline-edit", enabled: state.inlineEdit });
		showToast(
			state.inlineEdit
				? "Inline Text mode enabled - click highlighted text in preview"
				: "Inline Text mode turned off",
		);
	});

	els.autosaveCheckbox.addEventListener("change", () => {
		state.autoSave = els.autosaveCheckbox.checked;
		if (state.autoSave && isDirty()) {
			saveAll(false);
		}
	});

	for (const vpBtn of document.querySelectorAll(".vp-btn")) {
		vpBtn.addEventListener("click", () => {
			state.viewport = vpBtn.dataset.vp;
			for (const b of document.querySelectorAll(".vp-btn")) {
				b.classList.toggle("is-active", b === vpBtn);
			}
			els.previewWrapper.className = `preview-wrapper vp-${state.viewport}`;
		});
	}

	els.reloadBtn.addEventListener("click", () => {
		els.frame.contentWindow?.location.reload();
	});

	els.saveBtn.addEventListener("click", () => saveAll(false));
	els.discardBtn.addEventListener("click", discardAll);

	window.addEventListener("keydown", (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
			e.preventDefault();
			if (isDirty()) saveAll(false);
		} else if (e.key === "Escape") {
			closeModal();
		}
	});

	els.modalBackdrop.addEventListener("click", (e) => {
		if (e.target === els.modalBackdrop) closeModal();
	});

	// Resizable workbench divider
	let resizing = false;
	els.resizer.addEventListener("mousedown", () => {
		resizing = true;
		els.resizer.classList.add("is-dragging");
		document.body.style.cursor = "col-resize";
		els.frame.style.pointerEvents = "none";
	});
	window.addEventListener("mousemove", (e) => {
		if (!resizing) return;
		const width = Math.min(680, Math.max(340, e.clientX));
		els.workbench.style.width = `${width}px`;
	});
	window.addEventListener("mouseup", () => {
		if (!resizing) return;
		resizing = false;
		els.resizer.classList.remove("is-dragging");
		document.body.style.cursor = "";
		els.frame.style.pointerEvents = "";
	});

	// Messages from bridge.js inside iframe
	const replaceInlineBodyText = (body, oldText, newText) => {
		if (!oldText) return null;
		if (body.includes(oldText)) {
			const idx = body.indexOf(oldText);
			return `${body.slice(0, idx)}${newText}${body.slice(idx + oldText.length)}`;
		}
		const lines = body.split(/\r?\n/);
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const prefixMatch = line.match(
				/^(\s*(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+))(.+)$/,
			);
			if (prefixMatch && prefixMatch[2].trim() === oldText.trim()) {
				lines[i] = `${prefixMatch[1]}${newText}`;
				return lines.join("\n");
			}
		}
		return null;
	};

	let inlineLoadPromise = null;
	let inlineLoadKey = "";

	const ensureEntryLoadedForInline = async (pathname) => {
		const match = findEntryByRoute(pathname || state.previewRoute);
		if (!match) return null;
		const key = `${match.collection}:${match.slug}`;
		if (
			state.activeEntry &&
			state.activeEntry.collection === match.collection &&
			state.activeEntry.slug === match.slug
		) {
			return state.activeEntry;
		}
		if (inlineLoadPromise && inlineLoadKey === key) {
			return inlineLoadPromise;
		}
		inlineLoadKey = key;
		inlineLoadPromise = apiFetch(
			`/content/entry?collection=${encodeURIComponent(match.collection)}&slug=${encodeURIComponent(match.slug)}`,
		)
			.then((entry) => {
				state.activeCollection = match.collection;
				state.activeEntry = entry;
				state.rawContentMode = false;
				state.savedEntryStr = JSON.stringify({
					data: entry.data,
					body: entry.body,
					raw: null,
				});
				return state.activeEntry;
			})
			.finally(() => {
				inlineLoadPromise = null;
				inlineLoadKey = "";
			});
		return inlineLoadPromise;
	};

	window.addEventListener("message", async (event) => {
		if (event.origin !== window.location.origin) return;
		const msg = event.data;
		if (!msg || typeof msg !== "object") return;
		if (msg.type === "axia-studio:route" && typeof msg.pathname === "string") {
			state.previewRoute = msg.pathname;
			els.routeInput.value = msg.pathname;
			updateEditCurrentButton();
			if (state.inspect) {
				postToFrame({ type: "axia-studio:inspect", enabled: true });
			}
			if (state.inlineEdit) {
				postToFrame({ type: "axia-studio:inline-edit", enabled: true });
			}
			if (isSettingsDirty()) {
				sendPreviewPatch();
			}
		} else if (msg.type === "axia-studio:inline-change") {
			if (msg.kind === "setting" && msg.key && state.settings) {
				if (msg.key === "banner.subtitles.0") {
					if (!Array.isArray(state.settings.banner.subtitles)) {
						state.settings.banner.subtitles = [];
					}
					state.settings.banner.subtitles[0] = String(msg.newText || "");
					const subTa = els.workbench.querySelector("[data-banner-subtitles]");
					if (subTa) {
						subTa.value = state.settings.banner.subtitles.join("\n");
					}
				} else {
					setNestedPath(state.settings, msg.key, String(msg.newText || ""));
					const matchingInput = els.workbench.querySelector(
						`[data-setting="${msg.key}"]`,
					);
					if (matchingInput) {
						matchingInput.value = String(msg.newText || "");
					}
				}
				scheduleAutoSave();
			} else if (
				msg.kind === "entry-field" ||
				msg.kind === "entry-body-replace"
			) {
				const entry = await ensureEntryLoadedForInline(msg.pathname);
				if (!entry) return;
				if (msg.kind === "entry-field") {
					if (msg.field === "titleOrName") {
						const k = entry.collection === "performers" ? "name" : "title";
						entry.data[k] = String(msg.newText || "");
						const inp = els.workbench.querySelector(`[data-fm="${k}"]`);
						if (inp) inp.value = entry.data[k];
					} else if (msg.field === "summaryOrBio") {
						const k =
							entry.collection === "performers"
								? "bio"
								: entry.collection === "wiki"
									? "summary"
									: "description";
						entry.data[k] = String(msg.newText || "");
						const inp = els.workbench.querySelector(`[data-fm="${k}"]`);
						if (inp) inp.value = entry.data[k];
					} else if (msg.field === "role") {
						entry.data.role = String(msg.newText || "");
						const inp = els.workbench.querySelector('[data-fm="role"]');
						if (inp) inp.value = entry.data.role;
					}
					scheduleAutoSave();
				} else if (msg.kind === "entry-body-replace") {
					const updatedBody = replaceInlineBodyText(
						entry.body || "",
						String(msg.oldText || ""),
						String(msg.newText || ""),
					);
					if (updatedBody !== null) {
						entry.body = updatedBody;
						const bodyTa = els.workbench.querySelector("#entry-body-textarea");
						if (bodyTa) bodyTa.value = updatedBody;
						scheduleAutoSave();
					} else {
						state.activeTab = "content";
						setActiveTabButton("content");
						renderWorkbench();
						showToast(
							"Formatted Markdown block - finish editing this block in Content Editor",
						);
					}
				}
			}
		} else if (msg.type === "axia-studio:select") {
			if (msg.target === "design" || msg.target === "layout") {
				state.activeTab = msg.target;
				setActiveTabButton(msg.target);
				if (msg.section) {
					state.collapsedSections[msg.section] = false;
				}
				renderWorkbench();
				if (msg.section) {
					const targetCard = els.workbench.querySelector(
						`[data-section-id="${msg.section}"]`,
					);
					targetCard?.scrollIntoView({ behavior: "smooth", block: "start" });
				}
			} else if (msg.target === "content") {
				const match = findEntryByRoute(msg.pathname || state.previewRoute);
				if (match) {
					openContentEntry(match.collection, match.slug, false);
				} else {
					state.activeTab = "content";
					setActiveTabButton("content");
					renderWorkbench();
				}
			}
			state.inspect = false;
			els.inspectBtn.classList.remove("is-active");
			postToFrame({ type: "axia-studio:inspect", enabled: false });
		}
	});
}

async function init() {
	bindTopBarAndGlobalEvents();
	const [settings] = await Promise.all([
		apiFetch("/settings"),
		refreshCollections(),
		refreshMedia(),
		refreshGitStatus(),
	]);
	state.settings = settings;
	state.savedSettingsStr = JSON.stringify(settings);
	updateDirtyButtons();
	renderWorkbench();
}

init().catch((err) => {
	els.workbench.innerHTML = `<p style="color:#dc2626">Failed to load Studio: ${esc(err.message)}</p>`;
});
