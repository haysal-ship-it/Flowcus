import React from 'react';

interface PrimaryActionButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

export const PrimaryActionButton: React.FC<PrimaryActionButtonProps> = ({
  children,
  onClick,
  type = 'button',
  disabled = false,
  size = 'md',
  fullWidth = false,
  className = '',
}) => {
  return (
    <button
      type={type}
      className={`flowcus-primary-btn size-${size} ${fullWidth ? 'full-width' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
