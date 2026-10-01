import { supabase, isSupabaseConfigured } from '../lib/supabase';

const LOCAL_STORAGE_KEY = 'habit_tracker_master_db';

export function getLocalRecords() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Ошибка LocalStorage:', e);
    return {};
  }
}

export function saveLocalRecords(records) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Ошибка записи LocalStorage:', e);
  }
}

export async function fetchAllRecords() {
  const local = getLocalRecords();
  if (!isSupabaseConfigured) return local;

  try {
    const { data, error } = await supabase.from('habit_logs').select('*');
    if (error) throw error;
    if (data && data.length > 0) {
      const merged = { ...local };
      data.forEach(row => {
        merged[row.date] = {
          sport: row.sport || {},
          reading: row.reading || {},
          self_dev: row.self_dev || {},
          exercise: row.exercise || {},
          sleep: row.sleep || {},
          nutrition: row.nutrition || {},
          scores: row.scores || {},
        };
      });
      saveLocalRecords(merged);
      return merged;
    }
  } catch (e) {
    console.warn('Работаем в офлайн-режиме LocalStorage:', e.message);
  }
  return local;
}

export async function persistDayRecord(dateStr, record) {
  const all = getLocalRecords();
  all[dateStr] = record;
  saveLocalRecords(all);

  if (isSupabaseConfigured) {
    try {
      await supabase.from('habit_logs').upsert({
        date: dateStr,
        sport: record.sport || {},
        reading: record.reading || {},
        self_dev: record.self_dev || {},
        exercise: record.exercise || {},
        sleep: record.sleep || {},
        nutrition: record.nutrition || {},
        scores: record.scores || {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'date' });
    } catch (e) {
      console.warn('Синхронизация с облаком отложена:', e);
    }
  }
  return all;
}