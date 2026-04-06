const AVATAR_COLORS = [
  '#E53E3E', '#DD6B20', '#D69E2E', '#38A169',
  '#3182CE', '#805AD5', '#D53F8C', '#319795',
] as const;

/**
 * Format a number as Philippine Peso currency.
 */
export function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format an ISO date string to a readable date (e.g. "April 6, 2026").
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format an ISO date string to a short date (e.g. "Apr 6, 2026").
 */
export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a billing period range (e.g. "Mar 1 - Mar 31, 2026").
 */
export function formatBillingPeriod(startStr: string, endStr: string): string {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  const startMonth = start.toLocaleDateString('en-PH', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-PH', { month: 'short' });
  const endYear = end.getFullYear();

  if (sameMonth) {
    return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${endYear}`;
  }
  if (sameYear) {
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${endYear}`;
  }
  return `${startMonth} ${start.getDate()}, ${start.getFullYear()} - ${endMonth} ${end.getDate()}, ${endYear}`;
}

/**
 * Return a time-of-day greeting.
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Extract initials from a full name (up to 2 characters).
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Return a human-readable relative time string (e.g. "2 hours ago").
 */
export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;

  return formatShortDate(dateStr);
}

/**
 * Hash a name to a consistent avatar background color.
 */
export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}
