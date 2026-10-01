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

// Загрузка всех записей из Supabase и слияние с локальными
export async function syncWithCloud() {
  const local = getLocalRecords();
  if (!isSupabaseConfigured) return local;

  try {
    const { data, error } = await supabase.from('habit_logs').select('*');
    if (error) throw error;
    if (data) {
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
    console.warn('Сбой облачной синхронизации:', e.message);
  }
  return local;
}

// Сохранение записи
export async function persistDayRecord(dateStr, record) {
  const all = getLocalRecords();
  all[dateStr] = record;
  saveLocalRecords(all);

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('habit_logs').upsert({
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

      if (error) console.error('Ошибка отправки в Supabase:', error.message);
    } catch (e) {
      console.warn('Офлайн-режим, сохранено только локально:', e);
    }
  }
  return all;
}

// Подписка на обновления в реальном времени (WebSockets)
export function subscribeToHabitChanges(onRemoteChange) {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel('realtime_habit_logs')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'habit_logs' },
      (payload) => {
        if (payload.new && payload.new.date) {
          const updatedRow = payload.new;
          const currentLocal = getLocalRecords();
          currentLocal[updatedRow.date] = {
            sport: updatedRow.sport || {},
            reading: updatedRow.reading || {},
            self_dev: updatedRow.self_dev || {},
            exercise: updatedRow.exercise || {},
            sleep: updatedRow.sleep || {},
            nutrition: updatedRow.nutrition || {},
            scores: updatedRow.scores || {},
          };
          saveLocalRecords(currentLocal);
          onRemoteChange({ ...currentLocal });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}