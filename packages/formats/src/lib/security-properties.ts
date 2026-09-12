import type { z } from 'zod';
import type {
  Actor,
  Process,
  Store,
  flowSchema,
  trustBoundarySchema,
} from '@saerskriven/model';

function presentProperties<T, Key extends keyof T>(
  source: T,
  keys: readonly Key[],
): Partial<Pick<T, Key>> {
  const selected: Partial<Pick<T, Key>> = {};
  for (const key of keys) {
    if (source[key] !== undefined) {
      selected[key] = source[key];
    }
  }
  return selected;
}

/** Actor facts shared by the native and Threat Dragon mappings. */
export function actorProperties(source: Pick<Actor, 'providesAuthentication'>) {
  return presentProperties(source, ['providesAuthentication']);
}

/** Process facts shared by the native and Threat Dragon mappings. */
export function processProperties(
  source: Pick<
    Process,
    | 'handlesCardPayment'
    | 'handlesGoodsOrServices'
    | 'isWebApplication'
    | 'privilegeLevel'
  >,
) {
  return presentProperties(source, [
    'handlesCardPayment',
    'handlesGoodsOrServices',
    'isWebApplication',
    'privilegeLevel',
  ]);
}

/** Store facts shared by the native and Threat Dragon mappings. */
export function storeProperties(
  source: Pick<
    Store,
    | 'isALog'
    | 'isEncrypted'
    | 'isSigned'
    | 'storesCredentials'
    | 'storesInventory'
  >,
) {
  return presentProperties(source, [
    'isALog',
    'isEncrypted',
    'isSigned',
    'storesCredentials',
    'storesInventory',
  ]);
}

/** Flow facts shared by the native and Threat Dragon mappings. */
export function flowProperties(
  source: Pick<
    z.input<typeof flowSchema>,
    'protocol' | 'isEncrypted' | 'isPublicNetwork' | 'trustBoundaryIds'
  >,
) {
  return presentProperties(source, [
    'protocol',
    'isEncrypted',
    'isPublicNetwork',
    'trustBoundaryIds',
  ]);
}

/** Boundary assertions shared by the native and Threat Dragon mappings. */
export function boundaryProperties(
  source: Pick<
    z.input<typeof trustBoundarySchema>,
    'containedElements' | 'crossingFlows'
  >,
) {
  return presentProperties(source, ['containedElements', 'crossingFlows']);
}
