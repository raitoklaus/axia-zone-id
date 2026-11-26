import siteSettings from "../data/siteSettings.json";
import type { SponsorConfig } from "../types/sponsorConfig";

export const sponsorConfig: SponsorConfig = {
	title: siteSettings.sponsor.title,
	description: siteSettings.sponsor.description,
	usage: siteSettings.sponsor.usage,
	showSponsorsList: siteSettings.sponsor.showSponsorsList,
	showComment: siteSettings.sponsor.showComment,
	showButtonInPost: siteSettings.sponsor.showButtonInPost,
	methods: [],
	sponsors: [],
};
