import { autoExtent, autoPlacement } from '@saerskriven/model';
import type { TmbomDocument } from '@saerskriven/wire-tmbom';
import {
  importElement,
  type ImportContext,
  type ImportElement,
} from './import-model.js';
type SourceNode =
  | TmbomDocument['actors'][number]
  | TmbomDocument['components'][number]
  | TmbomDocument['data_stores'][number];
type Endpoint = TmbomDocument['data_flows'][number]['source'];

/** Lays out the graph records without interpreting embedded diagram languages. */
export function tmbomGraph(document: TmbomDocument, context: ImportContext) {
  const { fields, report } = context;
  const actorIndex = context.index(
    document.actors,
    (node) => node.symbolic_name,
    'actors',
  );
  const componentIndex = context.index(
    document.components,
    (node) => node.symbolic_name,
    'components',
  );
  const storeIndex = context.index(
    document.data_stores,
    (node) => node.symbolic_name,
    'data_stores',
  );
  const zoneIndex = context.index(
    document.trust_zones,
    (zone) => zone.symbolic_name,
    'trust_zones',
  );
  context.index(
    document.data_flows,
    (flow) => flow.symbolic_name,
    'data_flows',
  );
  context.index(document.data_sets, (data) => data.symbolic_name, 'data_sets');
  const descriptions = dataDescriptions(document, storeIndex, context);
  const nodes = [
    ...document.actors.map((source) => ({ source, kind: 'actor' as const })),
    ...document.components.map((source) => ({
      source,
      kind: 'process' as const,
    })),
    ...document.data_stores.map((source) => ({
      source,
      kind: 'store' as const,
    })),
  ];
  const elements: ImportElement[] = [];
  let top = 20;
  const groups = new Map<string | undefined, typeof nodes>();
  for (const node of nodes) {
    const zone =
      'trust_zone' in node.source ? node.source.trust_zone : undefined;
    if (zone !== undefined && !zoneIndex.has(zone))
      context.problem(
        ['trust_zone'],
        `Unknown trust zone ${JSON.stringify(zone)}`,
      );
    const group = groups.get(zone) ?? [];
    group.push(node);
    groups.set(zone, group);
  }
  for (const zone of document.trust_zones)
    if (!groups.has(zone.symbolic_name)) groups.set(zone.symbolic_name, []);
  for (const [zoneName, members] of groups) {
    const height = 100 + Math.max(1, Math.ceil(members.length / 4)) * 160;
    const zone = zoneName === undefined ? undefined : zoneIndex.get(zoneName);
    if (zone !== undefined) {
      fields(zone, ['symbolic_name', 'title', 'description']);
      elements.push({
        ...importElement(
          context,
          context.id('tmbom-zone', zone.symbolic_name),
          zone.title,
          zone.description,
        ),
        kind: 'trust-boundary',
        shape: {
          kind: 'box',
          position: { x: 20, y: top },
          size: { width: 1080, height },
        },
      });
    }
    for (const [index, { source, kind }] of members.entries()) {
      const placed = autoPlacement(index);
      fields(source, ['symbolic_name', 'title', 'description']);
      if ('trust_zone' in source) fields(source, ['trust_zone']);
      elements.push({
        ...importElement(
          context,
          tmbomNodeId(kind, source.symbolic_name, context),
          source.title,
          context.text([
            source.description,
            ...(kind === 'store'
              ? (descriptions.get(source.symbolic_name) ?? [])
              : []),
          ]),
        ),
        kind,
        position: { x: placed.x, y: top + placed.y },
        size: autoExtent,
      });
    }
    top += height + 80;
  }
  const endpoint = (given: Endpoint): string => {
    fields(given, ['type', 'object']);
    const type = given.type.replace(/^#\/\$defs\//u, '').replaceAll('_', '-');
    const kind =
      type === 'actor'
        ? 'actor'
        : type === 'component'
          ? 'process'
          : type === 'data-store'
            ? 'store'
            : undefined;
    const index =
      kind === 'actor'
        ? actorIndex
        : kind === 'process'
          ? componentIndex
          : kind === 'store'
            ? storeIndex
            : undefined;
    if (kind === undefined || index === undefined || !index.has(given.object))
      context.problem(
        ['data_flows'],
        `Unknown endpoint ${JSON.stringify(given)}`,
      );
    return tmbomNodeId(kind ?? 'process', given.object, context);
  };
  for (const flow of document.data_flows) {
    fields(flow, [
      'symbolic_name',
      'title',
      'description',
      'source',
      'destination',
      'encrypted',
      'has_sensitive_data',
    ]);
    elements.push({
      ...importElement(
        context,
        context.id('tmbom-flow', flow.symbolic_name),
        flow.title,
        `${flow.description}\n\nEncrypted: ${String(flow.encrypted)}\nCarries sensitive data: ${String(flow.has_sensitive_data)}`,
      ),
      kind: 'flow',
      source: { kind: 'attached', element: endpoint(flow.source) },
      target: { kind: 'attached', element: endpoint(flow.destination) },
      waypoints: [],
      bidirectional: false,
    });
  }
  if (nodes.length > 0)
    report(
      'The diagram receives generated geometry grouped by source trust zone. Membership becomes visual.',
      'overridden',
    );
  if (document.data_flows.length > 0)
    report(
      'Flow encryption and sensitivity fields remain prose in the flow descriptions.',
    );
  return elements;
}

/** Maintains separate source namespaces for actors, components, and stores. */
export function tmbomNodeId(
  kind: 'actor' | 'process' | 'store',
  id: string,
  context: ImportContext,
): string {
  return context.id(`tmbom-${kind}`, id);
}

function dataDescriptions(
  document: TmbomDocument,
  stores: ReadonlyMap<string, SourceNode>,
  context: ImportContext,
) {
  const descriptions = new Map<string, string[]>();
  for (const data of document.data_sets) {
    context.fields(data, [
      'symbolic_name',
      'title',
      'description',
      'placements',
    ]);
    let placements = 0;
    for (const placement of data.placements) {
      if (placement.data_store === undefined) continue;
      context.fields(placement, ['data_store']);
      if (!stores.has(placement.data_store))
        context.problem(
          ['data_sets', data.symbolic_name, 'placements'],
          `Unknown data store ${JSON.stringify(placement.data_store)}`,
        );
      const prose = descriptions.get(placement.data_store) ?? [];
      prose.push(context.text([data.title, data.description], ': '));
      descriptions.set(placement.data_store, prose);
      placements += 1;
    }
    context.report(
      placements > 0
        ? `Data set ${JSON.stringify(data.symbolic_name)} becomes prose on its stores. Shared data identity is not retained.`
        : `Data set ${JSON.stringify(data.symbolic_name)} has no store placement and is not retained.`,
      'unrepresentable',
    );
  }
  return descriptions;
}
