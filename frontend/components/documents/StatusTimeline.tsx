'use client';

interface StatusTimelineProps {
  currentStatus: string;
  events: Array<{ status: string; timestamp: string; description?: string }>;
}

const STATUS_ORDER = ['PENDING', 'ANALYZING', 'VERIFIED'];

export function StatusTimeline({ currentStatus, events }: StatusTimelineProps) {
  const steps = STATUS_ORDER;
  const isFinalStatus = ['VERIFIED', 'FLAGGED', 'REJECTED'].includes(currentStatus);
  const currentIdx = steps.indexOf(
    currentStatus === 'FLAGGED' || currentStatus === 'REJECTED' ? 'VERIFIED' : currentStatus
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Status Timeline</h2>
      <ol className="relative ml-3 border-l border-gray-200" aria-label="Document status timeline">
        {steps.map((step, i) => {
          const done = i < currentIdx || (isFinalStatus && step === 'VERIFIED');
          const active =
            i === currentIdx ||
            ((currentStatus === 'FLAGGED' || currentStatus === 'REJECTED') && step === 'VERIFIED');
          const label = step === 'VERIFIED'
            ? currentStatus === 'FLAGGED'
              ? 'FLAGGED'
              : currentStatus === 'REJECTED'
              ? 'REVOKED'
              : 'VERIFIED'
            : step;

          return (
            <li key={step} className="mb-6 ml-6">
              <span
                className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white text-xs font-bold
                  ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}
                aria-current={active ? 'step' : undefined}
              >
                {done ? '✓' : i + 1}
              </span>
              <p className={`text-sm font-semibold ${active ? 'text-blue-700' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                {label}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}