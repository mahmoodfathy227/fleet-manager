"use strict";
/**
 * Supabase client for Cloud Functions (service role)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabase = getSupabase;
const supabase_js_1 = require("@supabase/supabase-js");
let supabase = null;
function getSupabase() {
    if (!supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
        }
        supabase = (0, supabase_js_1.createClient)(url, key);
    }
    return supabase;
}
//# sourceMappingURL=supabase.js.map