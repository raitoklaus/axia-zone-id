import {
	type NavBarConfig,
	type NavBarLink,
	type NavBarSearchConfig,
	NavBarSearchMethod,
} from "../types/navBarConfig";

// ============================================================================
// 导航栏配置 - 根据顺序动态生成导航栏链接
// NavBar Configuration - Dynamically generate navigation bar links based on order
// ============================================================================
const getDynamicNavBarConfig = (): NavBarConfig => {
	// 基础导航栏链接 (5 crisp links to prevent header crowding)
	const links: NavBarLink[] = [];

	// Home
	links.push(LinkPresets.Home);

	// Events Schedule & Calendar (separated from Wiki)
	links.push({
		name: "Events",
		url: "/events/",
		icon: "material-symbols:calendar-month-rounded",
	});

	// Upgraded ACG & Performer Wiki Dropdown
	links.push({
		name: "Wiki",
		url: "/wiki/",
		icon: "material-symbols:menu-book-rounded",
		children: [
			{
				name: "Wiki Hub",
				url: "/wiki/",
				icon: "material-symbols:auto-stories-rounded",
			},
			{
				name: "Performers",
				url: "/wiki/performers/",
				icon: "material-symbols:groups-rounded",
			},
			{
				name: "Event Series & EO",
				url: "/wiki/?category=event-series",
				icon: "material-symbols:festival-rounded",
			},
			{
				name: "Axia Lore",
				url: "/wiki/?category=axia-lore",
				icon: "material-symbols:auto-awesome-rounded",
			},
			{
				name: "ACG Scene",
				url: "/wiki/?category=acg-scene",
				icon: "material-symbols:music-note-rounded",
			},
			{
				name: "Communities",
				url: "/wiki/?category=communities",
				icon: "material-symbols:diversity-3-rounded",
			},
		],
	});

	// Articles Dropdown
	links.push({
		name: "文章",
		url: "#",
		icon: "material-symbols:article",
		children: [
			LinkPresets.Archive,
			LinkPresets.Categories,
			LinkPresets.Tags,
			LinkPresets.Series,
		],
	});

	// More Dropdown (Community & Pages)
	links.push({
		name: "More",
		url: "#",
		icon: "material-symbols:apps-rounded",
		children: [
			LinkPresets.Dynamic,
			LinkPresets.Gallery,
			LinkPresets.Friends,
			LinkPresets.Guestbook,
			LinkPresets.Booknav,
			LinkPresets.Projects,
			LinkPresets.About,
		],
	});

	// 文档链接
	// links.push({
	// 	name: "文档",
	// 	url: "https://docs-firefly.cuteleaf.cn",
	// 	external: true,
	// 	icon: "material-symbols:docs",
	// });

	return { links } as NavBarConfig;
};

// 导航搜索配置
export const navBarSearchConfig: NavBarSearchConfig = {
	method: NavBarSearchMethod.PageFind,
};

// ============================================================================
// 链接预设 - 可自由自定义导航栏链接的名称、图标和URL
// Link Presets - Allows free customization of the name, icon, and URL of navigation bar links
// ============================================================================
export const LinkPresets: Record<string, NavBarLink> = {
	Home: {
		name: "主页",
		url: "/",
		icon: "material-symbols:home",
	},
	Archive: {
		name: "归档",
		url: "/archive/",
		icon: "material-symbols:archive",
	},
	Categories: {
		name: "分类",
		url: "/categories/",
		icon: "material-symbols:folder-open-rounded",
	},
	Tags: {
		name: "标签",
		url: "/tags/",
		icon: "material-symbols:tag-rounded",
	},
	Series: {
		name: "系列",
		url: "/series/",
		icon: "material-symbols:layers",
	},
	Friends: {
		name: "友链",
		url: "/friends/",
		icon: "material-symbols:link-2-rounded",
		pageKey: "friends",
	},
	Guestbook: {
		name: "留言",
		url: "/guestbook/",
		icon: "material-symbols:chat",
		pageKey: "guestbook",
	},
	Dynamic: {
		name: "动态",
		url: "/dynamic/",
		icon: "material-symbols:forum-rounded",
		pageKey: "dynamic",
	},
	Projects: {
		name: "项目",
		url: "/projects/",
		icon: "material-symbols:rocket-launch",
		pageKey: "projects",
	},
	Gallery: {
		name: "相册",
		url: "/gallery/",
		icon: "material-symbols:photo-library",
		pageKey: "gallery",
	},
	Booknav: {
		name: "书签导航",
		url: "/booknav/",
		icon: "material-symbols:bookmarks",
		pageKey: "booknav",
	},
	Bilibili: {
		name: "哔哩哔哩",
		url: "/bilibili/",
		icon: "fa7-brands:bilibili",
		pageKey: "bilibili",
	},
	Bangumi: {
		name: "番组计划",
		url: "/bangumi/",
		icon: "material-symbols:movie",
		pageKey: "bangumi",
	},
	VNDB: {
		name: "VNDB",
		url: "/vndb/",
		icon: "material-symbols:chrome-reader-mode-rounded",
		pageKey: "vndb",
	},
	MAL: {
		name: "AnimeList",
		url: "/myanimelist/",
		icon: "material-symbols:menu-book",
		pageKey: "mal",
	},
	Sponsor: {
		name: "打赏",
		url: "/sponsor/",
		icon: "material-symbols:favorite",
		pageKey: "sponsor",
	},
	About: {
		name: "关于我",
		url: "/about/",
		icon: "material-symbols:person",
	},
};

export const navBarConfig: NavBarConfig = getDynamicNavBarConfig();
