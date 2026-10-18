import React from 'react';
import { TaskItem } from '../types';
import { TaskRow } from './TaskRow';
import { AddTaskForm } from './AddTaskForm';
import { getFormattedTodayDate } from '../utils/taskStorage';

interface TasksViewProps {
  tasks: TaskItem[];
  onToggleComplete: (id: string) => void;
  onAddTask: (title: string, duration?: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string, newTitle: string, newDuration?: string) => void;
  onToggleFocus: (id: string) => void;
  justAddedTaskId: string | null;
  isAddFormOpen?: boolean;
  onToggleAddForm?: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  onToggleComplete,
  onAddTask,
  onDeleteTask,
  onEditTask,
  onToggleFocus,
  justAddedTaskId,
  isAddFormOpen = false,
  onToggleAddForm,
}) => {
  const formattedDate = getFormattedTodayDate();

  const handleAddSubmit = (title: string, duration: string) => {
    onAddTask(title, duration);
    handleCloseForm();
  };

  const [isClosingForm, setIsClosingForm] = React.useState(false);

  const handleCloseForm = () => {
    if (isClosingForm) return;
    setIsClosingForm(true);
    setTimeout(() => {
      setIsClosingForm(false);
      onToggleAddForm?.();
    }, 170);
  };

  const handleToggleBtn = () => {
    if (isAddFormOpen) {
      handleCloseForm();
    } else {
      onToggleAddForm?.();
    }
  };

  return (
    <div className="flowcus-tasks-view">
      {/* Header Row: Date & Heading at left, 32x32px Add button at right */}
      <div className="flowcus-tasks-header-row">
        <div className="flowcus-tasks-title-group">
          <span className="flowcus-date-label">{formattedDate}</span>
          <h2 className="flowcus-heading-tasks">Today’s Tasks</h2>
        </div>

        {/* 32 × 32px add-button hit area aligned to top right */}
        <button
          type="button"
          className={`flowcus-add-btn-32 ${isAddFormOpen && !isClosingForm ? 'active' : ''}`}
          onClick={handleToggleBtn}
          title={isAddFormOpen ? 'Close new task form' : 'Add task'}
          aria-label={isAddFormOpen ? 'Close new task form' : 'Add task'}
          aria-expanded={isAddFormOpen}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Add Task Form with smooth height & opacity transition */}
      <div className={`flowcus-add-form-collapse ${isAddFormOpen && !isClosingForm ? 'open' : ''}`}>
        <div className="flowcus-add-form-inner">
          {isAddFormOpen && (
            <AddTaskForm
              onAdd={handleAddSubmit}
              onCancel={handleCloseForm}
              isClosing={isClosingForm}
            />
          )}
        </div>
      </div>

      {/* Task List: 378px wide, subtle row dividers */}
      <div className="flowcus-task-list" role="list" aria-label="Today’s Tasks">
        {tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            onToggleComplete={onToggleComplete}
            onDelete={onDeleteTask}
            onEdit={onEditTask}
            onToggleFocus={onToggleFocus}
            isJustAdded={justAddedTaskId === task.id}
          />
        ))}
      </div>
    </div>
  );
};
