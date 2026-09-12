import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { autoPlacement } from '@saerskriven/model';
import { Either } from 'effect';
import { stringify } from 'yaml';
import { importModel } from './import.js';
import { importTexts, otmFixture, tmbomFixture } from './import.fixtures.js';
import { readLimits } from './read-limits.js';
import { saerskrivenYamlCodec } from './saerskriven-yaml.js';

it.each(['otm', 'tmbom'] as const)(
  'imports the upstream %s graph into a native file in JSON or YAML syntax',
  (format) => {
    const imported = Either.getOrThrowWith(
      importModel(importTexts[format]),
      (failure) => new Error(JSON.stringify(failure)),
    );
    const yaml = stringify(JSON.parse(importTexts[format]) as unknown);
    expect(Either.getOrThrow(importModel(yaml))).toEqual(imported);
    expect(imported.format).toBe(format);
    expect(
      imported.model.diagrams[0].elements.filter(
        (element) => element.kind === 'flow',
      ),
    ).toHaveLength(format === 'otm' ? 2 : 9);
    expect(imported.model.threats).toHaveLength(format === 'otm' ? 2 : 27);
    expect(imported.model.mitigations.length).toBeGreaterThan(0);
    expect(imported).not.toHaveProperty('source');
    const written = saerskrivenYamlCodec.write(imported.model);
    expect(written.divergences).toEqual([]);
    expect(
      Either.getOrThrow(saerskrivenYamlCodec.read(written.output)).model,
    ).toEqual(imported.model);
    expect(imported.divergences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'unrepresentable' }),
      ]),
    );
  },
);

it('places an OTM component the diagram representation misses on the shared grid', () => {
  const read = Either.getOrThrow(importModel(importTexts.otm));
  const placed = read.model.diagrams[0].elements.find(
    (element) => element.name === 'Class CustomerDatabase',
  );
  expect(placed).toMatchObject({ position: autoPlacement(3) });
  expect(read.divergences).toEqual(
    expect.arrayContaining([expect.objectContaining({ reason: 'overridden' })]),
  );
});

it('keeps differing OTM occurrence states, bidirectional flows, and asset names', () => {
  const document = otmFixture();
  const component = document.components?.find(
    (entry) => (entry.threats?.length ?? 0) > 0,
  );
  const occurrence = component?.threats?.[0];
  expect(occurrence).toBeDefined();
  if (occurrence === undefined) return;
  occurrence.state = 'mitigated';
  const oneWay = document.dataflows?.[0];
  expect(oneWay).toBeDefined();
  if (oneWay === undefined) return;
  delete oneWay.bidirectional;
  const read = Either.getOrThrow(importModel(JSON.stringify(document)));
  expect(read.model.threats.map((threat) => threat.status)).toEqual([
    'mitigated',
    'open',
  ]);
  expect(read.model.threats.map((threat) => threat.elements.length)).toEqual([
    1, 1,
  ]);
  expect(
    read.model.mitigations.slice(0, 2).map((mitigation) => mitigation.status),
  ).toEqual(['implemented', 'proposed']);
  expect(
    read.model.diagrams[0].elements
      .filter((element) => element.kind === 'flow')
      .some((flow) => flow.description.includes('Credit')),
  ).toBe(true);
  expect(
    read.model.diagrams[0].elements.flatMap((element) =>
      element.kind === 'flow' ? [element.bidirectional] : [],
    ),
  ).toEqual([false, true]);
  expect(
    read.divergences.filter((entry) => entry.reason === 'split'),
  ).toHaveLength(2);
});

it('reports undeclared fields and does not turn OTM numeric impact into a severity score', () => {
  const document = otmFixture();
  const read = Either.getOrThrow(
    importModel(
      JSON.stringify({ ...document, futureField: 'retained nowhere' }),
    ),
  );
  expect(
    read.model.threats.every((threat) => threat.severity === 'undecided'),
  ).toBe(true);
  expect(read.divergences).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        reason: 'undeclared',
        detail: 'the key futureField',
      }),
    ]),
  );
  expect(read.divergences.some((entry) => entry.detail.includes('risk'))).toBe(
    true,
  );
});

