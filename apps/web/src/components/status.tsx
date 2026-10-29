import { CheckCircle2, Clock3, Radio, XCircle, AlertCircle } from 'lucide-react';
import { labels } from '@vantrack/shared';
export function Status({ value }: { value: string }) {
  const positive = [
    'in_progress',
    'confirmed',
    'completed',
    'available',
    'boarded',
    'alighted',
  ].includes(value);
  const Icon =
    value === 'in_progress'
      ? Radio
      : positive
        ? CheckCircle2
        : value === 'cancelled'
          ? XCircle
          : value === 'maintenance'
            ? AlertCircle
            : Clock3;
  return (
    <span
      className={`status ${positive ? 'status-positive' : value === 'cancelled' ? 'status-negative' : ''}`}
    >
      <Icon size={13} />
      {labels[value] ?? value}
    </span>
  );
}
