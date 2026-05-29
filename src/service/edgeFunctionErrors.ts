export function coerceEdgeErrorMessage(payload: any): string {
  if (!payload) {
    return '';
  }
  if (typeof payload === 'string') {
    return payload.trim();
  }
  if (typeof payload?.error === 'string') {
    return payload.error.trim();
  }
  if (typeof payload?.message === 'string') {
    return payload.message.trim();
  }
  return '';
}

export function toFriendlyCanvasGradebookError(message: string): string {
  if (!message) {
    return message;
  }

  if (message.includes('Unable to find Canvas user for learner email') || message.includes('No exact Canvas user match for learner email')) {
    return 'Unable to submit grade: this learner is not in the Canvas course roster. Verify the learner email in Canvas and try again.';
  }

  return message;
}

export async function extractEdgeFunctionErrorMessage(error: any, data: any): Promise<string | null> {
  const directMessage = coerceEdgeErrorMessage(data);
  if (directMessage) {
    return toFriendlyCanvasGradebookError(directMessage);
  }

  const context = error?.context;
  if (context && typeof context.text === 'function') {
    try {
      const text = await context.text();
      if (text) {
        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { error: text };
        }
        const contextMessage = coerceEdgeErrorMessage(parsed);
        if (contextMessage) {
          return toFriendlyCanvasGradebookError(contextMessage);
        }
      }
    } catch {
      // Ignore parse failures and fall through to default message.
    }
  }

  return null;
}
