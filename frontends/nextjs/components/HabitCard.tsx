'use client';

import { useState } from 'react';
import { Habit, Completion } from '@/types/habit';
import { getCalendarWeek, getCalendarMonth, getDayName, getMonthDay, parseLocalDateFromString, isFutureDate } from '@/utils/dateUtils';
import { getDateButtonFutureClasses, getDateCircleStyle } from '@/utils/habitUtils';
import { useHabitViewMode } from '@/hooks/useHabitViewMode';

interface HabitCardProps {
  habit: Habit;
  onToggleCompletion: (habitId: string, date: Date) => void;
  onDelete: (habitId: string) => void;
  onEdit?: (habitId: string) => void;
  isCompletedOnDate: (habitId: string, date: Date) => boolean;
  completions?: Completion[];
  onOpenNoteModal?: (habitId: string, date: string) => void;
}

export default function HabitCard({ habit, onToggleCompletion, onDelete, onEdit, isCompletedOnDate, completions, onOpenNoteModal }: HabitCardProps) {
  const [viewMode, setViewMode] = useHabitViewMode(habit.id);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const weekDays = getCalendarWeek(weekOffset);
  const calendarMonth = getCalendarMonth(monthOffset);

  // Helper to get note for a specific date
  const getNoteForDate = (dateString: string): string | null => {
    if (!completions) return null;
    const completion = completions.find(c => c.date === dateString);
    return completion?.notes || null;
  };

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

      {/* View Mode Toggle */}
      <div className="flex justify-center">
        <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setViewMode('weekly')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              viewMode === 'weekly'
                ? 'bg-gray-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            aria-label="Weekly view"
            aria-pressed={viewMode === 'weekly'}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              viewMode === 'monthly'
                ? 'bg-gray-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            aria-label="Monthly view"
            aria-pressed={viewMode === 'monthly'}
          >
            Month
          </button>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-4">
        {viewMode === 'weekly' ? (
        <>
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

          {weekOffset === 0 ? (
            <span className="text-xs px-2 py-1 font-bold text-gray-300">
              {getMonthDay(weekDays[0])} - {getMonthDay(weekDays[6])}
            </span>
          ) : (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs px-2 py-1 rounded transition-colors text-blue-400 hover:text-blue-300 hover:bg-gray-700"
              aria-label="Go to current week"
            >
              {getMonthDay(weekDays[0])} - {getMonthDay(weekDays[6])}
            </button>
          )}

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
            const date = parseLocalDateFromString(dateString);
            const isCompleted = isCompletedOnDate(habit.id, date);
            const isFuture = isFutureDate(date);

            const note = getNoteForDate(dateString);
            const hasNote = note !== null;

            return (
              <div key={dateString} className="flex flex-col items-center gap-1">
                <button
                  onClick={() => !isFuture && onToggleCompletion(habit.id, date)}
                  disabled={isFuture}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${getDateButtonFutureClasses(isFuture)}`}
                >
                  <span className="text-xs text-gray-400">{getDayName(dateString)}</span>
                  <span className="text-xs text-gray-500">{getMonthDay(dateString).split(' ')[1]}</span>
                  <div
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      isCompleted
                        ? 'border-transparent scale-110'
                        : 'border-gray-600'
                    }`}
                    style={getDateCircleStyle(isCompleted, habit.color)}
                  >
                    {isCompleted && (
                      <svg className="w-full h-full p-1 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
                {/* Note indicator for completed days */}
                {isCompleted && onOpenNoteModal && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNoteModal(habit.id, dateString);
                    }}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    aria-label={hasNote ? 'View note' : 'Add note'}
                  >
                    {hasNote ? (
                      <svg data-testid="note-filled" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                        <path d="M8 12h8v2H8zm0 4h5v2H8z"/>
                      </svg>
                    ) : (
                      <svg data-testid="note-outline" className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        </>
        ) : (
        <>
        {/* Monthly View */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setMonthOffset(monthOffset - 1)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {monthOffset === 0 ? (
            <span className="text-xs px-2 py-1 font-bold text-gray-300">
              {calendarMonth.monthName}
            </span>
          ) : (
            <button
              onClick={() => setMonthOffset(0)}
              className="text-xs px-2 py-1 rounded transition-colors text-blue-400 hover:text-blue-300 hover:bg-gray-700"
              aria-label="Go to current month"
            >
              {calendarMonth.monthName}
            </button>
          )}

          <button
            onClick={() => setMonthOffset(monthOffset + 1)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Next month"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-xs text-gray-400 text-center">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarMonth.weeks.flat().map((dateString, index) => {
            if (dateString === '') {
              return <div key={`empty-${index}`} className="h-10" />;
            }

            const date = parseLocalDateFromString(dateString);
            const isCompleted = isCompletedOnDate(habit.id, date);
            const isFuture = isFutureDate(date);
            const day = date.getDate();

            const note = getNoteForDate(dateString);
            const hasNote = note !== null;

            return (
              <div key={dateString} className="flex flex-col items-center">
                <button
                  onClick={() => !isFuture && onToggleCompletion(habit.id, date)}
                  disabled={isFuture}
                  className={`flex items-center justify-center h-8 w-full rounded transition-all ${getDateButtonFutureClasses(isFuture)}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      isCompleted
                        ? ''
                        : 'border border-gray-600'
                    }`}
                    style={getDateCircleStyle(isCompleted, habit.color)}
                  >
                    {isCompleted ? (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-gray-400">{day}</span>
                    )}
                  </div>
                </button>
                {/* Note indicator - always reserve space for consistent layout */}
                <div className="h-4 flex items-center justify-center">
                  {isCompleted && onOpenNoteModal && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenNoteModal(habit.id, dateString);
                      }}
                      className="p-0.5 text-gray-400 hover:text-white transition-colors"
                      aria-label={hasNote ? 'View note' : 'Add note'}
                    >
                      {hasNote ? (
                        <svg data-testid="note-filled" className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                          <path d="M8 12h8v2H8zm0 4h5v2H8z"/>
                        </svg>
                      ) : (
                        <svg data-testid="note-outline" className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
