import { supabase } from "../../db/supabase";

export async function getAllCustomers() {
  const { data, error } = await supabase.from("customers").select("*");

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

type CreateCustomerInput = {
  company_id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  street?: string;
  zip?: string;
  city?: string;
  notes?: string;
};

export async function createCustomer(input: CreateCustomerInput) {
  const { data, error } = await supabase
    .from("customers")
    .insert([input])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}