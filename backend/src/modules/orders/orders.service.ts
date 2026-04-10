import { supabase } from "../../db/supabase";

export async function getAllOrders() {
  const { data, error } = await supabase.from("orders").select("*");

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getOrderById(id: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

type CreateOrderInput = {
  company_id: number;
  customer_id: number;
  title: string;
  description?: string;
  status: string;
  address_street?: string;
  address_zip?: string;
  address_city?: string;
  created_by: number;
};

export async function createOrder(input: CreateOrderInput) {
  const { data, error } = await supabase
    .from("orders")
    .insert([input])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}