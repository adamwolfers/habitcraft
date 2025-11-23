'use client';

import { useState } from 'react';
import { Habit } from '@/types/habit';
import { getCalendarWeek, getDayName, getMonthDay } from '@/utils/dateUtils';

interface HabitCardProps {
  habit: Habit;
  onToggleCompletion: (habitId: string, date: Date) => void;
  onDelete: (habitId: string) => void;
  onEdit?: (habitId: string) => void;
  isCompletedOnDate: (habitId: string, date: Date) => boolean;
}

export default function HabitCard({ habit, onToggleCompletion, onDelete, onEdit, isCompletedOnDate }: HabitCardProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDays = getCalendarWeek(weekOffset);

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-3xl">{habit.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{habit.name}</h3>
            {habit.description && (
              <p className="text-sm text-gray-400">{habit.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: habit.color }}
          />
          {onEdit && (
            <button
              onClick={() => onEdit(habit.id)}
              className="text-gray-400 hover:text-blue-500 transition-colors"
              aria-label="Edit habit"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onDelete(habit.id)}
            className="text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Delete habit"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Previous week"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <p className="text-xs text-gray-400">
            {weekOffset === 0 ? 'Current week' : `${getMonthDay(weekDays[0])} - ${getMonthDay(weekDays[6])}`}
          </p>

          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Next week"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((dateString) => {
            // Parse date string as local date, not UTC
            const [year, month, day] = dateString.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            const isCompleted = isCompletedOnDate(habit.id, date);

            return (
              <button
                key={dateString}
                onClick={() => onToggleCompletion(habit.id, date)}
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
    </div>
  );
}
