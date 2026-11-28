(() => {
	if (!window.parent || window.parent === window) {
		return;
	}

	let inspectEnabled = false;
	let inlineEditEnabled = false;
	let overlayBox = null;
	let overlayLabel = null;
	let activeTarget = null;
	let lastInspectMeta = null;
	let inlineStyleEl = null;
	let inlinePillEl = null;
	const inlineTimers = new WeakMap();

	const postToStudio = (payload) => {
		try {
			window.parent.postMessage(payload, window.location.origin);
		} catch {
			// Ignore cross-origin postMessage errors
		}
	};

	const notifyRoute = () => {
		postToStudio({
			type: "axia-studio:route",
			pathname: window.location.pathname,
			search: window.location.search,
			title: document.title,
		});
		if (inlineEditEnabled) {
			setTimeout(applyInlineEditMode, 80);
		}
	};

	const bindSwupRouteHook = () => {
		if (window.__axiaStudioSwupBound) return;
		if (window.swup?.hooks) {
			window.swup.hooks.on("page:view", notifyRoute);
			window.swup.hooks.on("content:replace", notifyRoute);
			window.__axiaStudioSwupBound = true;
		}
	};

	const updateNavbarTitleText = (nextTitle) => {
		const brandLink = document.querySelector('#navbar a[href="/"]');
		if (!brandLink) return;
		const walker = document.createTreeWalker(brandLink, NodeFilter.SHOW_TEXT);
		let node = walker.nextNode();
		while (node) {
			if (node.textContent && node.textContent.trim().length > 0) {
				node.textContent = ` ${nextTitle}`;
				return;
			}
			node = walker.nextNode();
		}
	};

	const applyPreviewPatch = (patch) => {
		if (!patch || typeof patch !== "object") return;

		if (typeof patch.themeHue === "number" && !Number.isNaN(patch.themeHue)) {
			document.documentElement.style.setProperty(
				"--hue",
				String(patch.themeHue),
			);
			const bannerOverlay = document.querySelector("#banner-overlay-container");
			if (bannerOverlay instanceof HTMLElement) {
				bannerOverlay.style.setProperty("--hue", String(patch.themeHue));
			}
		}

		if (patch.defaultMode === "dark" || patch.defaultMode === "light") {
			document.documentElement.classList.toggle(
				"dark",
				patch.defaultMode === "dark",
			);
		}

		if (typeof patch.pageWidth === "number" && patch.pageWidth >= 60) {
			document.documentElement.style.setProperty(
				"--page-width",
				`${patch.pageWidth}rem`,
			);
		}

		if (typeof patch.navbarTitle === "string") {
			updateNavbarTitleText(patch.navbarTitle);
		}

		if (patch.banner && typeof patch.banner === "object") {
			const b = patch.banner;
			if (typeof b.title === "string") {
				const el = document.querySelector(".banner-title");
				if (el && document.activeElement !== el) {
					el.textContent = b.title;
				}
			}
			if (Array.isArray(b.subtitles)) {
				const first = b.subtitles.map((s) => String(s).trim()).find(Boolean);
				const subEl = document.getElementById("banner-subtitle");
				if (subEl && first && document.activeElement !== subEl) {
					subEl.dataset.subtitles = JSON.stringify(b.subtitles);
					const tw = subEl.querySelector(".typewriter");
					if (tw && !inlineEditEnabled) {
						tw.textContent = first;
					} else {
						subEl.textContent = first;
					}
				}
			}
			if (typeof b.dimOpacity === "number") {
				const dim = document.getElementById("banner-dim-container");
				if (dim instanceof HTMLElement) {
					dim.style.opacity = String(b.dimOpacity);
				}
			}
			if (typeof b.position === "string" && b.position.trim()) {
				const imgs = document.querySelectorAll(
					"#wallpaper-wrapper img, #banner-images-container img",
				);
				for (const img of imgs) {
					if (img instanceof HTMLImageElement) {
						img.style.objectPosition = b.position;
					}
				}
			}
			if (typeof b.previewImageUrl === "string" && b.previewImageUrl.trim()) {
				const imgs = document.querySelectorAll(
					"#wallpaper-wrapper img, #banner-images-container img",
				);
				for (const img of imgs) {
					if (img instanceof HTMLImageElement) {
						if (img.parentElement?.tagName === "PICTURE") {
							for (const source of img.parentElement.querySelectorAll(
								"source",
							)) {
								source.removeAttribute("srcset");
							}
						}
						img.removeAttribute("srcset");
						img.src = b.previewImageUrl;
						img.style.opacity = "1";
					}
				}
			}
		}

		if (patch.announcement && typeof patch.announcement === "object") {
			const ann = document.getElementById("announcement");
			if (ann) {
				if (typeof patch.announcement.content === "string") {
					const contentEl = ann.querySelector(".leading-relaxed");
					if (contentEl && document.activeElement !== contentEl) {
						contentEl.textContent = patch.announcement.content;
					}
				}
				if (typeof patch.announcement.linkText === "string") {
					const linkEl = ann.querySelector("a.btn-regular");
					if (linkEl && document.activeElement !== linkEl) {
						linkEl.textContent = patch.announcement.linkText;
					}
				}
			}
		}

		if (patch.profile && typeof patch.profile === "object") {
			const aboutLink = document.querySelector(
				'a[aria-label="Go to About Page"]',
			);
			const card = aboutLink?.closest(".card-base");
			if (card) {
				const container = card.querySelector(".px-2");
				if (container) {
					const nameEl = container.children[0];
					const bioEl = container.children[2];
					if (
						nameEl &&
						typeof patch.profile.name === "string" &&
						document.activeElement !== nameEl
					) {
						nameEl.textContent = patch.profile.name;
					}
					if (
						bioEl &&
						typeof patch.profile.bio === "string" &&
						document.activeElement !== bioEl
					) {
						bioEl.textContent = patch.profile.bio;
					}
				}
			}
		}
	};

	const ensureInspectOverlay = () => {
		if (overlayBox) return;
		overlayBox = document.createElement("div");
		overlayBox.id = "axia-studio-inspect-box";
		overlayBox.style.cssText = [
			"position: fixed",
			"pointer-events: none",
			"z-index: 999999",
			"border: 2px solid #2563eb",
			"background: rgba(37, 99, 235, 0.10)",
			"border-radius: 10px",
			"transition: all 80ms ease-out",
			"display: none",
		].join(";");

		overlayLabel = document.createElement("span");
		overlayLabel.style.cssText = [
			"position: absolute",
			"top: -24px",
			"left: 0",
			"background: #2563eb",
			"color: #ffffff",
			"font: 600 11px/1 system-ui, sans-serif",
			"padding: 4px 8px",
			"border-radius: 6px",
			"white-space: nowrap",
			"box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25)",
		].join(";");
		overlayBox.appendChild(overlayLabel);
		document.body.appendChild(overlayBox);
	};

	const hideInspectOverlay = () => {
		if (overlayBox) {
			overlayBox.style.display = "none";
		}
		activeTarget = null;
		lastInspectMeta = null;
	};

	const resolveInspectTarget = (target) => {
		if (!(target instanceof Element)) return null;
		if (target.closest("#axia-studio-inspect-box")) return null;

		const ann = target.closest("#announcement");
		if (ann) {
			return {
				el: ann,
				label: "Announcement Widget",
				meta: { target: "design", section: "announcement" },
			};
		}

		const aboutAnchor = target
			.closest(".card-base")
			?.querySelector('a[aria-label="Go to About Page"]');
		if (aboutAnchor) {
			const card = aboutAnchor.closest(".card-base");
			return {
				el: card,
				label: "Profile Card",
				meta: { target: "design", section: "profile" },
			};
		}

		const schedule = target.closest(
			'section[aria-labelledby="upcoming-schedule-heading"]',
		);
		if (schedule) {
			return {
				el: schedule,
				label: "Upcoming Schedule Section",
				meta: { target: "layout", section: "homepage" },
			};
		}

		const navbar = target.closest("#navbar");
		if (navbar) {
			return {
				el: navbar,
				label: "Site Identity & Navbar",
				meta: { target: "design", section: "identity" },
			};
		}

		const leftSidebar =
			target.closest("#left-sidebar") ||
			target.closest("#left-sidebar-dynamic");
		if (leftSidebar) {
			return {
				el: leftSidebar,
				label: "Left Sidebar Widgets",
				meta: { target: "layout", section: "sidebar-left" },
			};
		}

		const rightSidebar =
			target.closest("#right-sidebar") ||
			target.closest("#right-sidebar-dynamic");
		if (rightSidebar) {
			return {
				el: rightSidebar,
				label: "Right Sidebar Widgets",
				meta: { target: "layout", section: "sidebar-right" },
			};
		}

		const banner =
			target.closest(".banner-home-text-overlay") ||
			target.closest("#wallpaper-wrapper") ||
			target.closest("#banner-images-container");
		if (banner) {
			return {
				el: banner,
				label: "Hero Banner & Wallpapers",
				meta: { target: "design", section: "banner" },
			};
		}

		const article = target.closest("article") || target.closest("main");
		if (article) {
			return {
				el: article,
				label: "Page / Entry Content",
				meta: {
					target: "content",
					pathname: window.location.pathname,
				},
			};
		}

		return null;
	};

	const onMouseMove = (event) => {
		if (!inspectEnabled) return;
		const hit = resolveInspectTarget(event.target);
		if (!hit || !(hit.el instanceof HTMLElement)) {
			hideInspectOverlay();
			return;
		}
		ensureInspectOverlay();
		activeTarget = hit.el;
		lastInspectMeta = hit.meta;
		const rect = hit.el.getBoundingClientRect();
		overlayBox.style.display = "block";
		overlayBox.style.left = `${Math.max(2, rect.left)}px`;
		overlayBox.style.top = `${Math.max(2, rect.top)}px`;
		overlayBox.style.width = `${Math.max(16, rect.width - 4)}px`;
		overlayBox.style.height = `${Math.max(16, rect.height - 4)}px`;
		const labelTop = rect.top < 28 ? 6 : -24;
		overlayLabel.style.top = `${labelTop}px`;
		overlayLabel.textContent = hit.label;
	};

	const onInspectClick = (event) => {
		if (!inspectEnabled) return;
		const hit =
			resolveInspectTarget(event.target) ||
			(activeTarget ? { meta: lastInspectMeta } : null);
		if (!hit?.meta) return;
		event.preventDefault();
		event.stopPropagation();
		postToStudio({
			type: "axia-studio:select",
			...hit.meta,
		});
	};

	// --- Inline Text Editing Mode ---
	const cleanEditableText = (el) => {
		if (!(el instanceof Element)) return "";
		const clone = el.cloneNode(true);
		if (clone instanceof Element) {
			for (const anc of clone.querySelectorAll(".anchor, .anchor-icon")) {
				anc.remove();
			}
			return (clone.textContent || "").replace(/\s+/g, " ").trim();
		}
		return (el.textContent || "").trim();
	};

	const ensureInlineUi = () => {
		if (!inlineStyleEl) {
			inlineStyleEl = document.createElement("style");
			inlineStyleEl.id = "axia-studio-inline-style";
			inlineStyleEl.textContent = `
				[data-studio-editable] {
					outline: 1.5px dashed rgba(59, 110, 246, 0.55);
					outline-offset: 3px;
					border-radius: 4px;
					cursor: text !important;
					transition: outline-color 120ms ease, background-color 120ms ease;
				}
				[data-studio-editable]:hover {
					outline-color: #2563eb;
					background-color: rgba(59, 110, 246, 0.06);
				}
				[data-studio-editable]:focus {
					outline: 2px solid #2563eb;
					outline-offset: 4px;
					background-color: rgba(59, 110, 246, 0.08);
				}
				[data-studio-editable] .anchor,
				[data-studio-editable] .anchor-icon {
					display: none !important;
				}
			`;
			document.head.appendChild(inlineStyleEl);
		}
		if (!inlinePillEl) {
			inlinePillEl = document.createElement("div");
			inlinePillEl.id = "axia-studio-inline-pill";
			inlinePillEl.textContent =
				"Inline Text Edit Active - click any highlighted text to edit";
			inlinePillEl.style.cssText = [
				"position: fixed",
				"bottom: 14px",
				"right: 14px",
				"z-index: 999998",
				"background: #1e293b",
				"color: #f8fafc",
				"font: 600 11.5px/1.2 system-ui, sans-serif",
				"padding: 7px 11px",
				"border-radius: 999px",
				"border: 1px solid #3b6ef6",
				"box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28)",
				"pointer-events: none",
			].join(";");
			document.body.appendChild(inlinePillEl);
		}
	};

	const removeInlineUi = () => {
		if (inlineStyleEl) {
			inlineStyleEl.remove();
			inlineStyleEl = null;
		}
		if (inlinePillEl) {
			inlinePillEl.remove();
			inlinePillEl = null;
		}
	};

	const emitInlineChange = (el) => {
		const metaRaw = el.dataset.studioEditableMeta;
		if (!metaRaw) return;
		let meta;
		try {
			meta = JSON.parse(metaRaw);
		} catch {
			return;
		}
		const newText = cleanEditableText(el);
		const oldText = el.dataset.studioOrigText ?? newText;
		if (newText === oldText) {
			return;
		}
		postToStudio({
			type: "axia-studio:inline-change",
			pathname: window.location.pathname,
			oldText,
			newText,
			...meta,
		});
		el.dataset.studioOrigText = newText;
	};

	const onEditableFocus = (event) => {
		const el = event.currentTarget;
		if (!(el instanceof HTMLElement)) return;
		el.dataset.studioOrigText = cleanEditableText(el);
	};

	const onEditableInput = (event) => {
		const el = event.currentTarget;
		if (!(el instanceof HTMLElement)) return;
		const existing = inlineTimers.get(el);
		if (existing) clearTimeout(existing);
		const delay = el.dataset.studioDebounce === "body" ? 220 : 40;
		const timer = setTimeout(() => emitInlineChange(el), delay);
		inlineTimers.set(el, timer);
	};

	const onEditableBlur = (event) => {
		const el = event.currentTarget;
		if (!(el instanceof HTMLElement)) return;
		const existing = inlineTimers.get(el);
		if (existing) {
			clearTimeout(existing);
			inlineTimers.delete(el);
		}
		emitInlineChange(el);
	};

	const bindEditable = (el, meta, debounceMode = "instant") => {
		if (!(el instanceof HTMLElement)) return;
		el.dataset.studioEditable = "true";
		el.dataset.studioEditableMeta = JSON.stringify(meta);
		el.dataset.studioDebounce = debounceMode;
		try {
			el.contentEditable = "plaintext-only";
		} catch {
			el.contentEditable = "true";
		}
		el.spellcheck = true;
		if (!el.dataset.studioListenersAttached) {
			el.addEventListener("focus", onEditableFocus);
			el.addEventListener("input", onEditableInput);
			el.addEventListener("blur", onEditableBlur);
			el.dataset.studioListenersAttached = "1";
		}
	};

	const clearInlineEditBindings = () => {
		for (const el of document.querySelectorAll("[data-studio-editable]")) {
			if (el instanceof HTMLElement) {
				el.removeAttribute("contenteditable");
				delete el.dataset.studioEditable;
				delete el.dataset.studioEditableMeta;
				delete el.dataset.studioOrigText;
			}
		}
		removeInlineUi();
	};

	const applyInlineEditMode = () => {
		if (!inlineEditEnabled) {
			clearInlineEditBindings();
			return;
		}

		ensureInlineUi();

		// 1. Site Settings editable targets
		const bannerTitle = document.querySelector(".banner-title");
		if (bannerTitle) {
			bindEditable(bannerTitle, {
				kind: "setting",
				key: "banner.title",
				label: "Hero Title",
			});
		}

		const bannerSub = document.getElementById("banner-subtitle");
		if (bannerSub && !bannerSub.querySelector(".typewriter")) {
			bindEditable(bannerSub, {
				kind: "setting",
				key: "banner.subtitles.0",
				label: "Hero Subtitle",
			});
		}

		const ann = document.getElementById("announcement");
		if (ann) {
			const annText = ann.querySelector(".leading-relaxed");
			if (annText) {
				bindEditable(annText, {
					kind: "setting",
					key: "announcement.content",
					label: "Announcement",
				});
			}
			const annBtn = ann.querySelector("a.btn-regular");
			if (annBtn) {
				bindEditable(annBtn, {
					kind: "setting",
					key: "announcement.linkText",
					label: "Announcement Button",
				});
			}
		}

		const aboutAnchor = document.querySelector(
			'a[aria-label="Go to About Page"]',
		);
		const profileCard = aboutAnchor?.closest(".card-base");
		if (profileCard) {
			const container = profileCard.querySelector(".px-2");
			if (container) {
				if (container.children[0]) {
					bindEditable(container.children[0], {
						kind: "setting",
						key: "profile.name",
						label: "Profile Name",
					});
				}
				if (container.children[2]) {
					bindEditable(container.children[2], {
						kind: "setting",
						key: "profile.bio",
						label: "Profile Bio",
					});
				}
			}
		}

		// 2. Detail Page Header Fields
		const pathname = window.location.pathname;
		const isDetailEntry =
			pathname.startsWith("/posts/") ||
			pathname.startsWith("/events/") ||
			pathname.startsWith("/wiki/") ||
			pathname.startsWith("/projects/") ||
			pathname === "/about/" ||
			pathname === "/friends/" ||
			pathname === "/guestbook/";

		if (isDetailEntry) {
			const entryTitleEl = document.querySelector(
				'[data-pagefind-meta="title"]',
			);
			if (entryTitleEl) {
				bindEditable(entryTitleEl, {
					kind: "entry-field",
					field: "titleOrName",
					label: "Entry Title",
				});
			}

			const summaryEl = document.querySelector(
				"article header p.leading-relaxed, main header p.leading-relaxed",
			);
			if (summaryEl) {
				bindEditable(summaryEl, {
					kind: "entry-field",
					field: "summaryOrBio",
					label: "Summary / Bio",
				});
			}

			if (pathname.startsWith("/wiki/performers/")) {
				for (const p of document.querySelectorAll("article header p")) {
					if (!p.classList.contains("leading-relaxed")) {
						bindEditable(p, {
							kind: "entry-field",
							field: "role",
							label: "Performer Role",
						});
						break;
					}
				}
			}

			// 3. Rendered Markdown Body Blocks
			const mdRoots = document.querySelectorAll(
				".markdown-content, .custom-md",
			);
			for (const root of mdRoots) {
				const blocks = root.querySelectorAll("h2, h3, h4, p, li");
				for (const block of blocks) {
					if (!(block instanceof HTMLElement)) continue;
					if (
						block.closest("pre") ||
						block.closest("code") ||
						block.closest(".katex") ||
						block.closest(".mermaid") ||
						block.closest(".card-wiki-link") ||
						block.closest("[data-pagefind-ignore]") ||
						block.closest(".not-prose") ||
						block.closest("[data-tabs]") ||
						block.querySelector("button, input, textarea, select, pre, table")
					) {
						continue;
					}
					if (block.tagName === "LI" && block.querySelector("p")) {
						continue;
					}
					if (block.closest("[data-studio-editable]")) {
						continue;
					}
					bindEditable(
						block,
						{
							kind: "entry-body-replace",
							label: "Body Block",
						},
						"body",
					);
				}
			}
		}
	};

	const onInlineClickCapture = (event) => {
		if (!inlineEditEnabled) return;
		const target = event.target;
		if (!(target instanceof Element)) return;
		const editable = target.closest("[data-studio-editable]");
		if (editable) {
			const link = target.closest("a");
			if (link) {
				event.preventDefault();
			}
		}
	};

	window.addEventListener("message", (event) => {
		if (event.origin !== window.location.origin) return;
		const msg = event.data;
		if (!msg || typeof msg !== "object") return;
		if (msg.type === "axia-studio:preview") {
			applyPreviewPatch(msg.payload);
		} else if (msg.type === "axia-studio:inspect") {
			inspectEnabled = Boolean(msg.enabled);
			if (inspectEnabled && inlineEditEnabled) {
				inlineEditEnabled = false;
				clearInlineEditBindings();
			}
			document.documentElement.style.cursor = inspectEnabled ? "crosshair" : "";
			if (!inspectEnabled) {
				hideInspectOverlay();
			}
		} else if (msg.type === "axia-studio:inline-edit") {
			inlineEditEnabled = Boolean(msg.enabled);
			if (inlineEditEnabled && inspectEnabled) {
				inspectEnabled = false;
				document.documentElement.style.cursor = "";
				hideInspectOverlay();
			}
			applyInlineEditMode();
		} else if (msg.type === "axia-studio:ping") {
			notifyRoute();
		}
	});

	document.addEventListener("mousemove", onMouseMove, true);
	document.addEventListener("click", onInspectClick, true);
	document.addEventListener("click", onInlineClickCapture, true);
	document.addEventListener("astro:page-load", notifyRoute);
	document.addEventListener("swup:enable", bindSwupRouteHook);

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			bindSwupRouteHook();
			notifyRoute();
		});
	} else {
		bindSwupRouteHook();
		notifyRoute();
	}
})();