it('keeps unconfirmed TM-BOM assumptions as prose and preserves expressible statuses', () => {
  const document = tmbomFixture();
  document.assumptions = [
    { description: 'The worker may retry.', validity: 'unconfirmed' },
    { description: 'The queue is durable.', validity: 'confirmed' },
    { description: 'Every client authenticates.', validity: 'rejected' },
  ];
  const read = Either.getOrThrow(importModel(JSON.stringify(document)));
  expect(read.model.assumptions.map((assumption) => assumption.status)).toEqual(
    ['valid', 'invalidated'],
  );
  expect(read.model.metadata.description).toContain('The worker may retry.');
  expect(
    read.divergences.some((entry) => entry.detail.includes('unconfirmed')),
  ).toBe(true);
});

it('validates the different TM-BOM 1.0.2 requirements', () => {
  const document = tmbomFixture();
  const newer = {
    ...document,
    $schema:
      'https://github.com/OWASP/www-project-threat-model-library/blob/v1.0.2/threat-model.schema.json',
    actors: document.actors.map((actor) => ({
      ...actor,
      trust_zone: document.trust_zones[0].symbolic_name,
    })),
    data_stores: document.data_stores.map((store) => ({
      ...store,
      trust_zone: document.trust_zones[0].symbolic_name,
    })),
    risks: [],
  };
  expect(Either.isRight(importModel(JSON.stringify(newer)))).toBe(true);
  expect(
    Either.isLeft(
      importModel(
        JSON.stringify({
          ...newer,
          actors: newer.actors.map(({ trust_zone: _zone, ...actor }) => actor),
        }),
      ),
    ),
  ).toBe(true);
});

it.each(['duplicate', 'dangling'] as const)(
  'refuses %s OTM graph references',
  (kind) => {
    const document = otmFixture();
    if (kind === 'duplicate') document.components?.push(document.components[0]);
    else if (document.dataflows?.[0] !== undefined)
      document.dataflows[0].source = 'absent';
    expect(importModel(JSON.stringify(document))).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'InvalidWireDocument' },
    });
  },
);

it('refuses unknown TM-BOM endpoint types and dangling threat targets', () => {
  const document = tmbomFixture();
  document.data_flows[0].source.type = 'unsupported';
  expect(importModel(JSON.stringify(document))).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'InvalidWireDocument' },
  });
  const dangling = tmbomFixture();
  if (dangling.threats?.[0] !== undefined)
    dangling.threats[0].components_affected = ['absent'];
  expect(Either.isLeft(importModel(JSON.stringify(dangling)))).toBe(true);
});

it.each(['0.3.0', '1.0.0'])(
  'refuses unadopted OTM version %s',
  (otmVersion) => {
    expect(
      Either.isLeft(
        importModel(JSON.stringify({ ...otmFixture(), otmVersion })),
      ),
    ).toBe(true);
  },
);

it('enforces the existing size, depth, and alias limits on imports', () => {
  for (const text of [
    ' '.repeat(readLimits.maxTextBytes + 1),
    '['.repeat(100) + '0' + ']'.repeat(100),
    'a: &a [*a]',
  ]) {
    expect(importModel(text)).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'ExceededReadLimit' },
    });
  }
  expect(importModel('otmVersion: [')).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'MalformedText' },
  });
});

it('rejects the upstream Vault example with dangling trust-zone references', () => {
  const text = readFileSync(
    join(
      import.meta.dirname,
      '../../../../test-data/tmbom/vault-invalid-zones.json',
    ),
    'utf8',
  );
  const result = importModel(text);
  expect(result).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'InvalidWireDocument' },
  });
  const messages = Either.match(result, {
    onLeft: (failure) =>
      failure._tag === 'InvalidWireDocument'
        ? failure.issues.map((issue) => issue.message)
        : [],
    onRight: () => [],
  });
  expect(messages).toContain('Unknown trust zone "public-internet"');
});

it('identifies an unsupported import before reporting schema fields', () => {
  expect(importModel('An unrelated document')).toMatchObject({
    _tag: 'Left',
    left: {
      _tag: 'InvalidWireDocument',
      issues: [{ code: 'invalid_format', path: [] }],
    },
  });
});

