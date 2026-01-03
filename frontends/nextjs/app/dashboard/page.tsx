"use client";

import { useState } from "react";
import { useHabits } from "@/hooks/useHabits";
import { useAuth } from "@/context/AuthContext";
import AddHabitForm from "@/components/AddHabitForm";
import HabitCard from "@/components/HabitCard";
import EditHabitModal from "@/components/EditHabitModal";
import CompletionNoteModal from "@/components/CompletionNoteModal";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Habit, HabitFormData } from "@/types/habit";
import { findHabitById } from "@/utils/habitUtils";

interface NoteModalState {
  habitId: string;
  habitName: string;
  date: string;
  existingNote: string | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const {
    habits,
    createHabit,
    updateHabit,
    toggleCompletion,
    isHabitCompletedOnDate,
    deleteHabit,
    updateNote,
    getCompletionsForHabit,
  } = useHabits(user?.id ?? "");
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [noteModal, setNoteModal] = useState<NoteModalState | null>(null);

  const handleAddHabit = async (habitData: HabitFormData) => {
    await createHabit(habitData);
  };

  const handleDeleteHabit = async (habitId: string) => {
    try {
      await deleteHabit(habitId);
    } catch (error) {
      console.error("Failed to delete habit:", error);
      // Error is already logged by the hook, just catch it here to prevent unhandled promise rejection
    }
  };

  const handleEditHabit = (habitId: string) => {
    const habit = findHabitById(habits, habitId);
    if (!habit) {
      console.error(`Attempted to edit non-existent habit: ${habitId}`);
      return;
    }
    setEditingHabit(habit);
  };

  const handleUpdateHabit = async (
    habitId: string,
    updates: Partial<Habit>
  ) => {
    await updateHabit(habitId, updates);
    setEditingHabit(null);
  };

  const handleCloseModal = () => {
    setEditingHabit(null);
  };

  const handleOpenNoteModal = (habitId: string, date: string) => {
    const habit = findHabitById(habits, habitId);
    if (!habit) {
      console.error(`Attempted to open note for non-existent habit: ${habitId}`);
      return;
    }

    const completions = getCompletionsForHabit(habitId);
    const completion = completions.find((c) => c.date === date);
    const existingNote = completion?.notes || null;

    setNoteModal({
      habitId,
      habitName: habit.name,
      date,
      existingNote,
    });
  };

  const handleSaveNote = async (note: string | null) => {
    if (!noteModal) return;

    try {
      await updateNote(noteModal.habitId, noteModal.date, note);
      setNoteModal(null);
    } catch (error) {
      console.error("Failed to update note:", error);
    }
  };

  const handleCloseNoteModal = () => {
    setNoteModal(null);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900 text-white flex flex-col">
        <div className="max-w-4xl w-full mx-auto px-4 py-8 flex-1">
          <div className="space-y-6">
            <AddHabitForm onAdd={handleAddHabit} />
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
                <p className="text-lg">
                  No habits yet. Add your first habit to get started!
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                {habits.map((habit) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    onToggleCompletion={toggleCompletion}
                    onDelete={handleDeleteHabit}
                    onEdit={handleEditHabit}
                    isCompletedOnDate={isHabitCompletedOnDate}
                    completions={getCompletionsForHabit(habit.id)}
                    onOpenNoteModal={handleOpenNoteModal}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <Footer />
      </div>
      {editingHabit && (
        <EditHabitModal
          habit={editingHabit}
          isOpen={!!editingHabit}
          onClose={handleCloseModal}
          onUpdate={handleUpdateHabit}
        />
      )}
      {noteModal && (
        <CompletionNoteModal
          habitName={noteModal.habitName}
          date={noteModal.date}
          existingNote={noteModal.existingNote}
          onSave={handleSaveNote}
          onClose={handleCloseNoteModal}
        />
      )}
    </ProtectedRoute>
  );
}
