import { Either } from 'effect';
import { parseModel, type Model } from './parse.js';

/**
 * A model with nothing in it: metadata blank, every collection empty, and no
 * threat number issued yet. It is where a model that has not been drawn
 * starts, so a caller that needs one takes this rather than writing the
 * shape out again and reaching a Model without the refinements. It comes
 * through {@link parseModel} like every other model does. The parse cannot
 * fail, and were that ever untrue the package would fail to load rather than
 * hand out a value that is no model.
 */
export const emptyModel: Model = Either.getOrThrowWith(
  parseModel({
    metadata: { title: '', owner: '', description: '', contributors: [] },
    diagrams: [],
    threats: [],
    lastIssuedThreatNumber: 0,
    mitigations: [],
    assumptions: [],
  }),
  () => new Error('The empty model does not parse.'),
);
