import {
  ReadFailure,
  parseWithinLimits,
  saerskrivenYamlCodec,
  threatDragonCodec,
  withinTextLimit,
} from '@saerskriven/formats';
import {
  diagramIdSchema,
  parseModel,
  type DiagramId,
  type Model,
} from '@saerskriven/model';
import { Data, Either } from 'effect';
import { z } from 'zod';
import { reasonOf } from '../files/bridge.js';
import { FileLifecycle, type RetainedSource } from './state.js';

const recoveryVersion = 1;

/** The browser key that holds the current working session. */
export const recoveryStorageKey = 'saerskriven:studio:recovery';

const modelSchema = z.unknown().transform((input, context): Model => {
  const parsed = parseModel(input);
  if (Either.isLeft(parsed)) {
    context.addIssue({ code: 'custom', message: 'Invalid stored model.' });
    return z.NEVER;
  }
  return parsed.right;
});

const retainedSourceSchema = z
  .discriminatedUnion('format', [
    z.object({
      format: z.literal('threat-dragon'),
      document: threatDragonCodec.wire.optional(),
    }),
    z.object({
      format: z.literal('saerskriven-yaml'),
      document: saerskrivenYamlCodec.wire.optional(),
    }),
  ])
  .transform((source): RetainedSource =>
    source.format === 'threat-dragon'
      ? { format: 'threat-dragon', document: source.document }
      : { format: 'saerskriven-yaml', document: source.document },
  );

const fileLifecycleSchema = z
  .discriminatedUnion('_tag', [
    z.object({ _tag: z.literal('NoFile') }),
    z.object({
      _tag: z.literal('Opened'),
      name: z.string(),
      source: retainedSourceSchema,
    }),
  ])
  .transform((file): FileLifecycle =>
    file._tag === 'NoFile'
      ? FileLifecycle.NoFile()
      : FileLifecycle.Opened({ name: file.name, source: file.source }),
  );

/**
 * The versioned value stored for recovery. The active diagram is optional
 * within the version: a snapshot written before it was stored still loads,
 * on the first diagram.
 */
export const recoverySnapshotSchema = z.object({
  version: z.literal(recoveryVersion),
  present: modelSchema,
  dirty: z.boolean(),
  file: fileLifecycleSchema,
  activeDiagram: diagramIdSchema.optional(),
});

/** A validated session recovery snapshot. */
export type RecoverySnapshot = z.output<typeof recoverySnapshotSchema>;

/** Builds the current recovery version from store data. */
export function recoverySnapshot(
  present: Model,
  dirty: boolean,
  file: FileLifecycle,
  activeDiagram?: DiagramId,
): RecoverySnapshot {
  return {
    version: recoveryVersion,
    present,
    dirty,
    file,
    ...(activeDiagram === undefined ? {} : { activeDiagram }),
  };
}

/** Why recovery storage could not supply or keep a snapshot. */
export type RecoveryStorageFailure = Data.TaggedEnum<{
  Rejected: { readonly reason: string };
  Unavailable: { readonly reason: string };
}>;

/** Constructors for {@link RecoveryStorageFailure}. */
export const RecoveryStorageFailure = Data.taggedEnum<RecoveryStorageFailure>();

/** Synchronous access to the one recovery snapshot. */
export type RecoveryStorage = {
  readonly load: () => Either.Either<
    RecoverySnapshot | undefined,
    RecoveryStorageFailure
  >;
  readonly replace: (
    snapshot: RecoverySnapshot,
  ) => Either.Either<void, RecoveryStorageFailure>;
  readonly clear: () => Either.Either<void, RecoveryStorageFailure>;
};

type StorageBackend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Uses one Web Storage provider for recovery. */
export function localRecoveryStorage(
  storage: () => StorageBackend,
): RecoveryStorage {
  return {
    load: () =>
      Either.flatMap(readItem(storage), (stored) =>
        stored === null
          ? Either.right(undefined)
          : parseRecoverySnapshot(stored),
      ),
    replace: (snapshot) =>
      Either.flatMap(encodeSnapshot(snapshot), (encoded) =>
        accessStorage(storage, (available) => {
          available.setItem(recoveryStorageKey, encoded);
        }),
      ),
    clear: () =>
      accessStorage(storage, (available) => {
        available.removeItem(recoveryStorageKey);
      }),
  };
}

/** Recovery storage backed by the current browser profile. */
export const browserRecoveryStorage = localRecoveryStorage(
  () => globalThis.localStorage,
);

function readItem(
  storage: () => StorageBackend,
): Either.Either<string | null, RecoveryStorageFailure> {
  return accessStorage(storage, (available) =>
    available.getItem(recoveryStorageKey),
  );
}

function accessStorage<Value>(
  storage: () => StorageBackend,
  use: (available: StorageBackend) => Value,
): Either.Either<Value, RecoveryStorageFailure> {
  return Either.try({
    try: () => use(storage()),
    catch: (cause) =>
      RecoveryStorageFailure.Unavailable({ reason: reasonOf(cause) }),
  });
}

function encodeSnapshot(
  snapshot: RecoverySnapshot,
): Either.Either<string, RecoveryStorageFailure> {
  return Either.flatMap(
    Either.try({
      try: () => JSON.stringify(snapshot),
      catch: (cause) =>
        RecoveryStorageFailure.Unavailable({ reason: reasonOf(cause) }),
    }),
    (encoded) =>
      Either.mapLeft(withinTextLimit(encoded), (failure) =>
        RecoveryStorageFailure.Unavailable({
          reason: describeReadLimit(failure),
        }),
      ),
  );
}

function parseRecoverySnapshot(
  stored: string,
): Either.Either<RecoverySnapshot, RecoveryStorageFailure> {
  const decoded = Either.mapLeft(
    parseWithinLimits(stored, (bounded) =>
      Either.try({
        try: () => JSON.parse(bounded) as unknown,
        catch: (cause) =>
          ReadFailure.MalformedText({ message: reasonOf(cause) }),
      }),
    ),
    (failure) =>
      RecoveryStorageFailure.Rejected({ reason: describeReadLimit(failure) }),
  );
  return Either.flatMap(decoded, (value) => {
    const snapshot = recoverySnapshotSchema.safeParse(value);
    return snapshot.success
      ? Either.right(snapshot.data)
      : Either.left(
          RecoveryStorageFailure.Rejected({
            reason: 'The stored snapshot is malformed or unsupported.',
          }),
        );
  });
}

function describeReadLimit(failure: ReadFailure): string {
  return ReadFailure.$match(failure, {
    ExceededReadLimit: ({ limit, bound, observed }) =>
      `${limit}: the bound is ${String(bound)}, the snapshot reached ${String(observed)}.`,
    MalformedText: ({ message }) => message,
    InvalidWireDocument: () => 'The stored snapshot is not valid.',
    InvalidModel: () => 'The stored model is not valid.',
  });
}