it.each(['assets', 'threats', 'mitigations'] as const)(
  'bounds OTM %s reference expansion before producing a native model',
  (kind) => {
    const document = otmFixture();
    const repeated = 'x'.repeat(65_536);
    const component = document.components?.[0];
    const asset = document.assets?.[0];
    const threat = document.threats?.[0];
    const mitigation = document.mitigations?.[0];
    if (
      component === undefined ||
      asset === undefined ||
      threat === undefined ||
      mitigation === undefined
    )
      throw new Error('The upstream fixture lacks its referenced records');
    if (kind === 'assets') {
      asset.name = repeated;
      component.assets = {
        processed: Array.from({ length: 512 }, () => asset.id),
      };
    } else {
      if (kind === 'threats') threat.name = repeated;
      else mitigation.name = repeated;
      component.threats = Array.from({ length: 512 }, () => ({
        threat: threat.id,
        state: 'exposed',
        mitigations: [{ mitigation: mitigation.id, state: 'required' }],
      }));
    }
    const text = JSON.stringify(document);
    expect(text.length).toBeLessThan(readLimits.maxTextBytes);
    expect(importModel(text)).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'ExceededReadLimit', limit: 'maxImportTextUnits' },
    });
  },
);

it('bounds TM-BOM data-placement expansion before joining store descriptions', () => {
  const document = tmbomFixture();
  document.data_sets = [
    {
      symbolic_name: 'repeated-data',
      title: 'x'.repeat(65_536),
      description: 'Data in the store',
      data_sensitivity: ['cred'],
      placements: Array.from({ length: 512 }, () => ({
        data_store: document.data_stores[0].symbolic_name,
      })),
    },
  ];
  const text = JSON.stringify(document);
  expect(text.length).toBeLessThan(readLimits.maxTextBytes);
  expect(importModel(text)).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'ExceededReadLimit', limit: 'maxImportTextUnits' },
  });
});

it('budgets generated OTM identifiers before escaping and repeating them', () => {
  const document = otmFixture();
  const component = document.components?.[0];
  if (component === undefined)
    throw new Error('The upstream fixture lacks a component');
  const old = component.id;
  component.id = 'x'.repeat(1_048_576);
  for (const flow of document.dataflows ?? []) {
    if (flow.source === old) flow.source = component.id;
    if (flow.destination === old) flow.destination = component.id;
  }
  const text = JSON.stringify(document);
  expect(text.length).toBeLessThan(readLimits.maxTextBytes);
  expect(importModel(text)).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'ExceededReadLimit', limit: 'maxImportTextUnits' },
  });
});

it('budgets repeated diagnostic paths from aliased assumptions', () => {
  const document = tmbomFixture();
  const assumption = {
    description: 'A premise',
    validity: 'confirmed' as const,
    ['x'.repeat(262_144)]: true,
  };
  document.assumptions = Array.from({ length: 40 }, () => assumption);
  const text = stringify(document);
  expect(text.length).toBeLessThan(readLimits.maxTextBytes);
  expect(importModel(text)).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'ExceededReadLimit', limit: 'maxImportTextUnits' },
  });
});

it.each(['confirmed', 'unconfirmed'] as const)(
  'bounds repeated %s assumption text from YAML aliases',
  (validity) => {
    const document = tmbomFixture();
    const assumption = { description: 'x'.repeat(1_048_576), validity };
    document.assumptions = Array.from({ length: 40 }, () => assumption);
    const text = stringify(document);
    expect(text.length).toBeLessThan(readLimits.maxTextBytes);
    expect(importModel(text)).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'ExceededReadLimit', limit: 'maxImportTextUnits' },
    });
  },
);

it('bounds aliased descriptions on distinct unattached OTM mitigations', () => {
  const description = 'x'.repeat(1_048_576);
  const aliased = `otmVersion: 0.2.0\nproject: {id: p, name: Project}\nmitigations:\n- id: first\n  name: Mitigation\n  riskReduction: 0\n  description: &description ${description}\n${Array.from({ length: 39 }, (_, index) => `- id: m${String(index)}\n  name: Mitigation\n  riskReduction: 0\n  description: *description\n`).join('')}`;
  expect(aliased.length).toBeLessThan(readLimits.maxTextBytes);
  expect(importModel(aliased)).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'ExceededReadLimit', limit: 'maxImportTextUnits' },
  });
});

