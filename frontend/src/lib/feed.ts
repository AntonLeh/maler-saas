import type { FeedEvent } from "../types/feed";

export function buildProgressFeed(
  progressEntries: any[],
  orders: any[],
  employeeNameMap: Map<number, string>
): FeedEvent[] {
  return progressEntries
    .filter((entry) => (entry.images?.length ?? 0) > 0)
    .map((entry) => {
      const order = orders.find(
        (o) => String(o.id) === String(entry.order_id)
      );

      return {
        id: `progress-${entry.id}`,
        type: "progress",
        created_at: entry.created_at,
        title: "Neue Baustellenbilder",
        description: entry.note || "Neue Fortschrittsbilder hochgeladen.",
        employeeName:
          employeeNameMap.get(entry.user_id) ||
          `Mitarbeiter #${entry.user_id}`,
        orderTitle: order?.title || "Unbekannter Auftrag",
        imageUrls: (entry.images ?? []).map((img: any) => img.image_url),
      };
    });
}
      