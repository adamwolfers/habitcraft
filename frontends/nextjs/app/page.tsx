'use client';

import Link from 'next/link';
import Footer from '@/components/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
          Build Better Habits,<br />One Day at a Time
        </h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-8">
          Track your habits, visualize your progress, and achieve your habit goals!
          Simple and focused habit tracking.
        </p>
        <Link
          href="/register"
          className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg transition-colors"
        >
          Get Started
        </Link>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-700 rounded-lg p-6">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Track Your Habits</h3>
              <p className="text-gray-400">
                Create custom habits and track your completions with a simple, intuitive interface.
              </p>
              {/* Placeholder for GIF: demo-add-habit.gif */}
              <div className="mt-4 bg-gray-600 rounded-lg h-40 flex items-center justify-center text-gray-400 text-sm">
                Demo coming soon
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-6">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Visualize Your Progress</h3>
              <p className="text-gray-400">
                Stay motivated by seeing your weekly progress.
              </p>
              {/* Placeholder for GIF: demo-complete-habit.gif */}
              <div className="mt-4 bg-gray-600 rounded-lg h-40 flex items-center justify-center text-gray-400 text-sm">
                Demo coming soon
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-6">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Achieve Your Habit Goals</h3>
              <p className="text-gray-400">
                Watch your consistency grow week after week, and turn habit goals into true habits!
              </p>
              {/* Placeholder for GIF: demo-week-navigation.gif */}
              <div className="mt-4 bg-gray-600 rounded-lg h-40 flex items-center justify-center text-gray-400 text-sm">
                Demo coming soon
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Create a Habit</h3>
                <p className="text-gray-400">
                  Add a new habit with a name, description, icon, and color. Create habits that matter to you.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Mark Completions</h3>
                <p className="text-gray-400">
                  Mark your habits as complete with a single click. Simple and satisfying.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Watch Your Progress Grow</h3>
                <p className="text-gray-400">
                  Track your weekly progress and build lasting habits through consistent action.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link
              href="/register"
              className="inline-block px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
