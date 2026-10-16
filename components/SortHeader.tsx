'use client';

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface SortHeaderProps {
  label: string;
  field: string;
  currentField: string;
  direction: 'asc' | 'desc';
  onSort: (field: string) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export const SortHeader: React.FC<SortHeaderProps> = ({
  label,
  field,
  currentField,
  direction,
  onSort,
  align = 'left',
  className = '',
}) => {
  const isActive = currentField === field;
  const justifyClass =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`group inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] select-none transition-colors focus:outline-none ${justifyClass} ${
        isActive ? 'text-slate-900 font-extrabold' : 'text-slate-600 hover:text-slate-900'
      } ${className}`}
      title={`Sort by ${label} (${isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'click to sort'})`}
    >
      <span>{label}</span>
      <span className="shrink-0 transition-transform">
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 opacity-60 group-hover:opacity-100" />
        )}
      </span>
    </button>
  );
};
