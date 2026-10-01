/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        score: {
          0: '#EF4444', // Плохо (Красный)
          1: '#F97316', // Удовлетворительно (Оранжевый)
          2: '#EAB308', // Хорошо (Желтый)
          3: '#22C55E', // Отлично (Зеленый)
          4: '#38BDF8', // Превосходно (Голубой)
        }
      }
    },
  },
  plugins: [],
};