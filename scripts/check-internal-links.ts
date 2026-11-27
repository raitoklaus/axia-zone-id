import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const DIST_DIR = path.resolve("dist");
const STRIP_BLOCKS = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const ATTR_PATTERN = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

function collectHtmlFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectHtmlFiles(fullPath));
		} else if (entry.isFile() && entry.name.endsWith(".html")) {
			files.push(fullPath);
		}
	}
	return files;
}

function shouldSkipReference(rawRef: string): boolean {
	const value = rawRef.trim();
	if (!value || value.startsWith("#") || value.startsWith("//")) {
		return true;
	}
	if (/^(?:https?:|mailto:|tel:|javascript:|data:|blob:|sms:)/i.test(value)) {
		return true;
	}
	return value.includes("${") || value.includes("{{");
}

function decodePathSafe(pathname: string): string {
	return pathname
		.split("/")
		.map((segment) => {
			try {
				return decodeURIComponent(segment);
			} catch {
				return segment;
			}
		})
		.join("/");
}

function resolveDistTarget(
	sourceHtml: string,
	rawRef: string,
): { resolvedPath: string; skipped: boolean } {
	const clean = rawRef.trim().replaceAll("&amp;", "&");
	const [withoutHash] = clean.split("#");
	const [rawPath] = (withoutHash ?? "").split("?");
	const decoded = decodePathSafe(rawPath ?? "");

	if (!decoded) {
		return { resolvedPath: "", skipped: true };
	}

	const normalizedPosix = decoded.startsWith("/")
		? path.posix.normalize(decoded)
		: path.posix.normalize(
				path.posix.join(
					`/${path.relative(DIST_DIR, path.dirname(sourceHtml)).replaceAll("\\", "/")}`,
					decoded,
				),
			);

	if (normalizedPosix === "/admin" || normalizedPosix.startsWith("/admin/")) {
		return { resolvedPath: normalizedPosix, skipped: true };
	}

	return { resolvedPath: normalizedPosix, skipped: false };
}

function targetExistsInDist(normalizedPosix: string): boolean {
	const relPath = normalizedPosix.replace(/^\/+|\/+$/g, "");
	if (relPath === "404") {
		return (
			existsSync(path.join(DIST_DIR, "404.html")) ||
			existsSync(path.join(DIST_DIR, "404", "index.html"))
		);
	}
	const exactTarget = path.resolve(DIST_DIR, relPath);
	if (!exactTarget.startsWith(DIST_DIR)) {
		return false;
	}
	if (existsSync(exactTarget)) {
		const stats = statSync(exactTarget);
		if (stats.isFile()) {
			return true;
		}
		if (stats.isDirectory()) {
			return existsSync(path.join(exactTarget, "index.html"));
		}
	}
	return false;
}

function main(): void {
	if (!existsSync(DIST_DIR)) {
		console.error("[check-internal-links] dist/ directory not found.");
		process.exit(1);
	}

	const htmlFiles = collectHtmlFiles(DIST_DIR);
	const broken: Array<{ source: string; ref: string; resolved: string }> = [];
	let totalRefs = 0;

	for (const htmlFile of htmlFiles) {
		const rawHtml = readFileSync(htmlFile, "utf8");
		const scrubbed = rawHtml.replace(STRIP_BLOCKS, "");
		ATTR_PATTERN.lastIndex = 0;
		let match: RegExpExecArray | null = ATTR_PATTERN.exec(scrubbed);
		while (match !== null) {
			const ref = match[1] ?? match[2] ?? "";
			if (!shouldSkipReference(ref)) {
				const { resolvedPath, skipped } = resolveDistTarget(htmlFile, ref);
				if (!skipped) {
					totalRefs++;
					if (!targetExistsInDist(resolvedPath)) {
						broken.push({
							source: path.relative(DIST_DIR, htmlFile).replaceAll("\\", "/"),
							ref,
							resolved: resolvedPath,
						});
					}
				}
			}
			match = ATTR_PATTERN.exec(scrubbed);
		}
	}

	if (broken.length > 0) {
		console.error(
			`[check-internal-links] Found ${broken.length} broken internal link(s) across ${htmlFiles.length} HTML files:`,
		);
		for (const item of broken) {
			console.error(`  - ${item.source} -> "${item.ref}" (${item.resolved})`);
		}
		process.exit(1);
	}

	console.log(
		`[check-internal-links] Checked ${htmlFiles.length} HTML files, ${totalRefs} internal references: 0 broken links.`,
	);
}

main();
