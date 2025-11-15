'use client';

import { useHabits } from '@/hooks/useHabits';
import AddHabitForm from '@/components/AddHabitForm';
import HabitCard from '@/components/HabitCard';
import Footer from '@/components/Footer';

export default function Home() {
  const { habits, addHabit, deleteHabit, toggleHabitCompletion, isHabitCompletedOnDate } = useHabits();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="max-w-7xl mx-auto px-4 py-8 flex-1">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Habit Tracker</h1>
          <p className="text-gray-400">
            Track your daily habits and build lasting streaks
          </p>
        </header>

        <div className="space-y-6">
          <AddHabitForm onAdd={addHabit} />

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
              <p className="text-lg">No habits yet. Add your first habit to get started!</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
              {habits.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  onToggle={toggleHabitCompletion}
                  onDelete={deleteHabit}
                  isCompletedOnDate={isHabitCompletedOnDate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
