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

      {/* Task List or Centered Empty State (Authority: Figma Tasks empty-state frame 361:492) */}
      {tasks.length === 0 ? (
        !isAddFormOpen && !isClosingForm ? (
          <div className="flowcus-tasks-empty-area" role="region" aria-label="No tasks today">
            <div className="flowcus-empty-composition">
              {/* Muted document-like empty-state illustration */}
              <div className="flowcus-empty-doc-icon" aria-hidden="true">
                <svg
                  width="34"
                  height="42"
                  viewBox="0 0 34 42"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 2h16l8 8v28a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                  <polyline points="21 2 21 10 29 10" />
                  <line x1="9" y1="18" x2="25" y2="18" />
                  <line x1="9" y1="24" x2="25" y2="24" />
                  <line x1="9" y1="30" x2="17" y2="30" />
                </svg>
              </div>

              {/* Empty-state typography */}
              <div className="flowcus-empty-copy">
                <h3 className="flowcus-empty-heading">A fresh start</h3>
                <p className="flowcus-empty-subtext">Add a task and make today count.</p>
              </div>

              {/* Primary Add Task white pill button */}
              <button
                type="button"
                className="flowcus-empty-add-btn"
                onClick={() => {
                  if (!isAddFormOpen) onToggleAddForm?.();
                }}
                aria-label="Add Task"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Add Task</span>
              </button>
            </div>
          </div>
        ) : null
      ) : (
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
      )}
    </div>
  );
};
