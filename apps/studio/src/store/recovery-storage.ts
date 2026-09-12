import {
  ReadFailure,
  parseWithinLimits,
  readSaerskrivenYamlDocument,
  saerskrivenYamlCodec,
  threatDragonCodec,
  withinTextLimit,
  writeSaerskrivenYamlDocument,
} from '@saerskriven/formats';
import {
  diagramIdSchema,
  type DiagramId,
  type Model,
} from '@saerskriven/model';
import { Data, Either } from 'effect';
import { z } from 'zod';
import { reasonOf } from '../files/bridge.js';
import { studioVersion } from '../version.js';
import { holdsDiagram } from './selectors.js';
import {
  FileLifecycle,
  initialState,
  type RetainedSource,
  type State,
} from './state.js';

const recoveryVersion = 2;

/** The browser key that holds the current working session. */
export const recoveryStorageKey = 'saerskriven:studio:recovery';

const documentSchema = saerskrivenYamlCodec.wire.transform(
  (document, context): Model => {
    const model = readSaerskrivenYamlDocument(document);
    if (Either.isLeft(model)) {
      context.addIssue({ code: 'custom', message: 'Invalid stored model.' });
      return z.NEVER;
    }
    return model.right;
  },
);

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
 * The versioned value stored for recovery. The model is held as a
 * Saerskriven YAML document rather than as itself, so a session written by
 * one release opens in the next wherever a file written by that release
 * would: the format's own compatibility contract carries it, and an
 * additive change to the model costs the snapshot nothing.
 *
 * The stored shape and the parsed shape differ, and this is where they
 * meet. `document` goes in as the wire document and comes out as the model
 * under the name the store uses for it. The active diagram is optional
 * within the version: a snapshot written before it was stored still loads,
 * on the first diagram.
 */
export const recoverySnapshotSchema = z
  .object({
    version: z.literal(recoveryVersion),
    document: documentSchema,
    writtenBy: z.object({ studioVersion: z.string() }),
    dirty: z.boolean(),
    file: fileLifecycleSchema,
    activeDiagram: diagramIdSchema.optional(),
  })
  .transform(({ document, ...rest }) => ({ ...rest, present: document }));

/** A validated session recovery snapshot. */
export type RecoverySnapshot = z.output<typeof recoverySnapshotSchema>;

/** A snapshot as recovery storage holds it, before the document is mapped. */
export type StoredSnapshot = z.input<typeof recoverySnapshotSchema>;

/** Builds the current recovery version from store data. */
export function recoverySnapshot(
  present: Model,
  dirty: boolean,
  file: FileLifecycle,
  activeDiagram?: DiagramId,
): StoredSnapshot {
  return {
    version: recoveryVersion,
    document: writeSaerskrivenYamlDocument(present),
    writtenBy: { studioVersion },
    dirty,
    file,
    ...(activeDiagram === undefined ? {} : { activeDiagram }),
  };
}

/**
 * The state a snapshot restores: the model, the file, the dirty status and
 * the active diagram where the model still holds it, with empty history and
 * transient state. Dirty status is identity, so a dirty snapshot gets a
 * distinct saved value.
 */
export function restoredState(snapshot: RecoverySnapshot): State {
  const present = snapshot.present;
  return {
    ...initialState(present),
    saved: snapshot.dirty ? { ...present } : present,
    activeDiagram: holdsDiagram(present, snapshot.activeDiagram)
      ? snapshot.activeDiagram
      : undefined,
    file: snapshot.file,
    recoveryCurrent: true,
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
    snapshot: StoredSnapshot,
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
  snapshot: StoredSnapshot,
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
          RecoveryStorageFailure.Rejected({ reason: refusal(value) }),
        );
  });
}

const envelopeSchema = z.object({
  version: z.number(),
  writtenBy: z.object({ studioVersion: z.string() }).optional(),
});

function refusal(value: unknown): string {
  const envelope = envelopeSchema.safeParse(value);
  if (!envelope.success || envelope.data.version >= recoveryVersion) {
    return 'The stored snapshot is malformed or unsupported.';
  }
  const writer = envelope.data.writtenBy?.studioVersion;
  return writer === undefined
    ? 'An earlier release of Saerskriven stored this session, in a form this release cannot restore.'
    : `Saerskriven ${writer} stored this session, in a form this release cannot restore.`;
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
