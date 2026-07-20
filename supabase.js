const SUPABASE_URL = "https://ygyikpmzxglbfkhqyrgk.supabase.co";
const SUPABASE_KEY = "sb_publishable_GCE8RKLN9KYEHBn9R9JGkA_x0KE1Oo1";

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

console.log("✅ supabase.js executed, client keys:", Object.keys(supabase));
