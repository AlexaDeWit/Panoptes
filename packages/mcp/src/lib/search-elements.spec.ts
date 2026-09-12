import { answerOf, ecluseWorkspace, refusalOf } from './read-tools.fixtures.js';
import { renderElementSearch, searchElements } from './search-elements.js';
import { searchLimits } from './search.js';

const ecluse = ecluseWorkspace();

const search = (args: Parameters<typeof searchElements>[1]) =>
  answerOf(searchElements(ecluse, args));

describe('what saer_search_elements finds', () => {
  it('matches every element of the fixture where nothing narrows it', () => {
    const found = search({ response_format: 'concise' });
    expect(found.counts.matched).toBe(38);
  });

  it('keeps only the kind a call names', () => {
    const found = search({ kind: 'store', response_format: 'concise' });
    expect(found.elements.map((row) => row.kind)).toEqual(
      found.elements.map(() => 'store'),
    );
  });

  it('counts the threats recorded against each element', () => {
    const found = search({ response_format: 'concise' });
    expect(
      found.elements.some((row) => row.threats > 0) &&
        found.elements.every((row) => row.threats >= 0),
    ).toBe(true);
  });

  it('adds the geometry of each kind where detail is asked for', () => {
    const [flow] = search({
      kind: 'flow',
      response_format: 'detailed',
    }).elements;
    expect(flow?.source).toBeDefined();
    expect(flow?.target).toBeDefined();
  });

  it('leaves the geometry out of a concise row', () => {
    const [flow] = search({
      kind: 'flow',
      response_format: 'concise',
    }).elements;
    expect(flow?.source).toBeUndefined();
  });

  it('matches a query without case against the name', () => {
    const found = search({ query: 'PROXY', response_format: 'concise' });
    expect(found.counts.matched).toBeGreaterThan(0);
  });

  it('cuts a detailed listing at its limit and says the count it matched', () => {
    const found = search({ response_format: 'detailed' });
    expect({
      returned: found.elements.length,
      matched: found.counts.matched,
      truncated: found.counts.truncated,
    }).toEqual({
      returned: searchLimits.detailed,
      matched: 38,
      truncated: true,
    });
  });

  it('steers a cut listing toward a narrower query', () => {
    const rendered = renderElementSearch(
      search({ response_format: 'detailed' }),
    );
    expect(rendered.join('\n')).toContain('Narrow it with');
  });

  it('refuses a diagram the model does not hold', () => {
    expect(
      refusalOf(
        searchElements(ecluse, {
          diagram: 'Nothing',
          response_format: 'concise',
        }),
      )[0],
    ).toContain('holds no diagram named "Nothing"');
  });
});
