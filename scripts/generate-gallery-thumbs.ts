import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIST_GALLERY_DIR = path.resolve("dist/gallery");
const THUMB_ROOT_DIR = path.join(DIST_GALLERY_DIR, "_thumbs");
const THUMB_MAX_WIDTH = 640;
const THUMB_QUALITY = 78;
const RASTER_EXT = /\.(jpe?g|png|webp|avif)$/i;

async function generateGalleryThumbnails(): Promise<void> {
	if (!existsSync(DIST_GALLERY_DIR)) {
		console.log("[gallery-thumbs] dist/gallery not found, skipping.");
		return;
	}

	const albums = readdirSync(DIST_GALLERY_DIR, { withFileTypes: true }).filter(
		(entry) => entry.isDirectory() && entry.name !== "_thumbs",
	);

	let count = 0;
	let originalBytes = 0;
	let thumbBytes = 0;

	for (const album of albums) {
		const albumDir = path.join(DIST_GALLERY_DIR, album.name);
		const outAlbumDir = path.join(THUMB_ROOT_DIR, album.name);
		mkdirSync(outAlbumDir, { recursive: true });

		for (const file of readdirSync(albumDir, { withFileTypes: true })) {
			if (!file.isFile() || !RASTER_EXT.test(file.name)) continue;
			const srcPath = path.join(albumDir, file.name);
			const stem = file.name.slice(0, -path.extname(file.name).length);
			const outPath = path.join(outAlbumDir, `${stem}.webp`);

			originalBytes += statSync(srcPath).size;
			await sharp(srcPath)
				.rotate()
				.resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
				.webp({ quality: THUMB_QUALITY })
				.toFile(outPath);
			thumbBytes += statSync(outPath).size;
			count++;
		}
	}

	const origKiB = (originalBytes / 1024).toFixed(1);
	const thumbKiB = (thumbBytes / 1024).toFixed(1);
	console.log(
		`[gallery-thumbs] Generated ${count} thumbnail(s) in dist/gallery/_thumbs (${origKiB} KiB -> ${thumbKiB} KiB).`,
	);
}

await generateGalleryThumbnails();
