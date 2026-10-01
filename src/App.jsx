import React, { useState, useEffect, useMemo } from 'react';
import { 
  Dumbbell, BookOpen, Brain, Zap, Moon, Utensils, 
  ChevronLeft, ChevronRight, Calendar, BarChart3, 
  Edit3, Check, Download, Upload, Database, RefreshCw
} from 'lucide-react';
import { 
  HABITS_CONFIG, SCORE_LEVELS, evaluateAllScores, 
  calculateMonthlyHabitStats 
} from './utils/habitRules';
import { 
  getLocalRecords, saveLocalRecords, 
  fetchAllRecords, persistDayRecord 
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

export default function App() {
  const [activeTab, setActiveTab] = useState('input'); // 'input' | 'grid' | 'stats'
  const [records, setRecords] = useState(getLocalRecords());
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cloudStatus, setCloudStatus] = useState(isSupabaseConfigured ? 'connected' : 'local');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Инициализация данных
  useEffect(() => {
    fetchAllRecords().then(data => {
      if (data) setRecords(data);
    });
  }, []);

  // Текущий месяц для сетки и аналитики
  const [currentYearMonth, setCurrentYearMonth] = useState(() => selectedDate.slice(0, 7));

  // Данные выбранного дня
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

  // Живой подсчет оценок для формы ввода
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
    const newRecords = await persistDayRecord(selectedDate, updatedRecord);
    setRecords({ ...newRecords });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // Месячные вычисления для Сетки и Статистики
  const daysInCurrentMonth = useMemo(() => {
    const [year, month] = currentYearMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  }, [currentYearMonth]);

  const monthStats = useMemo(() => {
    const res = {};
    HABITS_CONFIG.forEach(habit => {
      const scoresArray = [];
      for (let day = 1; day <= daysInCurrentMonth; day++) {
        const dStr = `${currentYearMonth}-${String(day).padStart(2, '0')}`;
        const dayRec = records[dStr];
        scoresArray.push(dayRec?.scores?.[habit.id] ?? 0);
      }
      res[habit.id] = calculateMonthlyHabitStats(daysInCurrentMonth, scoresArray);
    });
    return res;
  }, [records, currentYearMonth, daysInCurrentMonth]);

  // Экспорт данных в JSON
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `habits_backup_${currentYearMonth}.json`);
    dlAnchor.click();
  };

  // Импорт данных из JSON
  const handleImportJSON = (e) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        saveLocalRecords(imported);
        setRecords(imported);
        alert('Данные успешно импортированы!');
      } catch (err) {
        alert('Ошибка при чтении файла');
      }
    };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Верхняя панель */}
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-bold">
              ✓
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Трекер привычек</h1>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${cloudStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                {cloudStatus === 'connected' ? 'Облако Supabase активно' : 'Локальный режим'}
              </p>
            </div>
          </div>

          {/* Навигация */}
          <nav className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-sm">
            <button
              onClick={() => setActiveTab('input')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${activeTab === 'input' ? 'bg-sky-500 text-white font-medium shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Edit3 size={15} />
              <span>Запись</span>
            </button>
            <button
              onClick={() => setActiveTab('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${activeTab === 'grid' ? 'bg-sky-500 text-white font-medium shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Calendar size={15} />
              <span>Сетка</span>
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${activeTab === 'stats' ? 'bg-sky-500 text-white font-medium shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <BarChart3 size={15} />
              <span>Статистика</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Основной контент */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {/* ===================== ТАБ 1: ЗАПИСЬ ДНЯ ===================== */}
        {activeTab === 'input' && (
          <div className="space-y-6">
            {/* Панель выбора даты */}
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
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-center font-semibold text-base sm:text-lg focus:outline-none cursor-pointer"
              />
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

            {/* Карточки привычек */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Спорт */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl"><Dumbbell size={18} /></div>
                    <span className="font-medium">Спорт</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SCORE_LEVELS[computedScores.sport].bg} text-slate-950`}>
                    {SCORE_LEVELS[computedScores.sport].label} ({computedScores.sport})
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

              {/* 2. Чтение */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl"><BookOpen size={18} /></div>
                    <span className="font-medium">Чтение</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SCORE_LEVELS[computedScores.reading].bg} text-slate-950`}>
                    {SCORE_LEVELS[computedScores.reading].label} ({computedScores.reading})
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

              {/* 3. Саморазвитие */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl"><Brain size={18} /></div>
                    <span className="font-medium">Саморазвитие</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SCORE_LEVELS[computedScores.self_dev].bg} text-slate-950`}>
                    {SCORE_LEVELS[computedScores.self_dev].label} ({computedScores.self_dev})
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

              {/* 4. Зарядка */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl"><Zap size={18} /></div>
                    <span className="font-medium">Зарядка</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SCORE_LEVELS[computedScores.exercise].bg} text-slate-950`}>
                    {SCORE_LEVELS[computedScores.exercise].label} ({computedScores.exercise})
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

              {/* 5. Режим сна */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl"><Moon size={18} /></div>
                    <span className="font-medium">Режим сна</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SCORE_LEVELS[computedScores.sleep].bg} text-slate-950`}>
                    {SCORE_LEVELS[computedScores.sleep].label} ({computedScores.sleep})
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Время отбоя</label>
                    <input 
                      type="time" 
                      value={formData.sleep?.bedTime ?? ''}
                      onChange={e => handleFieldChange('sleep', 'bedTime', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-sky-500 outline-none"
                    />
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

              {/* 6. Питание */}
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl"><Utensils size={18} /></div>
                    <span className="font-medium">Питание</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SCORE_LEVELS[computedScores.nutrition].bg} text-slate-950`}>
                    {SCORE_LEVELS[computedScores.nutrition].label} ({computedScores.nutrition})
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

            {/* Кнопка сохранения */}
            <button
              onClick={handleSaveDay}
              className="w-full py-3.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-[0.99] transition"
            >
              {saveSuccess ? (
                <>
                  <Check size={20} className="stroke-[3]" />
                  <span>Сохранено!</span>
                </>
              ) : (
                <span>Зафиксировать день</span>
              )}
            </button>
          </div>
        )}

        {/* ===================== ТАБ 2: МЕСЯЧНАЯ СЕТКА ===================== */}
        {activeTab === 'grid' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-2xl">
              <input 
                type="month"
                value={currentYearMonth}
                onChange={e => setCurrentYearMonth(e.target.value)}
                className="bg-transparent font-semibold text-base focus:outline-none cursor-pointer"
              />
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
              <input 
                type="month"
                value={currentYearMonth}
                onChange={e => setCurrentYearMonth(e.target.value)}
                className="bg-transparent font-semibold text-base focus:outline-none cursor-pointer"
              />
              <span className="text-xs text-slate-400">Формула из «Трекер активностей 2»</span>
            </div>

            {/* Карточки метрик */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {HABITS_CONFIG.map(habit => {
                const stat = monthStats[habit.id];
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

                    {/* Полоса распределения цветов */}
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

                    {/* Табличная разбивка по цветам */}
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

            {/* Блок бэкапа и резервной копии */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <Database size={16} />
                <span>Хранение: LocalStorage + Supabase</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportJSON}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition"
                >
                  <Download size={14} />
                  <span>Скачать бэкап (JSON)</span>
                </button>
                <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition cursor-pointer">
                  <Upload size={14} />
                  <span>Восстановить</span>
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