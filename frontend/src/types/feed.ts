export type FeedEventType =
  | "progress"
  | "invoice"
  | "order"
  | "material"
  | "bonus";

export type FeedEvent = {
  id: string;
  type: FeedEventType;

  created_at: string;

  title: string;

  description: string;

  employeeName?: string;

  orderTitle?: string;

  imageUrls?: string[];
};