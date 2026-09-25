// Runs before any application module is imported, so `appConfig` captures real secrets
// and credential encryption/decryption round-trips the same way it does in production.
process.env.CREDENTIAL_ENCRYPTION_KEY = "a".repeat(64);
process.env.SESSION_SECRET = "test-session-secret-value";
process.env.SETUP_ACCESS_CODE = "test-setup-code";
