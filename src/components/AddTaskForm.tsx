import React, { useState, useRef, useEffect } from 'react';

interface AddTaskFormProps {
  onAdd: (title: string, duration: string) => void;
  onCancel: () => void;
  isClosing?: boolean;
}

export const AddTaskForm: React.FC<AddTaskFormProps> = ({ onAdd, onCancel, isClosing = false }) => {
  const [title, setTitle] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('30m');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleClose = () => {
    onCancel();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (trimmed) {
      onAdd(trimmed, selectedDuration);
      setTitle('');
      setSelectedDuration('30m');
    }
  };

  const durationOptions = ['15m', '30m', '60m'];

  return (
    <form
      className={`flowcus-add-task-form ${isClosing ? 'closing' : ''}`}
      onSubmit={handleSubmit}
      aria-label="New Task Form"
    >
      <div className="flowcus-add-form-header">
        <h3 className="flowcus-add-form-title">New Task</h3>
        <button
          type="button"
          className="flowcus-add-form-close"
          onClick={handleClose}
          aria-label="Close add task form"
          title="Close (Esc)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Accessible Label & Title Input: ~360 x 33px */}
      <label htmlFor="new-task-title-input" className="sr-only">
        Task Title
      </label>
      <input
        id="new-task-title-input"
        ref={inputRef}
        type="text"
        className="flowcus-add-title-input"
        placeholder="Enter task title here"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') handleClose();
        }}
        required
      />

      {/* Task Length Row: Label + Duration Selector (~128 x 33px) */}
      <div className="flowcus-add-duration-row">
        <span id="task-length-label" className="flowcus-add-duration-label">
          Task Length
        </span>
        <div
          className="flowcus-add-duration-selector"
          role="radiogroup"
          aria-labelledby="task-length-label"
        >
          {durationOptions.map(dur => (
            <button
              key={dur}
              type="button"
              role="radio"
              aria-checked={selectedDuration === dur}
              aria-pressed={selectedDuration === dur}
              className={`flowcus-add-dur-btn ${selectedDuration === dur ? 'active' : ''}`}
              onClick={() => setSelectedDuration(dur)}
            >
              {dur}
            </button>
          ))}
        </div>
      </div>

      {/* Submit Button: ~360 x 40px full-width white pill */}
      <button
        type="submit"
        className="flowcus-add-submit-btn"
        disabled={!title.trim()}
        aria-label="Add Task"
      >
        Add Task
      </button>
    </form>
  );
};
