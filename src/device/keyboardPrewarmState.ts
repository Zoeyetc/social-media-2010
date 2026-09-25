let completedSessionId: string | null = null;

export function needsKeyboardPrewarm(sessionId: string): boolean {
  return completedSessionId !== sessionId;
}

export function markKeyboardPrewarmed(sessionId: string): void {
  completedSessionId = sessionId;
}
