declare const SAERSKRIVEN_VERSION: string;
declare const SAERSKRIVEN_RELEASE_TAG: string;
declare const SAERSKRIVEN_BUILD_ID: string;

/** The workspace version compiled into this browser bundle. */
export const studioVersion = SAERSKRIVEN_VERSION;

/** The release tag, or an empty string for development builds. */
export const studioReleaseTag = SAERSKRIVEN_RELEASE_TAG;

/**
 * The commit CI built this bundle from, or `development` outside CI. Two
 * tabs agree on it exactly when they run the same code.
 */
export const studioBuildId = SAERSKRIVEN_BUILD_ID;
