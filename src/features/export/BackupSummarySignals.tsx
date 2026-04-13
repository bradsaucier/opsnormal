import { SignalCard } from './exportPanelShared';

interface BackupSummarySignalsProps {
  backupStatus: string;
  canUndoImport: boolean;
}

export function BackupSummarySignals({
  backupStatus,
  canUndoImport,
}: BackupSummarySignalsProps) {
  const operatorSignals = [
    {
      label: 'Data boundary',
      value: 'Local only',
      detail:
        'No cloud sync. No account system. Recovery stays on the operator and this device.',
      tone: 'safe' as const,
    },
    {
      label: 'Safe path',
      value: 'Export first',
      detail: backupStatus,
      tone: 'safe' as const,
    },
    {
      label: 'Replace posture',
      value: 'Locked until checkpoint',
      detail:
        'Replace stays locked until a pre-replace backup checkpoint is complete.',
      tone: 'warning' as const,
    },
    {
      label: 'Session undo',
      value: canUndoImport ? 'Undo staged' : 'Undo not staged',
      detail: canUndoImport
        ? 'A rollback is staged for the most recent import in this session only.'
        : 'Undo appears only after a successful import and expires on reload.',
      tone: canUndoImport ? ('safe' as const) : ('default' as const),
    },
  ];

  return (
    <div
      role="list"
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      aria-label="Backup and recovery summary signals"
    >
      {operatorSignals.map((signal) => (
        <SignalCard
          key={signal.label}
          label={signal.label}
          value={signal.value}
          detail={signal.detail}
          tone={signal.tone}
        />
      ))}
    </div>
  );
}
