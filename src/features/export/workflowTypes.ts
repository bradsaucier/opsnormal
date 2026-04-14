export type MessageTone = 'info' | 'success' | 'warning' | 'error';
export type ReplaceConfirmState = 'idle' | 'armed';
export type ReplaceBackupState =
  | { phase: 'idle' }
  | { phase: 'saving' }
  | {
      phase: 'manual-awaiting-ack';
      fileName: string;
      reason: 'download-triggered' | 'readback-unavailable';
    }
  | { phase: 'ready'; fileName: string; verification: 'verified' | 'manual' };

export interface StatusMessage {
  tone: MessageTone;
  text: string;
}
