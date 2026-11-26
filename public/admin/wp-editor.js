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
		toBlock: (data) => `\`\`\`mermaid\n${data.code || "flowchart LR\n  A --> B"}\n\`\`\``,
		toPreview: (data) =>
			`<div class="wp-preview-block"><div class="wp-preview-badge">Mermaid Diagram</div><pre>${escapeHtml(data.code || "")}</pre></div>`,
	});

	cms.init();
})();
