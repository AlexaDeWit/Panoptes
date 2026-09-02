import type {
  Actor,
  BoxBoundaryShape,
  CurveBoundaryShape,
  Element,
  ElementId,
  Flow,
  FlowEndpoint,
  Point,
  Process,
  Size,
  Store,
  TextElement,
  TrustBoundary,
} from '@panoptes/model';
import type { Divergence } from './divergence.js';
import { equivalent } from './equivalence.js';
import {
  isAnchored,
  type ThreatDragonBoundary,
  type ThreatDragonCurve,
  type ThreatDragonNode,
} from './threat-dragon-document.js';
import {
  preservedFlag,
  preservedList,
  preservedText,
} from './threat-dragon-preservation.js';
import { fromThreatStatus } from './threat-dragon-vocabulary.js';
import type {
  ThreatDragonBaseData,
  ThreatDragonCell,
  ThreatDragonElementData,
  ThreatDragonEndpoint,
  ThreatDragonThreat,
} from './threat-dragon-wire.js';

const openStatus = fromThreatStatus('open');

/** A cell as a merge produced it, and what producing it cost. */
export type MergedCell = {
  readonly cell: ThreatDragonCell;
  readonly divergences: readonly Divergence[];
};

/**
 * One element of the model as the cell Threat Dragon draws it, merged onto
 * the cell of the same id where the source document holds one. Each shape
 * is built as its own wire variant, so what the cell carries and what its
 * `data` declares cannot drift apart, and the styling, ports, tools and
 * per-type flags the model never held come through the merge untouched.
 *
 * Where the source holds a cell of that id under another shape, an edit has
 * changed what the element is: the cell is drawn afresh and what the old one
 * carried is reported as `discarded-by-edit`. `zIndex` is required of a cell
 * by Threat Dragon's own schema and held by no part of the model, so a cell
 * with none takes its place in the diagram as its plane.
 *
 * Four places the two formats hold one fact differently. A boundary curve
 * keeps whichever of the two shape names the source used, since Threat
 * Dragon registers the misspelled `trust-broundary-curve` itself and a model
 * carrying it should not be corrected into a name its author never wrote. A
 * curve's run of waypoints is the model's one list where Threat Dragon holds
 * a source, a target, and the vertices between, so a run the source already
 * draws is left as it drew it. A boundary takes its name from the label on
 * the cell where `data` holds none, which is where the Écluse model keeps
 * every boundary name, so a name that still reads back the same leaves both
 * alone. And `hasOpenThreats` is Threat Dragon's own bookkeeping, which its
 * own files carry stale, so a cell that declares it keeps what it declared
 * and only a cell declaring none is given what the threats being written
 * say.
 */
export function mergeCell(
  element: Element,
  held: ThreatDragonCell | undefined,
  threats: readonly ThreatDragonThreat[],
  index: number,
): MergedCell {
  if (element.kind === 'actor') {
    const from = held?.shape === 'actor' ? held : undefined;
    return {
      cell: {
        ...from,
        ...nodeParts(element, from, index),
        shape: 'actor',
        data: {
          ...from?.data,
          ...elementData(element, from?.data, threats),
          type: 'tm.Actor',
        },
      },
      divergences: reshaped(element, held, from),
    };
  }
  if (element.kind === 'process') {
    const from = held?.shape === 'process' ? held : undefined;
    return {
      cell: {
        ...from,
        ...nodeParts(element, from, index),
        shape: 'process',
        data: {
          ...from?.data,
          ...elementData(element, from?.data, threats),
          type: 'tm.Process',
        },
      },
      divergences: reshaped(element, held, from),
    };
  }
  if (element.kind === 'store') {
    const from = held?.shape === 'store' ? held : undefined;
    return {
      cell: {
        ...from,
        ...nodeParts(element, from, index),
        shape: 'store',
        data: {
          ...from?.data,
          ...elementData(element, from?.data, threats),
          type: 'tm.Store',
        },
      },
      divergences: reshaped(element, held, from),
    };
  }
  if (element.kind === 'flow') {
    const from = held?.shape === 'flow' ? held : undefined;
    return {
      cell: {
        ...from,
        id: element.id,
        zIndex: from?.zIndex ?? index + 1,
        shape: 'flow',
        source: preservedEndpoint(from?.source, element.source),
        target: preservedEndpoint(from?.target, element.target),
        vertices: preservedList(from?.vertices, element.waypoints),
        data: {
          ...from?.data,
          ...elementData(element, from?.data, threats),
          type: 'tm.Flow',
        },
      },
      divergences: reshaped(element, held, from),
    };
  }
  if (element.kind === 'text') {
    const from = held?.shape === 'td-text-block' ? held : undefined;
    const shown = from?.data.name ?? from?.attrs?.text?.text ?? '';
    return {
      cell: {
        ...from,
        id: element.id,
        zIndex: from?.zIndex ?? index + 1,
        shape: 'td-text-block',
        position: element.position,
        size: element.size,
        data: {
          ...from?.data,
          name: shown === element.text ? from?.data.name : element.text,
          description: preservedText(
            from?.data.description,
            element.description,
          ),
          hasOpenThreats: from?.data.hasOpenThreats ?? false,
          type: 'tm.Text',
        },
      },
      divergences: [
        ...reshaped(element, held, from),
        ...unlabelled(element),
        ...unscoped(element),
      ],
    };
  }
  return element.shape.kind === 'box'
    ? boxBoundary(element, element.shape, held, index)
    : curveBoundary(element, element.shape, held, index);
}

