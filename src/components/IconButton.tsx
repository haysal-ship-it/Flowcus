import React from 'react';

interface IconButtonProps {
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title: string;
  ariaLabel?: string;
  variant?: 'default' | 'danger' | 'accent' | 'active';
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  title,
  ariaLabel,
  variant = 'default',
  size = 'md',
  disabled = false,
}) => {
  return (
    <button
      type="button"
      className={`flowcus-icon-btn variant-${variant} size-${size}`}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      disabled={disabled}
    >
      {icon}
    </button>
  );
};
