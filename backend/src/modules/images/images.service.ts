import { supabase } from "../../db/supabase";

export async function getImagesByOrderId(orderId: string) {
  const { data, error } = await supabase
    .from("order_images")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}