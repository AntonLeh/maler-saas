import type { FeedEvent } from "../types/feed";

export function buildProgressFeed(
  progressEntries: any[],
  siteVisitFeedEntries: any[],
  orders: any[],
  employeeNameMap: Map<number, string>
): FeedEvent[] {
  const progressFeed: FeedEvent[] = progressEntries
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
        description:
          entry.note || "Neue Fortschrittsbilder hochgeladen.",
        employeeName:
          employeeNameMap.get(entry.user_id) ||
          `Mitarbeiter #${entry.user_id}`,
        orderTitle: order?.title || "Unbekannter Auftrag",
        imageUrls: (entry.images ?? []).map(
          (img: any) => img.image_url
        ),
      };
    });

  const siteVisitFeed: FeedEvent[] = siteVisitFeedEntries
    .filter((entry) => (entry.images?.length ?? 0) > 0)
    .map((entry) => {
      const address = [
        entry.object_street,
        [entry.object_zip, entry.object_city]
          .filter(Boolean)
          .join(" "),
      ]
        .filter(Boolean)
        .join(", ");

      return {
        id: `site-visit-${entry.id}`,
        type: "site-visit",
        created_at: entry.created_at,
        title: "Neue Aufmaßbilder",
        description: address
          ? `Aufmaßbilder zum Objekt ${address}.`
          : "Neue Bilder aus einem Aufmaß.",
        employeeName:
          entry.measured_by !== null
            ? employeeNameMap.get(entry.measured_by) ||
              `Benutzer #${entry.measured_by}`
            : "Nicht zugeordnet",
        orderTitle: entry.title || "Aufmaß",
        imageUrls: (entry.images ?? []).map(
          (img: any) => img.signed_url
        ),
      };
    });

  return [...progressFeed, ...siteVisitFeed].sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );
}