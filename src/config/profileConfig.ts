import siteSettings from "../data/siteSettings.json";
import type { ProfileConfig } from "../types/profileConfig";

export const profileConfig: ProfileConfig = {
	avatar: siteSettings.profile.avatar,
	name: siteSettings.profile.name,
	bio: siteSettings.profile.bio,
	links: siteSettings.profile.links,
};
