'use client';

import { useHabits } from '@/hooks/useHabits';
import Footer from '@/components/Footer';

// TODO: Replace with real authentication
const MOCK_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

export default function Home() {
  const { habits } = useHabits(MOCK_USER_ID);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="max-w-7xl mx-auto px-4 py-8 flex-1">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Habit Tracker</h1>
          <p className="text-gray-400">
            Connected to Backend API - Viewing habits from database
          </p>
        </header>

        <div className="space-y-6">
          {habits.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-lg">No habits found in database</p>
              <p className="text-sm mt-2">User ID: {MOCK_USER_ID}</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
              {habits.map((habit) => (
                <div key={habit.id} className="bg-gray-800 rounded-lg p-6 space-y-4">
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
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: habit.color }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Frequency:</span>
                      <p className="font-semibold capitalize">{habit.frequency}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Status:</span>
                      <p className="font-semibold capitalize">{habit.status}</p>
                    </div>
                    {habit.targetDays.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Target Days:</span>
                        <p className="font-semibold">
                          {habit.targetDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
