import { Either } from 'effect';
import { emptyModel } from './empty.js';
import { parseModel } from './parse.js';

describe('emptyModel', () => {
  it('parses, and holds nothing', () => {
    expect(Either.isRight(parseModel(emptyModel))).toBe(true);
    expect(emptyModel.diagrams).toEqual([]);
    expect(emptyModel.threats).toEqual([]);
    expect(emptyModel.mitigations).toEqual([]);
    expect(emptyModel.assumptions).toEqual([]);
    expect(emptyModel.lastIssuedThreatNumber).toBe(0);
  });
});
