import type { ActivityItem, ActivityType } from '../types';

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export function createActivity(
  type: ActivityType,
  description: string,
  xp?: number,
): ActivityItem {
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    description,
    xp,
    timestamp: new Date().toISOString(),
  };
}
