import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://hyydkyhvgcekvtkrnspf.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5eWRreWh2Z2Nla3Z0a3Juc3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDU3MDQsImV4cCI6MjA4OTQ4MTcwNH0.54OcvlXRN9Bb7yhxUw2ufhWT2GypqCu3wH26fJuCuRA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
