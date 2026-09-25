const defaultLimit = 180;

/**
 * Removes known secrets from a message before it reaches a response body, an audit row,
 * or a log line. GHL error payloads can echo back request context, so any string derived
 * from a request that touched an authenticated endpoint must pass through here.
 */
export function redactSecrets(message: string, secrets: Array<string | undefined>, limit = defaultLimit): string {
  let safe = message;
  for (const secret of secrets) {
    if (secret && secret.length >= 8) {
      safe = safe.replaceAll(secret, "[redacted]");
    }
  }
  return safe.slice(0, limit);
}
