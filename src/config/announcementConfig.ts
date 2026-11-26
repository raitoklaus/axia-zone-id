import siteSettings from "../data/siteSettings.json";
import type { AnnouncementConfig } from "../types/announcementConfig";

export const announcementConfig: AnnouncementConfig = {
	title: siteSettings.announcement.title,
	content: siteSettings.announcement.content,
	closable: siteSettings.announcement.closable,
	link: {
		enable: siteSettings.announcement.linkEnable,
		text: siteSettings.announcement.linkText,
		url: siteSettings.announcement.linkUrl,
		external: siteSettings.announcement.linkExternal,
	},
};
