import { panoptesYamlWireSchema } from '@panoptes/wire-panoptes-yaml';
import { threatDragonWireSchema } from '@panoptes/wire-threat-dragon';
import { Data, Either } from 'effect';
import { z } from 'zod';
import { ReadFailure, type Codec, type ReadResult } from './codec.js';
import { panoptesYamlCodec } from './panoptes-yaml.js';
import { threatDragonCodec } from './threat-dragon.js';

/**
 * The formats {@link readAnyFormat} tries, as the words a caller prints and
 * a failure lists. The registry below holds one codec per name, and the
 * specs compare what a failure says it tried against this list, so a name
 * added here without a codec beside it fails the suite rather than becoming
 * a format nothing reads.
 */
export const formatNameSchema = z.enum(['threat-dragon', 'panoptes-yaml']);

/** One registered format, named. */
export type FormatName = z.infer<typeof formatNameSchema>;

type DiscriminatorPath = readonly string[];

type Verdict = 'bounded' | 'claimed' | 'declined';

type Answer<
  Name extends FormatName,
  WireSchema extends z.ZodType<object>,
> = ReadResult<WireSchema> & {
  readonly format: Name;
  readonly codec: Codec<WireSchema>;
};

/**
 * What a read answered with: the format's name, the codec that answered,
 * and everything that codec produced. One member per registered codec,
 * discriminated by `format`, so narrowing on the name pairs a source
 * document with the codec that produced it and `codec.write(model, source)`
 * type-checks with nothing asserted. A caller holding the union writes
 * nothing until it narrows, which is what the union is for: pairing a
 * document with a codec is what a caller cannot check by looking.
 */
export type DetectedRead =
  | Answer<'threat-dragon', typeof threatDragonWireSchema>
  | Answer<'panoptes-yaml', typeof panoptesYamlWireSchema>;

/**
 * Why detection produced no reading: no registered codec claimed the text.
 * `tried` names every format offered it, in the order it was offered.
 *
 * It carries no issue from any codec on purpose. A codec that did not claim
 * was refusing a format the text is not in, so its complaints are about a
 * document nobody wrote. This is detection's own failure and no codec's,
 * which is why it is declared here rather than beside {@link ReadFailure}:
 * a codec still answers with {@link ReadFailure} alone.
 */
export type DetectionFailure = Data.TaggedEnum<{
  NoFormatClaimed: { readonly tried: readonly FormatName[] };
}>;

/**
 * Constructor for {@link DetectionFailure}, plus Effect's `$is` and
 * `$match` helpers. Values compare structurally under Effect's Equal and
 * serialize to their plain tagged shape.
 */
export const DetectionFailure = Data.taggedEnum<DetectionFailure>();

const threatDragonDiscriminators: readonly DiscriminatorPath[] = [
  ['version'],
  ['summary'],
  ['detail'],
];

const panoptesYamlDiscriminators: readonly DiscriminatorPath[] = [
  ['formatVersion'],
];

type Attempt = {
  readonly format: FormatName;
  readonly read: (
    text: string,
  ) => Either.Either<DetectedRead, ReadFailure> | undefined;
};

const registry: readonly Attempt[] = [
  attempt('threat-dragon', threatDragonCodec, threatDragonDiscriminators),
  attempt('panoptes-yaml', panoptesYamlCodec, panoptesYamlDiscriminators),
];

/**
 * A text as the model it holds, read by whichever registered codec claims
 * it, with that codec beside the result so a later write goes back through
 * the same one. A file name is never consulted: a Panoptes model saved as
 * `.json` and a Threat Dragon model saved as nothing at all are both
 * ordinary, so the content decides.
 *
 * Detection is the reads themselves, in the order the registry lists them.
 * A codec claims a text when its read succeeds, when the mapping fails
 * (`InvalidModel`), or when its wire schema refuses the document over
 * something other than the root keys that name the format, which the
 * registry lists beside each codec. It does not claim when the text is not
 * the format's syntax at all (`MalformedText`), nor when the schema's
 * complaint is at one of those naming keys or above them, a text that is no
 * mapping at all being no format's file.
 *
 * A document that has lost a whole naming key is therefore claimed by
 * nobody, where the same document broken one level under a naming key is
 * claimed and refused: a Threat Dragon file whose `summary` has gone is
 * likelier a file of some other tool that stamps a version, and one whose
 * `summary.title` has gone is a broken file of this one. Once a codec
 * claims, its answer stands: a failure comes back as that codec's own
 * failure rather than falling through to the next codec, so a broken file
 * of a known format is reported where it broke.
 *
 * A read bound stops detection outright, ahead of any question of
 * claiming. What a text costs to read is a property of the text and not of
 * a format, so an `ExceededReadLimit` comes back as the answer and no
 * further codec is offered the text: the next codec would spend the same
 * cost to learn the same thing.
 *
 * The order is a cost decision and either order is correct. JSON is YAML,
 * so trying Panoptes YAML first runs the YAML parser over every Threat
 * Dragon file before the schema refuses it at `formatVersion`, where trying
 * Threat Dragon first stops on a YAML file at the first character JSON
 * cannot begin with. Threat Dragon goes first.
 *
 * Where no codec claims, the failure is {@link DetectionFailure} naming
 * every format tried, in order, and carrying no codec's issues. A file
 * neither codec models lands there, a `formatVersion` other than 1 and a
 * Threat Dragon version outside major 2 among them, so a later release of
 * either format needs a codec of its own rather than a looser reader.
 */
export function readAnyFormat(
  text: string,
): Either.Either<DetectedRead, ReadFailure | DetectionFailure> {
  for (const entry of registry) {
    const answer = entry.read(text);
    if (answer !== undefined) {
      return answer;
    }
  }
  return Either.left(
    DetectionFailure.NoFormatClaimed({
      tried: registry.map((entry) => entry.format),
    }),
  );
}

function attempt<Name extends FormatName, WireSchema extends z.ZodType<object>>(
  format: Name,
  codec: Codec<WireSchema>,
  discriminators: readonly DiscriminatorPath[],
) {
  return {
    format,
    read: (text: string) => {
      const reading = codec.read(text);
      if (Either.isRight(reading)) {
        return Either.right({ format, codec, ...reading.right });
      }
      return verdictOn(reading.left, discriminators) === 'declined'
        ? undefined
        : Either.left(reading.left);
    },
  };
}

function verdictOn(
  failure: ReadFailure,
  discriminators: readonly DiscriminatorPath[],
): Verdict {
  return ReadFailure.$match(failure, {
    ExceededReadLimit: (): Verdict => 'bounded',
    MalformedText: (): Verdict => 'declined',
    InvalidWireDocument: ({ issues }): Verdict =>
      issues.some((issue) =>
        discriminators.some((discriminator) =>
          atOrAbove(issue.path, discriminator),
        ),
      )
        ? 'declined'
        : 'claimed',
    InvalidModel: (): Verdict => 'claimed',
  });
}

function atOrAbove(
  issue: readonly (string | number)[],
  discriminator: DiscriminatorPath,
): boolean {
  return (
    issue.length <= discriminator.length &&
    issue.every((segment, index) => segment === discriminator[index])
  );
}
