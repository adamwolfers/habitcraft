'use client';

import { Habit } from '@/types/habit';
import { getLastNDays, getDayName, getMonthDay } from '@/utils/dateUtils';

interface HabitCardProps {
  habit: Habit;
  onToggle: (habitId: string, date: Date) => void;
  onDelete: (habitId: string) => void;
  isCompletedOnDate: (habitId: string, date: Date) => boolean;
}

export default function HabitCard({ habit, onToggle, onDelete, isCompletedOnDate }: HabitCardProps) {
  const last7Days = getLastNDays(7);

  const calculateStreak = () => {
    let streak = 0;
    const sortedDates = [...habit.completedDates].sort().reverse();
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      if (sortedDates.includes(dateString)) {
        streak++;
      } else if (i > 0) {
        // Allow missing today if checking past days
        break;
      }
    }

    return streak;
  };

  const streak = calculateStreak();

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: habit.color }}
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{habit.name}</h3>
            {habit.description && (
              <p className="text-sm text-gray-400 truncate">{habit.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(habit.id)}
          className="text-gray-400 hover:text-red-500 transition-colors ml-2"
          aria-label="Delete habit"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-400">Streak:</span>
        <span className="font-semibold" style={{ color: habit.color }}>
          {streak} {streak === 1 ? 'day' : 'days'}
        </span>
        <span className="text-gray-400 ml-auto">
          Total: {habit.completedDates.length}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {last7Days.map((dateString) => {
          const date = new Date(dateString);
          const isCompleted = isCompletedOnDate(habit.id, date);

          return (
            <button
              key={dateString}
              onClick={() => onToggle(habit.id, date)}
              className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all hover:bg-gray-700"
            >
              <span className="text-xs text-gray-400">{getDayName(dateString)}</span>
              <span className="text-xs text-gray-500">{getMonthDay(dateString).split(' ')[1]}</span>
              <div
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  isCompleted
                    ? 'border-transparent scale-110'
                    : 'border-gray-600'
                }`}
                style={{
                  backgroundColor: isCompleted ? habit.color : 'transparent',
                }}
              >
                {isCompleted && (
                  <svg className="w-full h-full p-1 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
