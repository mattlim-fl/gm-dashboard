interface ComparisonTypeToggleProps {
  comparisonType: 'previous' | 'year';
  onChange: (type: 'previous' | 'year') => void;
}

export const ComparisonTypeToggle = ({ comparisonType, onChange }: ComparisonTypeToggleProps) => {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium text-gm-neutral-600 dark:text-gm-neutral-300">Compare to:</span>
      <div className="flex bg-gm-neutral-100 dark:bg-gm-neutral-800 rounded-lg p-1">
        <button
          onClick={() => onChange('previous')}
          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
            comparisonType === 'previous'
              ? 'bg-white dark:bg-gm-neutral-700 text-gm-neutral-900 dark:text-white shadow-sm'
              : 'text-gm-neutral-600 dark:text-gm-neutral-400 hover:text-gm-neutral-900 dark:hover:text-white'
          }`}
        >
          Previous Period
        </button>
        <button
          onClick={() => onChange('year')}
          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
            comparisonType === 'year'
              ? 'bg-white dark:bg-gm-neutral-700 text-gm-neutral-900 dark:text-white shadow-sm'
              : 'text-gm-neutral-600 dark:text-gm-neutral-400 hover:text-gm-neutral-900 dark:hover:text-white'
          }`}
        >
          Same Period Last Year
        </button>
      </div>
    </div>
  );
};

