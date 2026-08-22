import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente de solo lectura, seguro de usar en cualquier página: se apoya en
// las policies de RLS públicas definidas en supabase/schema.sql.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente con permisos de escritura. Solo debe importarse desde route
// handlers server-side (cron de generación), nunca desde un componente de
// cliente ni desde código que se ejecute en el navegador.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : null;
