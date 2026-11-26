import siteSettings from "../data/siteSettings.json";
import type { MusicPlayerConfig } from "../types/musicConfig";

const resolveMusicMode = (mode: string | undefined): "local" | "meting" => {
	return mode === "meting" ? "meting" : "local";
};

const resolvePlayMode = (
	playMode: string | undefined,
): "list" | "one" | "random" => {
	if (playMode === "one" || playMode === "random") {
		return playMode;
	}
	return "list";
};

const resolveMetingServer = (
	server: string | undefined,
): "netease" | "tencent" | "kugou" | "xiami" | "baidu" => {
	if (
		server === "tencent" ||
		server === "kugou" ||
		server === "xiami" ||
		server === "baidu"
	) {
		return server;
	}
	return "netease";
};

const resolveMetingType = (
	type: string | undefined,
): "song" | "playlist" | "album" | "search" | "artist" => {
	if (
		type === "song" ||
		type === "album" ||
		type === "search" ||
		type === "artist"
	) {
		return type;
	}
	return "playlist";
};

const clampVolume = (volume: number | undefined): number => {
	if (typeof volume !== "number" || Number.isNaN(volume)) {
		return 0.7;
	}
	return Math.min(1, Math.max(0, volume));
};

const musicSettings = siteSettings.music;

// 音乐播放器配置
export const musicPlayerConfig: MusicPlayerConfig = {
	// 是否在导航栏显示音乐播放器入口
	showInNavbar: musicSettings?.showInNavbar ?? true,

	// 是否在侧边栏显示音乐播放器组件
	showInSidebar: musicSettings?.showInSidebar ?? true,

	// 使用方式："meting" 使用 Meting API，"local" 使用本地音乐列表
	mode: resolveMusicMode(musicSettings?.mode),

	// 默认音量 (0-1)
	volume: clampVolume(musicSettings?.volume),

	// 播放模式：'list'=列表循环, 'one'=单曲循环, 'random'=随机播放
	playMode: resolvePlayMode(musicSettings?.playMode),

	// 是否显启用歌词
	showLyrics: musicSettings?.showLyrics ?? false,

	// 是否启用底部悬浮歌词（桌面端为三行歌词，移动端为一行歌词，播放时显示允许手动关闭，重新播放后会再次展示）
	showFloatingLyrics: musicSettings?.showFloatingLyrics ?? true,

	// Meting API 配置
	meting: {
		// Meting API 地址
		// 默认使用官方 API，也可以使用自定义 API
		api:
			musicSettings?.meting?.api ||
			"https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
		// 音乐平台：netease=网易云音乐, tencent=QQ音乐, kugou=酷狗音乐, xiami=虾米音乐, baidu=百度音乐
		server: resolveMetingServer(musicSettings?.meting?.server),
		// 类型：song=单曲, playlist=歌单, album=专辑, search=搜索, artist=艺术家
		type: resolveMetingType(musicSettings?.meting?.type),
		// 歌单/专辑/单曲 ID 或搜索关键词
		id: musicSettings?.meting?.id || "10046455237",
		// 认证 token（可选）
		auth: musicSettings?.meting?.auth || "",
		// 备用 API 配置（当主 API 失败时使用）
		fallbackApis: [
			"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
			"https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
		],
	},

	// 本地音乐配置（当 mode 为 'local' 时使用）
	local: {
		playlist: (musicSettings?.playlist ?? [])
			.filter((track) => typeof track.url === "string" && track.url.trim())
			.map((track) => ({
				name: track.name?.trim() || "Untitled Track",
				artist: track.artist?.trim() || "Unknown Artist",
				url: track.url.trim(),
				cover: track.cover?.trim() || "",
				lrc: track.lrc || "",
			})),
	},
};