function boxBoundary(
  element: TrustBoundary,
  shape: BoxBoundaryShape,
  held: ThreatDragonCell | undefined,
  index: number,
): MergedCell {
  const from = held?.shape === 'trust-boundary-box' ? held : undefined;
  return {
    cell: {
      ...from,
      id: element.id,
      zIndex: from?.zIndex ?? index + 1,
      shape: 'trust-boundary-box',
      position: shape.position,
      size: shape.size,
      data: {
        ...from?.data,
        ...boundaryData(element, from),
        type: 'tm.BoundaryBox',
      },
    },
    divergences: [...reshaped(element, held, from), ...unscoped(element)],
  };
}

function curveBoundary(
  element: TrustBoundary,
  shape: CurveBoundaryShape,
  held: ThreatDragonCell | undefined,
  index: number,
): MergedCell {
  const from =
    held?.shape === 'trust-boundary-curve' ||
    held?.shape === 'trust-broundary-curve'
      ? held
      : undefined;
  const data: ThreatDragonCurve['data'] = {
    ...from?.data,
    ...boundaryData(element, from),
    type: 'tm.Boundary',
  };
  const body = {
    id: element.id,
    zIndex: from?.zIndex ?? index + 1,
    ...curvePoints(from, shape),
    data,
  };
  return {
    cell:
      from?.shape === 'trust-broundary-curve'
        ? { ...from, ...body, shape: 'trust-broundary-curve' }
        : { ...from, ...body, shape: 'trust-boundary-curve' },
    divergences: [...reshaped(element, held, from), ...unscoped(element)],
  };
}

function curvePoints(
  from: ThreatDragonCurve | undefined,
  shape: CurveBoundaryShape,
): { source: Point; target: Point; vertices: Point[] | undefined } {
  const waypoints = shape.waypoints;
  const drawn =
    from === undefined
      ? undefined
      : [from.source, ...(from.vertices ?? []), from.target];
  return from !== undefined && equivalent(drawn, waypoints)
    ? { source: from.source, target: from.target, vertices: from.vertices }
    : {
        source: { ...waypoints[0] },
        target: { ...waypoints[waypoints.length - 1] },
        vertices: waypoints.slice(1, -1),
      };
}

function nodeParts(
  element: Actor | Process | Store,
  from: ThreatDragonNode | undefined,
  index: number,
): { id: ElementId; zIndex: number; position: Point; size: Size } {
  return {
    id: element.id,
    zIndex: from?.zIndex ?? index + 1,
    position: element.position,
    size: element.size,
  };
}

function elementData(
  element: Actor | Process | Store | Flow,
  from: ThreatDragonElementData | undefined,
  threats: readonly ThreatDragonThreat[],
): ThreatDragonElementData {
  return {
    name: preservedText(from?.name, element.name),
    description: preservedText(from?.description, element.description),
    outOfScope: preservedFlag(from?.outOfScope, element.outOfScope),
    reasonOutOfScope: preservedText(
      from?.reasonOutOfScope,
      element.reasonOutOfScope,
    ),
    hasOpenThreats:
      from?.hasOpenThreats ??
      threats.some((threat) => threat.status === openStatus),
    threats: preservedList(from?.threats, threats),
  };
}

function boundaryData(
  element: TrustBoundary,
  from: ThreatDragonBoundary | undefined,
): ThreatDragonBaseData {
  const shown = from?.data.name ?? from?.attrs?.label?.text ?? '';
  return {
    name: shown === element.name ? from?.data.name : element.name,
    description: preservedText(from?.data.description, element.description),
    hasOpenThreats: from?.data.hasOpenThreats ?? false,
    isTrustBoundary: from?.data.isTrustBoundary ?? true,
  };
}

function preservedEndpoint(
  from: ThreatDragonEndpoint | undefined,
  wanted: FlowEndpoint,
): ThreatDragonEndpoint {
  return from !== undefined && holdsEndpoint(from, wanted)
    ? from
    : projectEndpoint(wanted);
}

function holdsEndpoint(
  from: ThreatDragonEndpoint,
  wanted: FlowEndpoint,
): boolean {
  return isAnchored(from)
    ? wanted.kind === 'attached' && from.cell === wanted.element
    : wanted.kind === 'free' && equivalent(from, wanted.position);
}

function projectEndpoint(wanted: FlowEndpoint): ThreatDragonEndpoint {
  return wanted.kind === 'attached'
    ? { cell: wanted.element }
    : { ...wanted.position };
}

function unlabelled(element: TextElement): readonly Divergence[] {
  return element.name === ''
    ? []
    : [
        {
          subject: { kind: 'element', id: element.id },
          detail: `the name "${element.name}", which the format has one text for a note and no name beside it`,
          reason: 'unrepresentable',
        },
      ];
}

function unscoped(element: TextElement | TrustBoundary): readonly Divergence[] {
  return element.outOfScope || element.reasonOutOfScope !== ''
    ? [
        {
          subject: { kind: 'element', id: element.id },
          detail:
            'the out-of-scope marking, which the format records on the elements a threat attaches to alone',
          reason: 'unrepresentable',
        },
      ]
    : [];
}

function reshaped(
  element: Element,
  held: ThreatDragonCell | undefined,
  from: ThreatDragonCell | undefined,
): readonly Divergence[] {
  return held !== undefined && from === undefined
    ? [
        {
          subject: { kind: 'element', id: element.id },
          detail: `what the source held on the ${held.shape} cell of this id, which now draws a ${element.kind}`,
          reason: 'discarded-by-edit',
        },
      ]
    : [];
}
