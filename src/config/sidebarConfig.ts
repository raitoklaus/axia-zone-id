import siteSettings from "../data/siteSettings.json";
import type {
	SidebarLayoutConfig,
	WidgetComponentConfig,
	WidgetComponentType,
} from "../types/sidebarConfig";

type SidebarWidgetEntryInput = {
	type: string;
	enable?: boolean;
	position?: string;
	showOnPostPage?: boolean;
};

type WidgetDefaultTemplate = Omit<WidgetComponentConfig, "type">;

const WIDGET_DEFAULTS: Record<WidgetComponentType, WidgetDefaultTemplate> = {
	profile: {
		enable: true,
		position: "top",
		showOnPostPage: true,
	},
	announcement: {
		enable: true,
		position: "top",
		showOnPostPage: true,
	},
	music: {
		enable: true,
		position: "top",
		showOnPostPage: true,
	},
	categories: {
		enable: true,
		position: "sticky",
		showOnPostPage: true,
		specificConfig: {
			collapseThreshold: 5,
		},
	},
	tags: {
		enable: true,
		position: "sticky",
		showOnPostPage: true,
		specificConfig: {
			collapseThreshold: 10,
		},
	},
	dynamic: {
		enable: true,
		position: "top",
		showOnPostPage: true,
		specificConfig: {
			dynamic: {
				limit: 2,
			},
		},
	},
	stats: {
		enable: true,
		position: "top",
		showOnPostPage: false,
	},
	siteInfo: {
		enable: true,
		position: "top",
		showOnPostPage: false,
		specificConfig: {
			siteInfo: {
				unknownBuildPlatform: "Unknown CI",
			},
		},
	},
	calendar: {
		enable: true,
		showTitle: false,
		position: "sticky",
		showOnPostPage: false,
		specificConfig: {
			calendar: {
				showHeatmap: true,
			},
		},
	},
	sidebarToc: {
		enable: true,
		position: "sticky",
		showOnPostPage: true,
		hideOnNonPostPage: true,
	},
	advertisement: {
		enable: false,
		showTitle: false,
		position: "sticky",
		showOnPostPage: true,
	},
};

function isWidgetType(value: string): value is WidgetComponentType {
	return Object.hasOwn(WIDGET_DEFAULTS, value);
}

function buildWidgetList(
	items: SidebarWidgetEntryInput[] | undefined,
	fallback: WidgetComponentType[],
): WidgetComponentConfig[] {
	const source: SidebarWidgetEntryInput[] =
		Array.isArray(items) && items.length > 0
			? items
			: fallback.map((type) => ({ type }));

	const resolved: WidgetComponentConfig[] = [];
	for (const item of source) {
		if (!isWidgetType(item.type)) continue;
		const defaults = WIDGET_DEFAULTS[item.type];
		resolved.push({
			type: item.type,
			enable: typeof item.enable === "boolean" ? item.enable : defaults.enable,
			...(typeof defaults.showTitle === "boolean"
				? { showTitle: defaults.showTitle }
				: {}),
			position:
				item.position === "top" || item.position === "sticky"
					? item.position
					: defaults.position,
			showOnPostPage:
				typeof item.showOnPostPage === "boolean"
					? item.showOnPostPage
					: defaults.showOnPostPage,
			...(typeof defaults.hideOnNonPostPage === "boolean"
				? { hideOnNonPostPage: defaults.hideOnNonPostPage }
				: {}),
			...(defaults.specificConfig
				? { specificConfig: defaults.specificConfig }
				: {}),
		});
	}
	return resolved;
}

const sidebarSettings = siteSettings.sidebar;
const sidebarPosition: SidebarLayoutConfig["position"] =
	sidebarSettings?.position === "left" ||
	sidebarSettings?.position === "right" ||
	sidebarSettings?.position === "both"
		? sidebarSettings.position
		: "both";
const tabletSidebar: "left" | "right" =
	sidebarSettings?.tabletSidebar === "right" ? "right" : "left";

/**
 * 侧边栏布局配置（由 src/data/siteSettings.json 的 sidebar 字段驱动，保留默认 widget 参数）
 */
export const sidebarLayoutConfig: SidebarLayoutConfig = {
	enable: sidebarSettings?.enable !== false,
	position: sidebarPosition,
	tabletSidebar,
	hideSidebarOnPostPage: sidebarSettings?.hideSidebarOnPostPage === true,
	noSidebarContentWidth: 0.6,
	leftComponents: buildWidgetList(sidebarSettings?.left, [
		"profile",
		"announcement",
		"music",
		"categories",
		"tags",
	]),
	rightComponents: buildWidgetList(sidebarSettings?.right, [
		"dynamic",
		"stats",
		"siteInfo",
		"calendar",
		"sidebarToc",
	]),

	// 移动端底部组件配置列表
	// 这些组件只在移动端(<768px)显示在页面底部，独立于左右侧边栏配置
	mobileBottomComponents: [
		{
			type: "profile",
			enable: true,
			showOnPostPage: true,
		},
		{
			type: "announcement",
			enable: true,
			showOnPostPage: true,
		},
		{
			type: "categories",
			enable: true,
			showOnPostPage: true,
			specificConfig: {
				collapseThreshold: 5,
			},
		},
		{
			type: "tags",
			enable: true,
			showOnPostPage: true,
			specificConfig: {
				collapseThreshold: 10,
			},
		},
		{
			type: "dynamic",
			enable: true,
			showOnPostPage: true,
			specificConfig: {
				dynamic: {
					limit: 2,
				},
			},
		},
		{
			type: "stats",
			enable: true,
			showOnPostPage: true,
		},
		{
			type: "siteInfo",
			enable: true,
			showOnPostPage: true,
			specificConfig: {
				siteInfo: {
					unknownBuildPlatform: "Unknown CI",
				},
			},
		},
	],
};
