import { autoPlacement } from '@saerskriven/model';
import type { OtmDocument } from '@saerskriven/wire-otm';
import {
  importElement,
  type ImportContext,
  type ImportElement,
} from './import-model.js';
type Component = NonNullable<OtmDocument['components']>[number];
type Zone = NonNullable<OtmDocument['trustZones']>[number];

/** Imports all OTM graph records using the first diagram representation where available. */
export function otmGraph(document: OtmDocument, context: ImportContext) {
  const { fields, report } = context;
  const components = document.components ?? [];
  const componentIndex = context.index(
    components,
    (item) => item.id,
    'components',
  );
  const assets = context.index(
    document.assets ?? [],
    (item) => item.id,
    'assets',
  );
  context.index(document.trustZones ?? [], (item) => item.id, 'trustZones');
  context.index(document.dataflows ?? [], (item) => item.id, 'dataflows');
  context.index(
    document.representations ?? [],
    (item) => item.id,
    'representations',
  );
  const representation = document.representations?.find(
    (item) => item.type === 'diagram',
  );
  if (representation !== undefined)
    fields(representation, ['id', 'name', 'type']);
  const elements: ImportElement[] = [];
  const dataProse = (ids: readonly (string | null)[], path: string): string =>
    context.text(
      ids.flatMap((id) => {
        if (id === null) return [];
        const asset = assets.get(id);
        if (asset === undefined) {
          context.problem([path], `Unknown asset ${JSON.stringify(id)}`);
          return [];
        }
        fields(asset, ['id', 'name', 'description']);
        return context.text([asset.name, asset.description ?? ''], ': ');
      }),
      '\n',
    );
  for (const component of components) {
    fields(component, [
      'id',
      'name',
      'description',
      'type',
      'representations',
      'assets',
      'threats',
    ]);
    const id = context.id('otm-component', component.id);
    const data = component.assets;
    if (data !== null && data !== undefined)
      fields(data, ['processed', 'stored']);
    const description = context.text([
      component.description ?? '',
      `Source component type: ${component.type}`,
      dataProse(data?.processed ?? [], 'components.assets.processed'),
      dataProse(data?.stored ?? [], 'components.assets.stored'),
    ]);
    elements.push({
      ...importElement(context, id, component.name, description),
      kind: 'process',
      ...otmGeometry(component, representation?.id, elements.length, context),
    });
  }
  if (components.length > 0)
    report(
      'OTM component types become process nodes. Their original types remain in the descriptions.',
    );
  for (const zone of document.trustZones ?? []) {
    fields(zone, ['id', 'name', 'description', 'representations']);
    elements.push({
      ...importElement(
        context,
        context.id('otm-zone', zone.id),
        zone.name,
        zone.description ?? '',
      ),
      kind: 'trust-boundary',
      shape: {
        kind: 'box',
        ...otmGeometry(zone, representation?.id, elements.length, context),
      },
    });
  }
  for (const flow of document.dataflows ?? []) {
    fields(flow, [
      'id',
      'name',
      'description',
      'source',
      'destination',
      'bidirectional',
      'assets',
      'threats',
    ]);
    for (const endpoint of [flow.source, flow.destination]) {
      if (!componentIndex.has(endpoint))
        context.problem(
          ['dataflows', flow.id],
          `Unknown component ${JSON.stringify(endpoint)}`,
        );
    }
    elements.push({
      ...importElement(
        context,
        context.id('otm-flow', flow.id),
        flow.name,
        context.text([
          flow.description ?? '',
          dataProse(flow.assets ?? [], 'dataflows.assets'),
        ]),
      ),
      kind: 'flow',
      source: {
        kind: 'attached',
        element: context.id('otm-component', flow.source),
      },
      target: {
        kind: 'attached',
        element: context.id('otm-component', flow.destination),
      },
      waypoints: [],
      bidirectional: flow.bidirectional === true,
    });
  }
  if (assets.size > 0)
    report(
      'Referenced asset names become descriptions on flows and components. Shared data identity is not retained.',
    );
  return { elements, title: representation?.name ?? document.project.name };
}

function otmGeometry(
  item: Component | Zone,
  representation: string | undefined,
  index: number,
  context: ImportContext,
) {
  const appearance = item.representations?.find(
    (entry) => entry.representation === representation,
  );
  if (appearance !== undefined) {
    context.fields(appearance, ['representation', 'id', 'position', 'size']);
    if (appearance.position != null)
      context.fields(appearance.position, ['x', 'y']);
    if (appearance.size != null)
      context.fields(appearance.size, ['width', 'height']);
  }
  if (appearance?.position == null || appearance.size == null)
    context.report(
      `Element ${JSON.stringify(item.id)} receives generated geometry where the source has none.`,
      'overridden',
    );
  return {
    position: appearance?.position ?? autoPlacement(index),
    size: appearance?.size ?? { width: 180, height: 80 },
  };
}
