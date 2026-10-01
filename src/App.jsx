import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Dumbbell, BookOpen, Brain, Zap, Moon, Utensils, 
  ChevronLeft, ChevronRight, Calendar, BarChart3, 
  Edit3, Check, Download, Upload, Database, RefreshCw, AlertCircle, Clock
} from 'lucide-react';
import { 
  HABITS_CONFIG, SCORE_LEVELS, evaluateAllScores, 
  calculateMonthlyHabitStats 
} from './utils/habitRules';
import { 
  getLocalRecords, saveLocalRecords, 
  syncWithCloud, persistDayRecord, subscribeToHabitChanges,
  testSupabaseConnection
} from './services/storage';
import { isSupabaseConfigured } from './lib/supabase';

const habitIcons = {
  sport: Dumbbell,
  reading: BookOpen,
  self_dev: Brain,
  exercise: Zap,
  sleep: Moon,
  nutrition: Utensils,
};

// Вспомогательные функции для форматирования дат на русском языке
function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatDisplayMonth(yearMonthStr) {
  if (!yearMonthStr) return '';
  const [y, m] = yearMonthStr.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric'
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState('input');
  const [records, setRecords] = useState(getLocalRecords());
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [statusNotification, setStatusNotification] = useState(null);

  const handleManualSync = useCallback(async () => {
    setIsSyncing(true);
    const { data, error } = await syncWithCloud();
    if (error) {
      setErrorMessage(error);
    } else {
      setErrorMessage(null);
      if (data) setRecords(data);
    }
    setTimeout(() => setIsSyncing(false), 500);
  }, []);

  useEffect(() => {
    handleManualSync();

    const unsubscribe = subscribeToHabitChanges((updatedRecords) => {
      setRecords(updatedRecords);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleManualSync();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleManualSync);

    return () => {
      unsubscribe();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleManualSync);
    };
  }, [handleManualSync]);

  const [currentYearMonth, setCurrentYearMonth] = useState(() => selectedDate.slice(0, 7));

  const currentDayData = useMemo(() => {
    return records[selectedDate] || {
      sport: { steps: '', runKm: '', workoutMin: '', cyclingKm: '' },
      reading: { bookPages: '', phonePages: '' },
      self_dev: { minutes: '' },
      exercise: { level: 0 },
      sleep: { bedTime: '', durationHours: '' },
      nutrition: { junkKcal: '', fruitsVeggies: '', proteinGrams: '' },
      scores: { sport: 0, reading: 0, self_dev: 0, exercise: 0, sleep: 0, nutrition: 0 },
    };
  }, [records, selectedDate]);

  const [formData, setFormData] = useState(currentDayData);

  useEffect(() => {
    setFormData(currentDayData);
  }, [currentDayData, selectedDate]);

  const computedScores = useMemo(() => {
    return evaluateAllScores(formData);
  }, [formData]);

  const handleFieldChange = (category, field, value) => {
    setFormData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const handleSaveDay = async () => {
    const updatedRecord = {
      ...formData,
      scores: computedScores,
    };
    const { records: newRecords, error } = await persistDayRecord(selectedDate, updatedRecord);
    setRecords({ ...newRecords });

    if (error) {
      setErrorMessage(error);
    } else {
      setErrorMessage(null);
      setStatusNotification('Успешно сохранено в облако!');
      setTimeout(() => setStatusNotification(null), 2500);
    }
  };

  const handleRunDiagnostic = async () => {
    const res = await testSupabaseConnection();
    if (res.success) {
      alert(`✅ ${res.message}`);
      setErrorMessage(null);
    } else {
      alert(`❌ Ошибка проверки:\n${res.message}`);
      setErrorMessage(res.message);
    }
  };

  const daysInCurrentMonth = useMemo(() => {
    const [year, month] = currentYearMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  }, [currentYearMonth]);

  // ДИНАМИЧЕСКИЙ РАСЧЕТ СТАТИСТИКИ
  const monthStatsData = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const todayYearMonth = todayStr.slice(0, 7);
    const todayDay = today.getDate();

    let effectiveDays = daysInCurrentMonth;
    let isCurrentMonth = false;

    if (currentYearMonth === todayYearMonth) {
      effectiveDays = todayDay; // 1-го октября = 1, 2-го = 2 и т.д.
      isCurrentMonth = true;
    } else if (currentYearMonth > todayYearMonth) {
      effectiveDays = 0; // Будущий месяц
    }

    const stats = {};
    HABITS_CONFIG.forEach(habit => {
      const scoresArray = [];
      for (let day = 1; day <= daysInCurrentMonth; day++) {
        const dStr = `${currentYearMonth}-${String(day).padStart(2, '0')}`;
        const dayRec = records[dStr];
        scoresArray.push(dayRec?.scores?.[habit.id] ?? 0);
      }
      stats[habit.id] = calculateMonthlyHabitStats(
        effectiveDays, 
        scoresArray, 
        daysInCurrentMonth, 
        isCurrentMonth
      );
    });

    return { stats, effectiveDays, isCurrentMonth };
  }, [records, currentYearMonth, daysInCurrentMonth]);

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `habits_backup_${currentYearMonth}.json`);
    dlAnchor.click();
  };

  const handleImportJSON = (e) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        saveLocalRecords(imported);
        setRecords(imported);
        for (const [dateStr, rec] of Object.entries(imported)) {
          await persistDayRecord(dateStr, rec);
        }
        alert('Данные импортированы!');
      } catch (err) {
        alert('Ошибка при чтении файла');
      }
    };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Шапка с адаптивным переносом навигации на мобильных */}
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-bold shrink-0">
                ✓
              </div>
              <div>
                <h1 className="text-base font-semibold leading-tight">Трекер привычек</h1>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                  <span className="text-xs text-slate-400">
                    {isSupabaseConfigured ? 'Облако активно' : 'Локальный режим'}
                  </span>
                  {isSupabaseConfigured && (
                    <button 
                      onClick={handleManualSync}
                      title="Синхронизировать сейчас"
                      className="p-1 text-slate-400 hover:text-sky-400 transition"
                    >
                      <RefreshCw size={12} className={isSyncing ? 'animate-spin text-sky-400' : ''} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <nav className="grid grid-cols-3 sm:flex w-full sm:w-auto bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-sm">
            <button
              onClick={() => setActiveTab('input')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg transition ${activeTab === 'input' ? 'bg-sky-500 text-white font-medium shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Edit3 size={15} />
              <span>Запись</span>
            </button>
            <button
              onClick={() => setActiveTab('grid')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg transition ${activeTab === 'grid' ? 'bg-sky-500 text-white font-medium shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Calendar size={15} />
              <span>Сетка</span>
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg transition ${activeTab === 'stats' ? 'bg-sky-500 text-white font-medium shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <BarChart3 size={15} />
              <span>Статистика</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Оповещения об ошибках и успехе */}
      <div className="max-w-5xl w-full mx-auto px-4 pt-3 space-y-2">
        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button 
              onClick={handleRunDiagnostic}
              className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded font-medium text-[11px] shrink-0"
            >
              Проверить БД
            </button>
          </div>
        )}

        {statusNotification && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
            <Check size={16} className="shrink-0" />
            <span>{statusNotification}</span>
          </div>
        )}
      </div>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {/* ===================== ТАБ 1: ЗАПИСЬ ДНЯ ===================== */}
        {activeTab === 'input' && (
          <div className="space-y-6">
            {/* Панель выбора даты — клик в любое место открывает календарь */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-2xl">
              <button 
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d.toISOString().slice(0, 10));
                }}
                className="p-2 hover:bg-slate-800 rounded-xl transition text-slate-300"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="relative flex-1 flex items-center justify-center cursor-pointer group">
                <div className="flex items-center gap-2 font-semibold text-base sm:text-lg text-slate-100 group-hover:text-sky-400 transition pointer-events-none">
                  <Calendar size={18} className="text-sky-400" />
                  <span>{formatDisplayDate(selectedDate)}</span>
                </div>
                <input 
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer clickable-picker"
                />
              </div>

              <button 
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(d.toISOString().slice(0, 10));
                }}
                className="p-2 hover:bg-slate-800 rounded-xl transition text-slate-300"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Карточки привычек — без цифр в скобках */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Спорт */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl"><Dumbbell size={18} /></div>
                    <span className="font-medium">Спорт</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SCORE_LEVELS[computedScores.sport].bg} text-slate-950`}>
                    {SCORE_LEVELS[computedScores.sport].label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Шаги (цель 15k)</label>
                    <input 
                      type="number" 
                      placeholder="15000"
                      value={formData.sport?.steps ?? ''}
                      onChange={e => handleFieldChange('sport', 'steps', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Бег (км)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      placeholder="6"
                      value={formData.sport?.runKm ?? ''}
                      onChange={e => handleFieldChange('sport', 'runKm', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Зал / Тренировка (мин)</label>
                    <input 
                      type="number" 
                      placeholder="60"
                      value={formData.sport?.workoutMin ?? ''}
                      onChange={e => handleFieldChange('sport', 'workoutMin', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Велосипед (км)</label>
                    <input 
                      type="number" 
                      placeholder="10"
                      value={formData.sport?.cyclingKm ?? ''}
                      onChange={e => handleFieldChange('sport', 'cyclingKm', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-sky-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Чтение */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl"><BookOpen size={18} /></div>
                    <span className="font-medium">Чтение</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SCORE_LEVELS[computedScores.reading].bg} text-slate-950`}>
                    {SCORE_LEVELS[computedScores.reading].label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Бумажная книга (стр)</label>
                    <input 
                      type="number" 
                      placeholder="30"
                      value={formData.reading?.bookPages ?? ''}
                      onChange={e => handleFieldChange('reading', 'bookPages', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">С телефона (стр)</label>
                    <input 
                      type="number" 
                      placeholder="45"
                      value={formData.reading?.phonePages ?? ''}
                      onChange={e => handleFieldChange('reading', 'phonePages', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-sky-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Саморазвитие */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl"><Brain size={18} /></div>
                    <span className="font-medium">Саморазвитие</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SCORE_LEVELS[computedScores.self_dev].bg} text-slate-950`}>
                    {SCORE_LEVELS[computedScores.self_dev].label}
                  </span>
                </div>
                <div className="text-xs">
                  <label className="text-slate-400 block mb-1">Гитара / Проф. чтение (минут)</label>
                  <input 
                    type="number" 
                    placeholder="40"
                    value={formData.self_dev?.minutes ?? ''}
                    onChange={e => handleFieldChange('self_dev', 'minutes', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* Зарядка */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl"><Zap size={18} /></div>
                    <span className="font-medium">Зарядка</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SCORE_LEVELS[computedScores.exercise].bg} text-slate-950`}>
                    {SCORE_LEVELS[computedScores.exercise].label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { val: 0, text: 'Пропуск' },
                    { val: 1, text: 'Быстрая разминка' },
                    { val: 2, text: 'Разминка' },
                    { val: 3, text: '+ Гантели/отжим.' },
                    { val: 4, text: '+ Подтягивания' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => handleFieldChange('exercise', 'level', opt.val)}
                      className={`px-2.5 py-2 rounded-xl text-left border transition ${
                        Number(formData.exercise?.level) === opt.val
                          ? 'border-sky-500 bg-sky-500/10 text-sky-300 font-medium'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {opt.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Режим сна — клик в любое место поля открывает часы */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl"><Moon size={18} /></div>
                    <span className="font-medium">Режим сна</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SCORE_LEVELS[computedScores.sleep].bg} text-slate-950`}>
                    {SCORE_LEVELS[computedScores.sleep].label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Время отбоя</label>
                    <div className="relative">
                      <input 
                        type="time" 
                        value={formData.sleep?.bedTime ?? ''}
                        onChange={e => handleFieldChange('sleep', 'bedTime', e.target.value)}
                        onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-sky-500 outline-none cursor-pointer relative clickable-picker [color-scheme:dark]"
                      />
                      <Clock size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Длительность (часов)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      placeholder="7.5"
                      value={formData.sleep?.durationHours ?? ''}
                      onChange={e => handleFieldChange('sleep', 'durationHours', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-sky-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Питание */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl"><Utensils size={18} /></div>
                    <span className="font-medium">Питание</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SCORE_LEVELS[computedScores.nutrition].bg} text-slate-950`}>
                    {SCORE_LEVELS[computedScores.nutrition].label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Вредное (ккал)</label>
                    <input 
                      type="number" 
                      placeholder="0"
                      value={formData.nutrition?.junkKcal ?? ''}
                      onChange={e => handleFieldChange('nutrition', 'junkKcal', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Фрукты/овощи</label>
                    <input 
                      type="number" 
                      placeholder="5"
                      value={formData.nutrition?.fruitsVeggies ?? ''}
                      onChange={e => handleFieldChange('nutrition', 'fruitsVeggies', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm focus:border-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Белок (г)</label>
                    <input 
                      type="number" 
                      placeholder="120"
                      value={formData.nutrition?.proteinGrams ?? ''}
                      onChange={e => handleFieldChange('nutrition', 'proteinGrams', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm focus:border-sky-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveDay}
              className="w-full py-3.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-[0.99] transition"
            >
              <span>Зафиксировать день</span>
            </button>
          </div>
        )}

        {/* ===================== ТАБ 2: МЕСЯЧНАЯ СЕТКА ===================== */}
        {activeTab === 'grid' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-2xl">
              <div className="relative flex items-center gap-2 cursor-pointer group">
                <Calendar size={18} className="text-sky-400 pointer-events-none" />
                <span className="font-semibold text-base text-slate-100 group-hover:text-sky-400 transition capitalize pointer-events-none">
                  {formatDisplayMonth(currentYearMonth)}
                </span>
                <input 
                  type="month"
                  value={currentYearMonth}
                  onChange={e => setCurrentYearMonth(e.target.value)}
                  onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer clickable-picker"
                />
              </div>
              <span className="text-xs text-slate-400">Нажмите на ячейку для ввода</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800">
                      <th className="sticky left-0 bg-slate-950 z-10 px-3 py-2.5 text-left font-semibold text-slate-300 w-32">
                        Привычка
                      </th>
                      {Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1).map(day => (
                        <th key={day} className="px-2 py-2.5 text-center text-slate-400 font-normal min-w-[30px]">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HABITS_CONFIG.map(habit => {
                      const Icon = habitIcons[habit.id];
                      return (
                        <tr key={habit.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                          <td className="sticky left-0 bg-slate-900 z-10 px-3 py-2 font-medium text-slate-200 flex items-center gap-2">
                            <Icon size={14} className="text-slate-400" />
                            <span className="truncate">{habit.name}</span>
                          </td>
                          {Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1).map(day => {
                            const dateStr = `${currentYearMonth}-${String(day).padStart(2, '0')}`;
                            const dayRecord = records[dateStr];
                            const score = dayRecord?.scores?.[habit.id] ?? 0;
                            const isFilled = Boolean(dayRecord);

                            return (
                              <td 
                                key={day} 
                                onClick={() => {
                                  setSelectedDate(dateStr);
                                  setActiveTab('input');
                                }}
                                title={`${habit.name} (${dateStr}): ${SCORE_LEVELS[score].label}`}
                                className="p-1 text-center cursor-pointer hover:opacity-80"
                              >
                                <div 
                                  className={`w-6 h-6 mx-auto rounded-md flex items-center justify-center font-bold text-[10px] transition ${
                                    isFilled ? `${SCORE_LEVELS[score].bg} text-slate-950` : 'bg-slate-800/60 text-slate-600'
                                  }`}
                                >
                                  {isFilled ? score : ''}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== ТАБ 3: СТАТИСТИКА ===================== */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-2xl">
              <div className="relative flex items-center gap-2 cursor-pointer group">
                <Calendar size={18} className="text-sky-400 pointer-events-none" />
                <span className="font-semibold text-base text-slate-100 group-hover:text-sky-400 transition capitalize pointer-events-none">
                  {formatDisplayMonth(currentYearMonth)}
                </span>
                <input 
                  type="month"
                  value={currentYearMonth}
                  onChange={e => setCurrentYearMonth(e.target.value)}
                  onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer clickable-picker"
                />
              </div>

              {/* Отображение периода расчета */}
              <span className="text-xs text-slate-400">
                {monthStatsData.isCurrentMonth
                  ? `Расчет за ${monthStatsData.effectiveDays} из ${daysInCurrentMonth} дн.`
                  : `Расчет за ${daysInCurrentMonth} дн.`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {HABITS_CONFIG.map(habit => {
                const stat = monthStatsData.stats[habit.id];
                const Icon = habitIcons[habit.id];

                return (
                  <div key={habit.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-sky-400" />
                        <h3 className="font-semibold text-sm">{habit.name}</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold text-sky-400">{stat.average.toFixed(2)}</span>
                        <span className="text-xs text-slate-500"> / 4.0</span>
                      </div>
                    </div>

                    <div className="w-full h-3 bg-slate-800 rounded-full flex overflow-hidden">
                      {[0, 1, 2, 3, 4].map(score => (
                        <div 
                          key={score}
                          style={{ width: `${stat.percentages[score]}%` }}
                          className={`${SCORE_LEVELS[score].bg} h-full`}
                          title={`${SCORE_LEVELS[score].label}: ${stat.counts[score]} дн (${stat.percentages[score].toFixed(1)}%)`}
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-5 gap-1 text-[11px] text-center pt-1 border-t border-slate-800/80">
                      {[0, 1, 2, 3, 4].map(score => (
                        <div key={score} className="space-y-0.5">
                          <div className={`font-semibold ${SCORE_LEVELS[score].text}`}>
                            {score}
                          </div>
                          <div className="text-slate-300 font-medium">
                            {stat.counts[score]}
                          </div>
                          <div className="text-[9px] text-slate-500">
                            {stat.percentages[score].toFixed(0)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <Database size={16} />
                <span>Supabase Cloud Sync</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleRunDiagnostic}
                  className="px-3 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl transition"
                >
                  Тест связи с БД
                </button>
                <button 
                  onClick={handleExportJSON}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition"
                >
                  <Download size={14} />
                  <span>Бэкап (JSON)</span>
                </button>
                <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition cursor-pointer">
                  <Upload size={14} />
                  <span>Импорт</span>
                  <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}