import type { GalleryAlbum, GalleryConfig } from "@/types/galleryConfig";
import siteSettings from "../data/siteSettings.json";

export const galleryConfig: GalleryConfig = {
	albums: siteSettings.gallery.albums as GalleryAlbum[],
	columnWidth: siteSettings.gallery.columnWidth,
};
