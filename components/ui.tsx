import { providers } from '@/lib/models';

interface ProviderBadgeProps {
  provider: keyof typeof providers;
  size?: 'sm' | 'md';
}

export function ProviderBadge({ provider, size = 'md' }: ProviderBadgeProps) {
  const providerData = providers[provider];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses}`}
      style={{
        backgroundColor: `${providerData.color}20`,
        color: providerData.color,
      }}
    >
      {providerData.name}
    </span>
  );
}

interface ModelBadgeProps {
  modelName: string;
  provider: keyof typeof providers;
}

export function ModelBadge({ modelName, provider }: ModelBadgeProps) {
  const providerData = providers[provider];

  return (
    <div className="flex items-center gap-2">
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: providerData.color }}
      />
      <span className="font-medium text-gray-900 dark:text-white">
        {modelName}
      </span>
    </div>
  );
}

interface SuccessRateProps {
  value: number;
  showLabel?: boolean;
}

export function SuccessRate({ value, showLabel = true }: SuccessRateProps) {
  let colorClass = 'text-red-600 dark:text-red-400';
  let bgClass = 'bg-red-100 dark:bg-red-900/30';

  if (value >= 100) {
    colorClass = 'text-green-600 dark:text-green-400';
    bgClass = 'bg-green-100 dark:bg-green-900/30';
  } else if (value >= 80) {
    colorClass = 'text-lime-600 dark:text-lime-400';
    bgClass = 'bg-lime-100 dark:bg-lime-900/30';
  } else if (value >= 60) {
    colorClass = 'text-yellow-600 dark:text-yellow-400';
    bgClass = 'bg-yellow-100 dark:bg-yellow-900/30';
  } else if (value >= 40) {
    colorClass = 'text-orange-600 dark:text-orange-400';
    bgClass = 'bg-orange-100 dark:bg-orange-900/30';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${colorClass} ${bgClass}`}
    >
      {value.toFixed(0)}%{showLabel && ' success'}
    </span>
  );
}

interface AttemptIndicatorProps {
  attempts: boolean[];
}

export function AttemptIndicator({ attempts }: AttemptIndicatorProps) {
  return (
    <div className="flex items-center gap-1">
      {attempts.map((success, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${
            success
              ? 'bg-green-500'
              : 'bg-red-500'
          }`}
          title={`Attempt ${i + 1}: ${success ? 'Success' : 'Failed'}`}
        />
      ))}
    </div>
  );
}

interface TrendIndicatorProps {
  current: number;
  previous: number;
}

export function TrendIndicator({ current, previous }: TrendIndicatorProps) {
  const diff = current - previous;

  if (Math.abs(diff) < 0.5) {
    return (
      <span className="text-gray-400 text-sm">—</span>
    );
  }

  if (diff > 0) {
    return (
      <span className="text-green-600 dark:text-green-400 text-sm flex items-center gap-0.5">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        +{diff.toFixed(0)}%
      </span>
    );
  }

  return (
    <span className="text-red-600 dark:text-red-400 text-sm flex items-center gap-0.5">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
      {diff.toFixed(0)}%
    </span>
  );
}

interface ScenarioBadgeProps {
  scenario: number;
}

export function ScenarioBadge({ scenario }: ScenarioBadgeProps) {
  const labels: Record<number, { short: string; long: string }> = {
    1: { short: 'OS/NS', long: 'One-shot, Non-strict' },
    2: { short: 'OS/S', long: 'One-shot, Strict' },
    3: { short: 'Seq/NS', long: 'Sequential, Non-strict' },
    4: { short: 'Seq/S', long: 'Sequential, Strict' },
  };

  const label = labels[scenario] || { short: `S${scenario}`, long: `Scenario ${scenario}` };

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
      title={label.long}
    >
      {label.short}
    </span>
  );
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
