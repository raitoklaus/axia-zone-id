import type { ProfileConfig } from "../types/profileConfig";

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/avatar.avif",
	name: "Axia Zone ID",
	bio: "Indonesian ACG blog, event calendar, and performer wiki.",
	links: [
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/raitoklaus/axia-zone-id",
			showName: false,
		},
		{
			name: "Events",
			icon: "material-symbols:calendar-month-rounded",
			url: "/wiki/events/",
			showName: false,
		},
		{
			name: "RSS",
			icon: "fa7-solid:rss",
			url: "/rss/",
			showName: false,
		},
		{
			name: "Atom",
			icon: "fa7-solid:atom",
			url: "/atom/",
			showName: false,
		},
	],
};
