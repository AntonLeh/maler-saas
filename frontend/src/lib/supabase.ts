import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = "https://udzgxfjmpeygylgrcdsc.supabase.co";
export const supabaseAnonKey = "sb_publishable_N23R8SIVVw7_qmH3w-JPrw_w9YBpgyH";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);