it('generates distinct canvas-compatible identifiers for punctuation and Unicode', () => {
  const document = otmFixture();
  document.components = ['a-b', 'a_2d_b', 'a"b', '雪'].map((id) => ({
    id,
    name: id,
    type: 'component',
    parent: { trustZone: 'zone' },
  }));
  document.dataflows = [];
  document.threats = [];
  document.mitigations = [];
  const read = Either.getOrThrow(importModel(JSON.stringify(document)));
  const ids = read.model.diagrams[0].elements.map((element) => element.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every((id) => /^[A-Za-z0-9_-]+$/u.test(id))).toBe(true);
});

it.each([
  ['accepted', 'accepted-risk'],
  ['transferred', 'transferred'],
  ['avoided', 'avoided'],
  ['eliminated', 'eliminated'],
  ['not-applicable', 'not-applicable'],
  ['vendor-pending', 'open'],
] as const)(
  'imports OTM treatment %s as %s and keeps the source label',
  (state, expected) => {
    const document = otmFixture();
    const occurrence = document.components?.flatMap(
      (component) => component.threats ?? [],
    )[0];
    if (occurrence === undefined)
      throw new Error('The fixture lacks a threat occurrence');
    occurrence.state = state;
    const read = Either.getOrThrow(importModel(JSON.stringify(document)));
    expect(read.model.threats[0].status).toBe(expected);
    expect(read.model.threats[0].description).toContain(state);
  },
);

it.each([
  ['implemented', 'implemented'],
  ['verified', 'verified'],
  ['vendor-pending', 'proposed'],
] as const)('imports OTM mitigation state %s as %s', (state, expected) => {
  const document = otmFixture();
  const occurrence = document.components?.flatMap(
    (component) => component.threats ?? [],
  )[0];
  const mitigation = occurrence?.mitigations?.[0];
  if (mitigation == null)
    throw new Error('The fixture lacks a mitigation occurrence');
  mitigation.state = state;
  const read = Either.getOrThrow(importModel(JSON.stringify(document)));
  expect(read.model.mitigations[0].status).toBe(expected);
  expect(read.model.mitigations[0].prose).toContain(state);
});

it.each(['asset', 'threat', 'mitigation'] as const)(
  'refuses an OTM occurrence referencing an absent %s',
  (kind) => {
    const document = otmFixture();
    const component = document.components?.find(
      (entry) => (entry.threats?.length ?? 0) > 0,
    );
    const occurrence = component?.threats?.[0];
    if (component === undefined || occurrence === undefined)
      throw new Error('The fixture lacks a threat occurrence');
    if (kind === 'asset') component.assets = { processed: ['absent'] };
    else if (kind === 'threat') occurrence.threat = 'absent';
    else occurrence.mitigations = [{ mitigation: 'absent', state: 'required' }];
    expect(importModel(JSON.stringify(document))).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'InvalidWireDocument' },
    });
  },
);

it('retains OTM threat definitions that have no occurrences', () => {
  const document = otmFixture();
  for (const component of document.components ?? []) component.threats = [];
  for (const flow of document.dataflows ?? []) flow.threats = [];
  const read = Either.getOrThrow(importModel(JSON.stringify(document)));
  expect(read.model.threats).toHaveLength(1);
  expect(read.model.threats[0].elements).toEqual([]);
  expect(read.model.threats[0].status).toBe('open');
});

it('imports active and pending TM-BOM controls without reviving retired or declined work', () => {
  const document = tmbomFixture();
  const control = document.controls?.[0];
  if (control === undefined) throw new Error('The fixture lacks a control');
  document.controls = [
    {
      ...control,
      symbolic_name: 'active-control',
      title: 'Active work',
      status: 'active',
    },
    {
      ...control,
      symbolic_name: 'retired-control',
      title: 'Retired work',
      status: 'retired',
    },
    {
      ...control,
      symbolic_name: 'declined-control',
      title: 'Declined work',
      status: 'wont_do',
    },
    {
      ...control,
      symbolic_name: 'pending-control',
      title: 'Pending work',
      status: 'under_review',
    },
  ];
  const read = Either.getOrThrow(importModel(JSON.stringify(document)));
  expect(
    read.model.mitigations.map((mitigation) => [
      mitigation.title,
      mitigation.status,
    ]),
  ).toEqual([
    ['Active work', 'implemented'],
    ['Pending work', 'proposed'],
  ]);
  expect(read.model.mitigations[1].prose).toContain('under_review');
});
