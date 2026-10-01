import { createClient } from '@supabase/supabase-js';

// Автоматическая очистка и нормализация любого формата ссылки
function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return '';
  let url = rawUrl.trim().replace(/^['"]|['"]$/g, '');

  // Если случайно скопировали URL панели управления (Dashboard)
  const dashboardMatch = url.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
  if (dashboardMatch) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // Если скопировали REST URL или ссылку с лишними путями
  const coMatch = url.match(/(https?:\/\/[a-z0-9_-]+\.supabase\.co)/i);
  if (coMatch) {
    return coMatch[1];
  }

  // Обрезаем /rest/v1, /rest и лишние замыкающие слэши
  return url.replace(/\/rest(\/v1)?\/?$/i, '').replace(/\/+$/, '');
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const sanitizedUrl = normalizeSupabaseUrl(rawUrl);
export const sanitizedKey = rawKey.trim().replace(/^['"]|['"]$/g, '');

export const isSupabaseConfigured = Boolean(
  sanitizedUrl && 
  sanitizedKey && 
  !sanitizedUrl.includes('your-project-id')
);

export const supabase = isSupabaseConfigured
  ? createClient(sanitizedUrl, sanitizedKey)
  : null;