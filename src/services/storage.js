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

// Загрузка из базы с возвратом статуса ошибки
export async function syncWithCloud() {
  const local = getLocalRecords();
  if (!isSupabaseConfigured) {
    return { data: local, error: 'Ключи Supabase не настроены в сборке' };
  }

  try {
    const { data, error } = await supabase.from('habit_logs').select('*');
    if (error) {
      return { data: local, error: error.message };
    }

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
      return { data: merged, error: null };
    }
  } catch (e) {
    return { data: local, error: e.message || 'Ошибка сети' };
  }
  return { data: local, error: null };
}

// Сохранение дня с возвратом ошибки, если Supabase отклонил запись
export async function persistDayRecord(dateStr, record) {
  const all = getLocalRecords();
  all[dateStr] = record;
  saveLocalRecords(all);

  if (!isSupabaseConfigured) {
    return { records: all, error: 'Сохранено только локально: ключи базы отсутствуют' };
  }

  try {
    const payload = {
      date: dateStr,
      sport: record.sport || {},
      reading: record.reading || {},
      self_dev: record.self_dev || {},
      exercise: record.exercise || {},
      sleep: record.sleep || {},
      nutrition: record.nutrition || {},
      scores: record.scores || {},
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('habit_logs')
      .upsert(payload, { onConflict: 'date' });

    if (error) {
      return { records: all, error: `Supabase отклонил запись: ${error.message}` };
    }

    return { records: all, error: null };
  } catch (e) {
    return { records: all, error: `Сбой сети при отправке: ${e.message}` };
  }
}

// Диагностический тест соединения
export async function testSupabaseConnection() {
  if (!isSupabaseConfigured) {
    return { success: false, message: 'Ключи Supabase отсутствуют в сборке (VITE_SUPABASE_URL)' };
  }

  try {
    const testDate = '1970-01-01';
    // Пробуем тестовую запись
    const { error: insertError } = await supabase.from('habit_logs').upsert({
      date: testDate,
      sport: { test: true },
      scores: { sport: 0 },
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      return { success: false, message: `Ошибка записи: ${insertError.message}` };
    }

    // Удаляем тестовую строку
    await supabase.from('habit_logs').delete().eq('date', testDate);

    return { success: true, message: 'Связь с базой идеальна! Чтение и запись работают.' };
  } catch (err) {
    return { success: false, message: `Сбой подключения: ${err.message}` };
  }
}

// Realtime подписка
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