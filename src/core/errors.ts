export class PlaySpecError extends Error {
  constructor(message: string, public readonly hint?: string) {
    super(message);
    this.name = 'PlaySpecError';
  }
}

// Phase 0 skeleton — domain-specific error subclasses implemented in Phase 1
