import { supabase } from "../../db/supabase";

export async function getProgressByOrderId(orderId: string) {
  const { data, error } = await supabase
    .from("progress_logs")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

type CreateProgressInput = {
  company_id: number;
  order_id: number;
  user_id: number;
  status: string;
  note?: string;
};

export async function createProgress(input: CreateProgressInput) {
  const { data, error } = await supabase
    .from("progress_logs")
    .insert([input])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}