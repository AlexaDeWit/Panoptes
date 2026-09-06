declare const SAERSKRIVEN_VERSION: string;

/**
 * The workspace version, substituted in when the bundle is built. There is no
 * run-time fallback on purpose: a build that failed to stamp the version fails
 * loudly rather than reporting a number no release carries.
 */
export const cliVersion: string = SAERSKRIVEN_VERSION;
