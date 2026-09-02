import type {
  BoundaryShape,
  Element,
  Model,
  Point,
  Size,
} from '@panoptes/model';
import {
  panoptesYamlWireSchema,
  type PanoptesYamlDocument,
} from '@panoptes/wire-panoptes-yaml';
import { parse } from 'yaml';
import { ecluseModel, goldenPath } from './panoptes-yaml.fixtures.js';
import { writePanoptesYaml } from './panoptes-yaml-write.js';
import { isRecord } from './records.js';

const parseDocument: (text: string) => unknown = parse;

const written = writePanoptesYaml(ecluseModel);

function backwardsPoint(point: Point): Point {
  return { y: point.y, x: point.x };
}

function backwardsSize(size: Size): Size {
  return { height: size.height, width: size.width };
}

function backwardsShape(shape: BoundaryShape): BoundaryShape {
  return shape.kind === 'box'
    ? {
        size: backwardsSize(shape.size),
        position: backwardsPoint(shape.position),
        kind: 'box',
      }
    : { waypoints: shape.waypoints.map(backwardsPoint), kind: 'curve' };
}

function backwardsElement(element: Element): Element {
  if (element.kind === 'flow') {
    return { ...element, waypoints: element.waypoints.map(backwardsPoint) };
  }
  if (element.kind === 'trust-boundary') {
    return { ...element, shape: backwardsShape(element.shape) };
  }
  return {
    ...element,
    position: backwardsPoint(element.position),
    size: backwardsSize(element.size),
  };
}

const backwardsEcluse: Model = {
  assumptions: ecluseModel.assumptions,
  mitigations: ecluseModel.mitigations,
  lastIssuedThreatNumber: ecluseModel.lastIssuedThreatNumber,
  threats: ecluseModel.threats.map((threat) => ({
    elements: threat.elements,
    mitigation: threat.mitigation,
    description: threat.description,
    status: threat.status,
    severity: threat.severity,
    category: threat.category,
    title: threat.title,
    number: threat.number,
    id: threat.id,
  })),
  diagrams: ecluseModel.diagrams.map((diagram) => ({
    ...diagram,
    elements: diagram.elements.map(backwardsElement),
  })),
  metadata: ecluseModel.metadata,
};

const otherDocument: PanoptesYamlDocument = {
  formatVersion: 1,
  metadata: {
    title: 'Another file entirely',
    owner: '',
    description: '',
    contributors: [],
  },
  diagrams: [],
  threats: [],
  lastIssuedThreatNumber: 0,
  mitigations: [],
  assumptions: [],
};

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function listOf(value: unknown): readonly unknown[] {
  return isList(value) ? value : [];
}

function at(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function keysOf(value: unknown): readonly string[] {
  return isRecord(value) ? Object.keys(value) : [];
}

describe('the Écluse model as a Panoptes YAML file', () => {
  it('matches the golden fixture committed under test-data', async () => {
    await expect(written.output).toMatchFileSnapshot(goldenPath);
  });

  it('reports no divergence, because the format holds the whole model', () => {
    expect(written.divergences).toEqual([]);
  });

  it('writes the root keys in the order the wire schema declares them', () => {
    expect(keysOf(parseDocument(written.output))).toEqual(
      Object.keys(panoptesYamlWireSchema.shape),
    );
  });

  it('leads every element with the kind that tells its variant apart', () => {
    const elements = listOf(
      at(parseDocument(written.output), 'diagrams'),
    ).flatMap((diagram) => listOf(at(diagram, 'elements')));
    expect(elements.length).toBeGreaterThan(0);
    expect(elements.map((element) => keysOf(element)[0])).toEqual(
      elements.map(() => 'kind'),
    );
  });

  it('writes threats in number order, whatever order the model holds', () => {
    const numbers = ecluseModel.threats.map((threat) => threat.number);
    numbers.sort((left, right) => left - right);
    expect(ecluseModel.threats.map((threat) => threat.number)).not.toEqual(
      numbers,
    );
    expect(
      listOf(at(parseDocument(written.output), 'threats')).map((threat) =>
        at(threat, 'number'),
      ),
    ).toEqual(numbers);
  });
});

describe('a Panoptes YAML write', () => {
  it('writes the same bytes whatever order the model was built in', () => {
    expect(writePanoptesYaml(backwardsEcluse).output).toBe(written.output);
  });

  it('cannot be changed by the source document the contract offers', () => {
    expect(writePanoptesYaml(ecluseModel, otherDocument).output).toBe(
      written.output,
    );
  });
});
