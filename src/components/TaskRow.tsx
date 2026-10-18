import React, { useState } from 'react';
import { TaskItem } from '../types';
import { CheckIcon, EditIcon, TrashIcon, TargetIcon } from './Icons';
import { IconButton } from './IconButton';
import { normalizeTaskDuration, AllowedTaskDuration, ALLOWED_DURATIONS } from '../utils/taskStorage';

interface TaskRowProps {
  task: TaskItem;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newTitle: string, newDuration?: string) => void;
  onToggleFocus: (id: string) => void;
  isJustAdded?: boolean;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  onToggleComplete,
  onDelete,
  onEdit,
  onToggleFocus,
  isJustAdded = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDuration, setEditDuration] = useState<AllowedTaskDuration>(() =>
    normalizeTaskDuration(task.durationEst)
  );

  const hasMetadata = Boolean(task.durationEst || task.inProgress);
  const isShortRow = !hasMetadata;

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editTitle.trim();
    if (trimmed) {
      onEdit(task.id, trimmed, normalizeTaskDuration(editDuration));
    }
    setIsEditing(false);
  };

  return (
    <div
      role="listitem"
      className={`flowcus-task-row ${isShortRow ? 'flowcus-task-row-short' : 'flowcus-task-row-standard'} ${
        task.completed ? 'completed' : ''
      } ${task.inProgress ? 'in-focus-row' : ''} ${isJustAdded ? 'row-enter' : ''}`}
    >
      {/* 24 × 24px completion control area at the left edge */}
      <button
        type="button"
        role="checkbox"
        aria-checked={task.completed}
        className="flowcus-checkbox-hit-area"
        onClick={() => onToggleComplete(task.id)}
        aria-label={`Mark "${task.title}" as ${task.completed ? 'incomplete' : 'complete'}`}
        title={task.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        <span className={`flowcus-checkbox-circular ${task.completed ? 'checked' : ''}`}>
          <CheckIcon size={11} strokeWidth={2.5} className="flowcus-check-icon" />
        </span>
      </button>

      {/* Task text positioned approximately 36px to the right of row's left edge */}
      <div className="flowcus-task-content">
        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="flowcus-task-edit-form">
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              autoFocus
              className="flowcus-task-edit-input"
              placeholder="Task title"
            />
            <select
              value={editDuration}
              onChange={e => setEditDuration(e.target.value as AllowedTaskDuration)}
              className="flowcus-task-edit-duration-select"
              aria-label="Task Length"
            >
              {ALLOWED_DURATIONS.map(dur => (
                <option key={dur} value={dur}>
                  {dur}
                </option>
              ))}
            </select>
            <button type="submit" className="flowcus-edit-save-btn">
              Save
            </button>
          </form>
        ) : (
          <div className="flowcus-task-body-wrapper">
            {/* Title: ~14px */}
            <div className="flowcus-task-title-line">
              <span className="flowcus-task-title" title={task.title}>
                {task.title}
              </span>
            </div>

            {/* Metadata underneath title: ~12px */}
            {hasMetadata && (
              <div className="flowcus-task-meta">
                {task.durationEst && (
                  <span className="flowcus-task-duration tabular-nums">
                    {task.durationEst}
                  </span>
                )}
                {task.durationEst && task.inProgress && (
                  <span className="flowcus-meta-sep">·</span>
                )}
                {task.inProgress && (
                  <span className="flowcus-in-focus-green">
                    In Focus
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quiet, accessible actions on hover/focus */}
      {!isEditing && (
        <div className="flowcus-row-actions">
          <IconButton
            icon={<TargetIcon size={12} />}
            onClick={() => onToggleFocus(task.id)}
            title={task.inProgress ? 'Unset as active focus task' : 'Set as active focus task'}
            ariaLabel={task.inProgress ? 'Unset as active focus task' : 'Set as active focus task'}
            variant={task.inProgress ? 'accent' : 'default'}
            size="sm"
          />
          <IconButton
            icon={<EditIcon size={12} />}
            onClick={() => {
              setEditTitle(task.title);
              setEditDuration(normalizeTaskDuration(task.durationEst));
              setIsEditing(true);
            }}
            title="Edit task"
            ariaLabel={`Edit task "${task.title}"`}
            size="sm"
          />
          <IconButton
            icon={<TrashIcon size={12} />}
            onClick={() => onDelete(task.id)}
            title="Delete task"
            ariaLabel={`Delete task "${task.title}"`}
            variant="danger"
            size="sm"
          />
        </div>
      )}
    </div>
  );
};
