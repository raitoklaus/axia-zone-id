import type { AnnouncementConfig } from "../types/announcementConfig";

export const announcementConfig: AnnouncementConfig = {
	title: "",
	content:
		"Welcome to Axia Zone ID. Explore the Indonesian ACG Event Schedule and Performer Wiki.",
	closable: true,
	link: {
		enable: true,
		text: "Open Event Calendar",
		url: "/wiki/events/",
		external: false,
	},
};
