export type EventCategoryTone = "live" | "matsuri" | "anikura" | "expo";

export function getEventCategoryTone(eventType: string): EventCategoryTone {
	const value = (eventType || "").toLowerCase();
	if (
		value.includes("matsuri") ||
		value.includes("cosplay") ||
		value.includes("bunkasai")
	) {
		return "matsuri";
	}
	if (
		value.includes("anikura") ||
		value.includes("dj") ||
		value.includes("gathering")
	) {
		return "anikura";
	}
	if (
		value.includes("convention") ||
		value.includes("expo") ||
		value.includes("doujin")
	) {
		return "expo";
	}
	return "live";
}
