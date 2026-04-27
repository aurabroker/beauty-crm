import { createClient } from '@supabase/supabase-js';
const URL  = 'https://dhuvykwecsxgchzxufxw.supabase.co';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRodXZ5a3dlY3N4Z2Noenh1Znh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzAwNzEsImV4cCI6MjA5MjYwNjA3MX0.ooJL1hFIN3Mjb22QEtI7ZFAfSyLM4aGwduGGMykaaHE';
export const supabase = createClient(URL, KEY);
