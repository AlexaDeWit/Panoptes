import { createHash } from 'node:crypto';

/**
 * A file's revision handle: SHA-256 over the bytes on disk, lowercase hex,
 * behind the name of the algorithm that produced it. Every read returns one
 * and every write refuses one that no longer matches the file, so the shape
 * is fixed here and compared whole rather than parsed apart.
 */
export function revisionOf(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}
