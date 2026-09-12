import {
  answerOf,
  crowdedThreats,
  crowdedTree,
  ecluseWorkspace,
  everyRecordTree,
} from './read-tools.fixtures.js';
import { renderThreatSearch, searchThreats } from './search-threats.js';
import { searchLimits } from './search.js';

const ecluse = ecluseWorkspace();

const search = (args: Parameters<typeof searchThreats>[1]) =>
  answerOf(searchThreats(ecluse, args));

describe('what saer_search_threats finds', () => {
  it('matches every threat of the fixture where nothing narrows it', () => {
    expect(search({ response_format: 'concise' }).counts.matched).toBe(29);
  });

  it('keeps only the severity a call names', () => {
    const found = search({ severity: 'high', response_format: 'concise' });
    expect(found.threats.map((row) => row.severity)).toEqual(
      found.threats.map(() => 'high'),
    );
  });

  it('keeps only the threats referencing the element a call names', () => {
    const [any] = search({ response_format: 'concise' }).threats;
    const element = any?.elements[0];
    const found = search({ element, response_format: 'concise' });
    expect(
      found.threats.every((row) => row.elements.some((one) => one === element)),
    ).toBe(true);
  });

  it('matches nothing rather than refusing an element id no element carries', () => {
    expect(
      search({ element: 'no-such-element', response_format: 'concise' }).counts,
    ).toEqual({ matched: 0, returned: 0, truncated: false });
  });

  it('adds the prose of the record where detail is asked for', () => {
    const [threat] = search({
      severity: 'high',
      response_format: 'detailed',
    }).threats;
    expect(threat?.description).toBeDefined();
    expect(threat?.mitigation).toBeDefined();
  });

  it('leaves the prose out of a concise row', () => {
    const [threat] = search({ response_format: 'concise' }).threats;
    expect(threat?.description).toBeUndefined();
  });

  it('cuts a detailed listing at its limit and says the count it matched', () => {
    const found = search({ response_format: 'detailed' });
    expect({
      returned: found.threats.length,
      matched: found.counts.matched,
      truncated: found.counts.truncated,
    }).toEqual({
      returned: searchLimits.detailed,
      matched: 29,
      truncated: true,
    });
  });

  it('names the methodology and the category of each match in its text', () => {
    const rendered = renderThreatSearch(
      search({ severity: 'high', response_format: 'concise' }),
    );
    expect(rendered.join('\n')).toContain('category STRIDE/');
  });
});

describe('a threat under a methodology of its own', () => {
  const rich = everyRecordTree();

  const found = answerOf(
    searchThreats(rich, {
      status: 'accepted-risk',
      response_format: 'detailed',
    }),
  );

  it('keeps only the status a call names', () => {
    expect(found.threats.map((row) => row.status)).toEqual(['accepted-risk']);
  });

  it('names the methodology the model gave it rather than a label', () => {
    expect(renderThreatSearch(found).join('\n')).toContain(
      'category House/process gap',
    );
  });

  it('leaves the prose lines out where the record carries none', () => {
    const rendered = renderThreatSearch(found).join('\n');
    expect(rendered).not.toContain('description:');
    expect(rendered).not.toContain('mitigation:');
  });
});

describe('a concise listing past its limit', () => {
  const crowded = answerOf(
    searchThreats(crowdedTree(), { response_format: 'concise' }),
  );

  it('carries the concise limit and says what it matched', () => {
    expect({
      returned: crowded.threats.length,
      matched: crowded.counts.matched,
      truncated: crowded.counts.truncated,
    }).toEqual({
      returned: searchLimits.concise,
      matched: crowdedThreats,
      truncated: true,
    });
  });

  it('offers a narrower query and not the form it is already in', () => {
    const steering = renderThreatSearch(crowded).join('\n');
    expect(steering).toContain('Narrow it with `status`');
    expect(steering).not.toContain('concise form');
  });

  it('offers the concise form to a detailed listing that was cut', () => {
    expect(
      renderThreatSearch(
        answerOf(searchThreats(crowdedTree(), { response_format: 'detailed' })),
      ).join('\n'),
    ).toContain('or ask for the concise form');
  });
});
