import type { BooknavGroup, BooknavPageConfig } from "../types/booknavConfig";

export const booknavPageConfig: BooknavPageConfig = {
	title: "",
	description: "",
	favicon: {
		enabled: true,
		api: "https://a.favicon.im/{domain}",
	},
};

export const booknavConfig: BooknavGroup[] = [
	{
		id: "publishing",
		name: "Site & Publishing Tools",
		icon: "material-symbols:edit-document-rounded",
		desc: "Tools used to manage Axia Zone ID posts, events, and performer wiki entries.",
		weight: 100,
		items: [
			{
				title: "GitHub Repository",
				url: "https://github.com/raitoklaus/axia-zone-id",
				desc: "Source code, content collections, and GitHub Actions deployments.",
				icon: "fa7-brands:github",
				weight: 10,
			},
			{
				title: "Pages CMS",
				url: "https://app.pagescms.org",
				desc: "Zero-config mobile and desktop Git CMS powered by .pages.yml.",
				weight: 9,
			},
			{
				title: "Sveltia CMS",
				url: "https://raitoklaus.github.io/axia-zone-id/admin/",
				desc: "In-site admin editor with searchable performer relation dropdowns.",
				weight: 8,
			},
			{
				title: "Astro Docs",
				url: "https://docs.astro.build",
				desc: "Official documentation for Astro 7 and Content Collections.",
				weight: 7,
			},
		],
	},
];
