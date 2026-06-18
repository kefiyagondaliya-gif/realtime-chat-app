import React from 'react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = ({ className = '' }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`theme-toggle-btn ${className}`}
      style={{
        background: isDark ? '#2d3748' : '#e2e8f0',
        border: 'none',
        borderRadius: '50px',
        padding: '6px 10px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '16px',
        transition: 'all 0.3s ease',
        color: isDark ? '#f7fafc' : '#2d3748',
        minWidth: '64px',
        justifyContent: 'center',
      }}
    >
      <span>{isDark ? '☀️' : '🌙'}</span>
      <span style={{ fontSize: '12px', fontWeight: 600 }}>
        {isDark ? 'Light' : 'Dark'}
      </span>
    </button>
  );
};

export default ThemeToggle;