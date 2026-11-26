(() => {
	const cms = window.CMS;
	if (!cms) {
		return;
	}

	const SITE_BASE = "https://axia.zone.id";

	const escapeHtml = (value) =>
		String(value ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");

	cms.registerPreviewStyle("./wp-preview.css");
	cms.registerPreviewStyle(
		"https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css",
	);

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
		pattern:
			/^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\r?\n((?:>.*(?:\r?\n|$))+)/,
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

	/* ================= Firefly Markdown/MDX/KaTeX/Mermaid Engine ================= */
	const formatSlugLabel = (slug) => {
		const clean = String(slug || "")
			.replace(/^.*\//, "")
			.replace(/\.(md|mdx)$/i, "")
			.trim();
		if (!clean) return "Untitled";
		return clean
			.split("-")
			.map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
			.join(" ");
	};

	const parseAttr = (attrs, name) => {
		const m = String(attrs || "").match(
			new RegExp(`${name}=["']([^"']*)["']`),
		);
		return m ? m[1] : "";
	};

	const dedentBlock = (text) => {
		const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
		while (lines.length && !lines[0].trim()) lines.shift();
		while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
		const indents = lines
			.filter((l) => l.trim().length > 0)
			.map((l) => l.match(/^[ \t]*/)[0].length);
		const minIndent = indents.length ? Math.min(...indents) : 0;
		return lines.map((l) => l.slice(minIndent)).join("\n");
	};

	const resolveAssetUrl = (getAsset, path) => {
		if (!path) return "";
		try {
			const resolved = getAsset ? getAsset(path) : null;
			if (resolved && typeof resolved.toString === "function") {
				return resolved.toString();
			}
		} catch {
			// Fallback below
		}
		if (String(path).startsWith("/")) {
			return String(path);
		}
		return String(path);
	};

	const parseMarkdownSimple = (md) => {
		if (window.marked && typeof window.marked.parse === "function") {
			return window.marked.parse(md, { gfm: true, breaks: false });
		}
		return md
			.split(/\n{2,}/)
			.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
			.join("\n");
	};

	const renderInlineTransforms = (text) => {
		let out = text;

		// Inline KaTeX math ($...$) skipping escaped \$ and currency like $100
		if (window.katex && typeof window.katex.renderToString === "function") {
			out = out.replace(
				/(?<!\\)\$(?!\s)([^\n$]+?)(?<!\s|\d)\$/g,
				(full, expr) => {
					try {
						return window.katex.renderToString(expr.trim(), {
							displayMode: false,
							throwOnError: false,
						});
					} catch {
						return full;
					}
				},
			);
		}

		// Inline MDX <Badge type="...">...</Badge>
		out = out.replace(
			/<Badge(?:\s+type=["']([^"']+)["'])?\s*>([\s\S]*?)<\/Badge>/gi,
			(_m, type, label) => {
				const kind = (type || "default").toLowerCase();
				return `<span class="axia-mdx-badge axia-mdx-badge-${escapeHtml(kind)}">${escapeHtml(String(label || "").trim())}</span>`;
			},
		);

		// Spoiler :spoiler[...]
		out = out.replace(
			/:spoiler\[([^\]]+)\]/g,
			(_m, txt) =>
				`<span class="axia-spoiler" tabindex="0" title="Click or hover to reveal">${escapeHtml(txt)}</span>`,
		);

		// Inline [[Wiki Links]] (excluding standalone lines already handled)
		out = out.replace(
			/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g,
			(_m, target, label) => {
				const cleanTarget = String(target || "").trim();
				const display = label
					? String(label).trim()
					: formatSlugLabel(cleanTarget);
				return `<span class="axia-wiki-inline">${escapeHtml(display)}</span>`;
			},
		);

		return out;
	};

	const renderFireflyMarkdown = (rawBody, getAsset) => {
		const placeholders = [];
		const pushPlaceholder = (html) => {
			const token = `@@AXIA_BLOCK_${placeholders.length}@@`;
			placeholders.push(html);
			return `\n\n${token}\n\n`;
		};

		let text = String(rawBody || "").replace(/\r\n/g, "\n");

		// 1. Extract fenced code blocks (including indented MDX blocks inside TabGroup)
		text = text.replace(
			/^[ \t]*```([a-zA-Z0-9_-]*)([^\n]*)\n([\s\S]*?)^[ \t]*```[ \t]*$/gm,
			(_m, lang, meta, code) => {
				const cleanLang = (lang || "").toLowerCase();
				const cleanCode = dedentBlock(code);
				if (cleanLang === "mermaid") {
					return pushPlaceholder(
						`<div class="axia-mermaid-box" data-mermaid="${encodeURIComponent(cleanCode)}"><pre>${escapeHtml(cleanCode)}</pre></div>`,
					);
				}
				const title = parseAttr(meta, "title") || cleanLang.toUpperCase();
				const header = title
					? `<div class="axia-code-header"><span>${escapeHtml(title)}</span></div>`
					: "";
				return pushPlaceholder(
					`<div class="axia-code-frame">${header}<pre><code>${escapeHtml(cleanCode)}</code></pre></div>`,
				);
			},
		);

		// 2. Strip top-level ESM import lines (outside fenced code blocks)
		text = text.replace(
			/^\s*import\s+[\s\S]*?\s+from\s+["'][^"']+["'];?\s*$/gm,
			"",
		);

		// 3. Block KaTeX $$...$$
		if (window.katex && typeof window.katex.renderToString === "function") {
			text = text.replace(/\$\$\n?([\s\S]*?)\n?\$\$/g, (_m, expr) => {
				try {
					const rendered = window.katex.renderToString(expr.trim(), {
						displayMode: true,
						throwOnError: false,
					});
					return pushPlaceholder(
						`<div class="axia-katex-block">${rendered}</div>`,
					);
				} catch {
					return pushPlaceholder(
						`<pre><code>${escapeHtml(expr.trim())}</code></pre>`,
					);
				}
			});
		}

		// 4. MDX <TabGroup labels={[...]}>...</TabGroup>
		text = text.replace(
			/<TabGroup\s+labels=\{\[([^\]]+)\]\}\s*[^>]*>([\s\S]*?)<\/TabGroup>/gi,
			(_m, labelsRaw, inner) => {
				const labels = [];
				const lblRegex = /["']([^"']+)["']/g;
				let lm = lblRegex.exec(labelsRaw);
				while (lm) {
					labels.push(lm[1]);
					lm = lblRegex.exec(labelsRaw);
				}
				const chunks = inner
					.trim()
					.split(/(?=@@AXIA_BLOCK_\d+@@)/)
					.map((c) => c.trim())
					.filter(Boolean);
				const panelsHtml = labels
					.map((label, idx) => {
						const rawChunk = chunks[idx] ?? chunks[chunks.length - 1] ?? "";
						const compiledChunk = parseMarkdownSimple(
							renderInlineTransforms(rawChunk),
						);
						return `<div class="axia-tab-panel${idx === 0 ? " is-active" : ""}" data-tab-index="${idx}">${compiledChunk}</div>`;
					})
					.join("");
				const btnsHtml = labels
					.map(
						(label, idx) =>
							`<button type="button" class="axia-tab-btn" role="tab" aria-selected="${idx === 0 ? "true" : "false"}" data-tab-index="${idx}">${escapeHtml(label)}</button>`,
					)
					.join("");
				return pushPlaceholder(
					`<div class="axia-tabs"><div class="axia-tabs-header" role="tablist">${btnsHtml}</div>${panelsHtml}</div>`,
				);
			},
		);

		// 5. MDX <Steps>...</Steps>
		text = text.replace(/<Steps[^>]*>([\s\S]*?)<\/Steps>/gi, (_m, inner) => {
			let stepIndex = 0;
			const items = [];
			const itemRegex = /<StepItem([^>]*)>([\s\S]*?)<\/StepItem>/gi;
			let sm = itemRegex.exec(inner);
			while (sm) {
				stepIndex += 1;
				const title = parseAttr(sm[1], "title") || `Step ${stepIndex}`;
				const bodyMd = dedentBlock(sm[2]);
				const bodyHtml = parseMarkdownSimple(renderInlineTransforms(bodyMd));
				items.push(
					`<div class="axia-step-item"><span class="axia-step-num">${stepIndex}</span><div class="axia-step-title">${escapeHtml(title)}</div><div>${bodyHtml}</div></div>`,
				);
				sm = itemRegex.exec(inner);
			}
			return pushPlaceholder(`<div class="axia-steps">${items.join("")}</div>`);
		});

		// 6. MDX <Timeline>...</Timeline>
		text = text.replace(
			/<Timeline[^>]*>([\s\S]*?)<\/Timeline>/gi,
			(_m, inner) => {
				const items = [];
				const itemRegex = /<TimelineItem([^>]*)>([\s\S]*?)<\/TimelineItem>/gi;
				let tm = itemRegex.exec(inner);
				while (tm) {
					const date = parseAttr(tm[1], "date");
					const title = parseAttr(tm[1], "title") || "Milestone";
					const bodyMd = dedentBlock(tm[2]);
					const bodyHtml = parseMarkdownSimple(renderInlineTransforms(bodyMd));
					items.push(
						`<div class="axia-timeline-item">${date ? `<span class="axia-timeline-date">${escapeHtml(date)}</span>` : ""}<div class="axia-timeline-title">${escapeHtml(title)}</div><div>${bodyHtml}</div></div>`,
					);
					tm = itemRegex.exec(inner);
				}
				return pushPlaceholder(
					`<div class="axia-timeline">${items.join("")}</div>`,
				);
			},
		);

		// 7. Firefly [grid]...[/grid]
		text = text.replace(/\[grid\]\n([\s\S]*?)\n\[\/grid\]/g, (_m, inner) => {
			const imgs = [];
			const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
			let im = imgRegex.exec(inner);
			while (im) {
				const resolvedSrc = resolveAssetUrl(getAsset, im[2]);
				imgs.push(
					`<img src="${escapeHtml(resolvedSrc)}" alt="${escapeHtml(im[1] || "")}" loading="lazy" />`,
				);
				im = imgRegex.exec(inner);
			}
			return pushPlaceholder(
				`<div class="axia-img-grid">${imgs.join("")}</div>`,
			);
		});

		// 8. Firefly ::github{repo="owner/repo"}
		text = text.replace(
			/^::github\{repo=["']([^"']+)["']\}\s*$/gm,
			(_m, repo) =>
				pushPlaceholder(
					`<div class="axia-gh-card"><div><div class="axia-gh-repo">${escapeHtml(repo)}</div><div class="axia-gh-sub">GitHub Repository Card</div></div><span class="axia-badge axia-badge-tag">GitHub</span></div>`,
				),
		);

		// 9. Standalone Obsidian [[Wiki Link]] Card lines
		text = text.replace(
			/^\s*\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]\s*$/gm,
			(_m, target, label) => {
				const cleanTarget = String(target || "").trim();
				const parts = cleanTarget.split("/");
				const col =
					parts.length > 1 ? parts[0].toUpperCase() : "WIKI LINK";
				const title = label
					? String(label).trim()
					: formatSlugLabel(cleanTarget);
				return pushPlaceholder(
					`<div class="axia-wiki-card"><div><div class="axia-wiki-card-title">${escapeHtml(title)}</div><div class="axia-wiki-card-meta">${escapeHtml(cleanTarget)}</div></div><span class="axia-badge axia-badge-tag">${escapeHtml(col)}</span></div>`,
				);
			},
		);

		// 10. GitHub Callouts (> [!TYPE]\n> ...)
		text = text.replace(
			/^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n((?:>.*(?:\n|$))+)/gm,
			(_m, type, bodyLines) => {
				const kind = String(type || "NOTE").toLowerCase();
				const stripped = bodyLines
					.split("\n")
					.filter((l) => l.startsWith(">"))
					.map((l) => l.replace(/^>\s?/, ""))
					.join("\n");
				const bodyHtml = parseMarkdownSimple(renderInlineTransforms(stripped));
				return pushPlaceholder(
					`<div class="axia-callout axia-callout-${escapeHtml(kind)}"><div class="axia-callout-title">${escapeHtml(type)}</div><div class="axia-callout-body">${bodyHtml}</div></div>`,
				);
			},
		);

		// 11. Parse remaining Markdown + inline transforms
		let html = parseMarkdownSimple(renderInlineTransforms(text));

		// 12. Restore placeholders recursively (TabGroup/Steps may wrap fenced blocks)
		for (let pass = 0; pass < 3; pass += 1) {
			html = html.replace(
				/(?:<p>\s*)?@@AXIA_BLOCK_(\d+)@@(?:\s*<\/p>)?/g,
				(_m, idxStr) => placeholders[Number(idxStr)] || "",
			);
		}

		// 13. Sanitize final HTML safely
		if (window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
			html = window.DOMPurify.sanitize(html, {
				ADD_TAGS: [
					"math",
					"semantics",
					"mrow",
					"mi",
					"mo",
					"mn",
					"msup",
					"msub",
					"mfrac",
					"msqrt",
					"mroot",
					"mtable",
					"mtr",
					"mtd",
					"mtext",
					"annotation",
					"button",
				],
				ADD_ATTR: [
					"data-mermaid",
					"data-tab-index",
					"role",
					"tabindex",
					"aria-selected",
					"xmlns",
					"encoding",
					"aria-hidden",
					"style",
				],
			});
		}

		return html;
	};

	/* ================= Firefly Live Preview React Templates ================= */
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

		const getEntrySlug = (entry) => {
			if (!entry) return "";
			const slug =
				typeof entry.get === "function" ? entry.get("slug") : entry.slug;
			return String(slug || "")
				.replace(/\.(md|mdx)$/i, "")
				.trim();
		};

		const asArray = (val) => {
			const plain = toPlain(val);
			return Array.isArray(plain) ? plain : [];
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
			if (
				!e ||
				s.toISOString().slice(0, 10) === e.toISOString().slice(0, 10)
			) {
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
				return {
					handle: raw
						.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@")
						.replace(/\/$/, ""),
					url: raw,
				};
			}
			const handle = raw.startsWith("@") ? raw : `@${raw}`;
			return {
				handle,
				url: `https://instagram.com/${handle.slice(1)}`,
			};
		};

		let mermaidRenderCounter = 0;
		const PreviewThemeContext = React.createContext("dark");

		const FireflyProse = ({ body, getAsset, fallbackWidget }) => {
			const theme = React.useContext(PreviewThemeContext);
			const containerRef = React.useRef(null);
			const hasStringBody = typeof body === "string" && body.trim().length > 0;
			const html = React.useMemo(
				() => (hasStringBody ? renderFireflyMarkdown(body, getAsset) : ""),
				[body, hasStringBody, getAsset],
			);

			React.useEffect(() => {
				const root = containerRef.current;
				if (!root || !hasStringBody) return;

				const onClick = (ev) => {
					const tabBtn = ev.target?.closest?.(".axia-tab-btn");
					if (tabBtn && root.contains(tabBtn)) {
						const tabGroup = tabBtn.closest(".axia-tabs");
						const targetIdx = tabBtn.getAttribute("data-tab-index");
						if (tabGroup) {
							tabGroup.querySelectorAll(".axia-tab-btn").forEach((btn) => {
								btn.setAttribute(
									"aria-selected",
									btn.getAttribute("data-tab-index") === targetIdx
										? "true"
										: "false",
								);
							});
							tabGroup.querySelectorAll(".axia-tab-panel").forEach((panel) => {
								if (panel.getAttribute("data-tab-index") === targetIdx) {
									panel.classList.add("is-active");
								} else {
									panel.classList.remove("is-active");
								}
							});
						}
						return;
					}

					const spoiler = ev.target?.closest?.(".axia-spoiler");
					if (spoiler && root.contains(spoiler)) {
						spoiler.classList.toggle("is-revealed");
					}
				};

				root.addEventListener("click", onClick);

				let cancelled = false;
				const mermaidNodes = root.querySelectorAll(".axia-mermaid-box");
				if (
					mermaidNodes.length > 0 &&
					window.mermaid &&
					typeof window.mermaid.render === "function"
				) {
					try {
						window.mermaid.initialize({
							startOnLoad: false,
							securityLevel: "strict",
							theme: theme === "dark" ? "dark" : "default",
						});
					} catch {
						// Ignore re-init warnings
					}

					mermaidNodes.forEach(async (box) => {
						const encoded = box.getAttribute("data-mermaid");
						if (!encoded) return;
						const code = decodeURIComponent(encoded);
						mermaidRenderCounter += 1;
						const renderId = `axia-mmd-${mermaidRenderCounter}`;
						try {
							const res = await window.mermaid.render(renderId, code);
							if (!cancelled && res && res.svg) {
								box.innerHTML = res.svg;
							}
						} catch {
							// Keep <pre> code fallback if diagram has partial typing errors
						}
					});
				}

				return () => {
					cancelled = true;
					root.removeEventListener("click", onClick);
				};
			}, [html, theme, hasStringBody]);

			if (!hasStringBody) {
				return h("div", { className: "axia-prose" }, fallbackWidget);
			}

			return h("div", {
				ref: containerRef,
				className: "axia-prose",
				dangerouslySetInnerHTML: { __html: html },
			});
		};

		const PreviewLayout = ({
			routeLabel,
			liveUrl,
			iframeDoc,
			hue,
			children,
		}) => {
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
			const [mode, setMode] = React.useState("draft");
			const [showChrome, setShowChrome] = React.useState(true);
			const [frameKey, setFrameKey] = React.useState(0);
			const activeHue = Number.isFinite(Number(hue)) ? Number(hue) : 165;

			React.useEffect(() => {
				if (iframeDoc?.documentElement) {
					iframeDoc.documentElement.dataset.previewTheme = theme;
					iframeDoc.documentElement.style.setProperty(
						"--hue",
						String(activeHue),
					);
				}
			}, [theme, iframeDoc, activeHue]);

			const cacheBustUrl = liveUrl
				? `${liveUrl}${liveUrl.includes("?") ? "&" : "?"}preview_ts=${frameKey}`
				: "";

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
							"div",
							{ className: "axia-topbar-controls" },
							h(
								"div",
								{
									className: "axia-mode-tabs",
									role: "tablist",
									"aria-label": "Preview Mode",
								},
								h(
									"button",
									{
										type: "button",
										role: "tab",
										className: "axia-mode-tab",
										"aria-selected": mode === "draft" ? "true" : "false",
										onClick: () => setMode("draft"),
									},
									"Live Draft",
								),
								h(
									"button",
									{
										type: "button",
										role: "tab",
										className: "axia-mode-tab",
										"aria-selected": mode === "published" ? "true" : "false",
										onClick: () => setMode("published"),
									},
									"Published Site (1:1)",
								),
							),
							mode === "draft"
								? h(
										"button",
										{
											type: "button",
											className: "axia-theme-toggle",
											onClick: () => setShowChrome((prev) => !prev),
										},
										showChrome ? "Chrome: On" : "Chrome: Off",
									)
								: null,
							mode === "draft"
								? h(
										"button",
										{
											type: "button",
											className: "axia-theme-toggle",
											onClick: () =>
												setTheme((prev) => (prev === "dark" ? "light" : "dark")),
										},
										theme === "dark" ? "Dark" : "Light",
									)
								: null,
						),
					),
					mode === "published"
						? h(
								"div",
								{ className: "axia-live-frame-wrap" },
								liveUrl
									? [
											h(
												"div",
												{ key: "bar", className: "axia-live-frame-bar" },
												h(
													"div",
													null,
													h("strong", null, "Built Page: "),
													h("span", { className: "axia-live-url" }, liveUrl),
												),
												h(
													"div",
													{ className: "axia-topbar-controls" },
													h(
														"button",
														{
															type: "button",
															className: "axia-theme-toggle",
															onClick: () => setFrameKey((k) => k + 1),
														},
														"Reload",
													),
													h(
														"a",
														{
															href: liveUrl,
															target: "_blank",
															rel: "noopener noreferrer",
															className: "axia-theme-toggle",
														},
														"Open Live Page",
													),
												),
											),
											h("iframe", {
												key: `frame-${frameKey}`,
												src: cacheBustUrl,
												title: `Published preview for ${routeLabel || "Axia Zone ID"}`,
												className: "axia-live-iframe",
											}),
										]
									: h(
											"div",
											{ className: "axia-card" },
											h(
												"div",
												{ className: "axia-cover-note" },
												"This entry does not have a published URL yet (new unsaved draft). Save and wait ~1 minute for GitHub Actions to deploy, or use the Live Draft tab while writing.",
											),
										),
							)
						: [
								showChrome
									? h(
											"div",
											{ key: "banner", className: "axia-site-banner" },
											h(
												"div",
												null,
												h(
													"div",
													{ className: "axia-site-banner-title" },
													"Axia Zone ID",
												),
												h(
													"p",
													{ className: "axia-site-banner-sub" },
													"Indonesian ACG Blog, Event Calendar & Performer Wiki",
												),
											),
											h(
												"div",
												{ className: "axia-site-nav-pills" },
												h("span", { className: "axia-site-nav-pill" }, "Blog"),
												h("span", { className: "axia-site-nav-pill" }, "Events"),
												h(
													"span",
													{ className: "axia-site-nav-pill" },
													"Performers",
												),
												h("span", { className: "axia-site-nav-pill" }, "About"),
											),
										)
									: null,
								h(
									"div",
									{
										key: "grid",
										className: `axia-site-grid${showChrome ? " with-sidebar" : ""}`,
									},
									showChrome
										? h(
												"aside",
												{ className: "axia-site-sidebar" },
												h("div", { className: "axia-sidebar-avatar" }, "AZ"),
												h(
													"div",
													{ className: "axia-sidebar-name" },
													"Axia Zone ID",
												),
												h(
													"p",
													{ className: "axia-sidebar-bio" },
													"Indonesian ACG blog, event calendar, and performer wiki.",
												),
												h(
													"div",
													{ className: "axia-sidebar-links" },
													h(
														"span",
														{ className: "axia-badge axia-badge-tag" },
														"Events",
													),
													h(
														"span",
														{ className: "axia-badge axia-badge-tag" },
														"Wiki",
													),
													h(
														"span",
														{ className: "axia-badge axia-badge-tag" },
														"RSS",
													),
												),
											)
										: null,
									h(
										PreviewThemeContext.Provider,
										{ value: theme },
										children,
									),
								),
							],
				),
			);
		};

		const EventsPreview = ({
			entry,
			widgetFor,
			getAsset,
			document: iframeDoc,
		}) => {
			const d = getEntryData(entry);
			const slug = getEntrySlug(entry);
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
			const coverUrl = resolveAssetUrl(getAsset, d.image);

			return h(
				PreviewLayout,
				{
					routeLabel: slug ? `/wiki/events/${slug}/` : "/wiki/events/draft/",
					liveUrl: slug ? `${SITE_BASE}/wiki/events/${slug}/` : "",
					iframeDoc,
				},
				h(
					"article",
					{ className: "axia-card" },
					h(
						"div",
						{ className: "axia-breadcrumb" },
						h(
							"span",
							{ className: "axia-breadcrumb-link" },
							"All Events & Calendar",
						),
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
								? h(
										"span",
										{ className: "axia-badge axia-badge-draft" },
										"Draft",
									)
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
								? h(
										"span",
										{ className: "axia-badge axia-badge-type" },
										d.eventType,
									)
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
									h(
										"div",
										{ className: "axia-section-title" },
										"Event Highlights",
									),
									h(
										"div",
										{ className: "axia-badges" },
										highlights.map((item, idx) =>
											h(
												"span",
												{
													key: idx,
													className: "axia-badge axia-badge-highlight",
												},
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
								? h(
										"span",
										{ className: "axia-btn axia-btn-primary" },
										"Get Tickets",
									)
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
									lineup.map((itemSlug, idx) =>
										h(
											"li",
											{ key: idx, className: "axia-lineup-card" },
											h(
												"div",
												{ className: "axia-lineup-avatar" },
												getInitials(String(itemSlug).replace(/-/g, " ")),
											),
											h(
												"div",
												null,
												h(
													"div",
													{ className: "axia-lineup-slug" },
													String(itemSlug),
												),
												h(
													"div",
													{ className: "axia-lineup-sub" },
													"Performer Wiki link",
												),
											),
										),
									),
								)
							: h("p", { className: "axia-lead" }, "Lineup to be announced."),
					),
					h(FireflyProse, {
						body: d.body,
						getAsset,
						fallbackWidget: widgetFor("body"),
					}),
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
			const slug = getEntrySlug(entry);
			const avatarUrl = resolveAssetUrl(getAsset, d.avatar);
			const tags = asArray(d.tags);
			const socials = asArray(d.socials);

			return h(
				PreviewLayout,
				{
					routeLabel: slug
						? `/wiki/performers/${slug}/`
						: "/wiki/performers/draft/",
					liveUrl: slug ? `${SITE_BASE}/wiki/performers/${slug}/` : "",
					iframeDoc,
				},
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
					h(FireflyProse, {
						body: d.body,
						getAsset,
						fallbackWidget: widgetFor("body"),
					}),
					h(
						"div",
						{ className: "axia-cover-note" },
						"Event Appearances (Upcoming & Past) are automatically linked on build from Events that list this performer in their lineup.",
					),
				),
			);
		};

		const PostsPreview = ({
			entry,
			widgetFor,
			getAsset,
			document: iframeDoc,
		}) => {
			const d = getEntryData(entry);
			const slug = getEntrySlug(entry);
			const coverUrl = resolveAssetUrl(getAsset, d.image);
			const tags = asArray(d.tags);

			return h(
				PreviewLayout,
				{
					routeLabel: slug ? `/posts/${slug}/` : "/posts/draft/",
					liveUrl: slug ? `${SITE_BASE}/posts/${slug}/` : "",
					iframeDoc,
				},
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
								? h(
										"span",
										{ className: "axia-badge axia-badge-draft" },
										"Draft",
									)
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
					h(FireflyProse, {
						body: d.body,
						getAsset,
						fallbackWidget: widgetFor("body"),
					}),
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
			getAsset,
			document: iframeDoc,
		}) => {
			const d = getEntryData(entry);
			return h(
				PreviewLayout,
				{
					routeLabel,
					liveUrl: `${SITE_BASE}${routeLabel}`,
					iframeDoc,
				},
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
					h(FireflyProse, {
						body: d.body,
						getAsset,
						fallbackWidget: widgetFor("body"),
					}),
				),
			);
		};

		const MomentsPreview = ({
			entry,
			widgetFor,
			getAsset,
			document: iframeDoc,
		}) => {
			const d = getEntryData(entry);
			return h(
				PreviewLayout,
				{
					routeLabel: "/dynamic/",
					liveUrl: `${SITE_BASE}/dynamic/`,
					iframeDoc,
				},
				h(
					"article",
					{ className: "axia-card" },
					h(
						"div",
						{ className: "axia-meta-row" },
						h("strong", null, "Axia Zone ID"),
						d.published ? h("span", null, formatSingleDate(d.published)) : null,
						d.location
							? h("span", { className: "axia-badge axia-badge-type" }, d.location)
							: null,
						d.pinned
							? h("span", { className: "axia-badge axia-badge-tag" }, "Pinned")
							: null,
					),
					h(FireflyProse, {
						body: d.body,
						getAsset,
						fallbackWidget: widgetFor("body"),
					}),
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
			const slug = getEntrySlug(entry);
			const coverUrl = resolveAssetUrl(getAsset, d.image);
			const tags = asArray(d.tags);
			const links = asArray(d.link);

			return h(
				PreviewLayout,
				{
					routeLabel: slug ? `/projects/${slug}/` : "/projects/",
					liveUrl: slug ? `${SITE_BASE}/projects/${slug}/` : `${SITE_BASE}/projects/`,
					iframeDoc,
				},
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
							h(
								"h1",
								{ className: "axia-title" },
								d.title || "Untitled Project",
							),
							d.status
								? h("span", { className: "axia-badge axia-badge-tag" }, d.status)
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
					h(FireflyProse, {
						body: d.body,
						getAsset,
						fallbackWidget: widgetFor("body"),
					}),
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
				{
					routeLabel: "/ (Site Settings)",
					liveUrl: `${SITE_BASE}/`,
					iframeDoc,
					hue,
				},
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
		cms.registerPreviewTemplate(
			"about",
			PagePreview("/about/", "About Axia Zone ID"),
		);
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
