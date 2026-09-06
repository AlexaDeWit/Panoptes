import { isAlias, isCollection, isNode, isPair } from 'yaml';
import type { parseDocument } from 'yaml';

/**
 * A YAML text composed into a document, before any alias in it is resolved.
 * What its aliases will cost is measured here rather than on the value it
 * resolves to, because resolving them is the cost being bounded.
 */
export type ComposedDocument = ReturnType<typeof parseDocument>;

/**
 * What resolving a document's aliases will cost, each number counted no
 * further than the ceiling it is measured against.
 *
 * `expanded` is how many aliases the resolution works through: one for each
 * alias in the document, plus the expanded aliases inside its anchor's
 * subtree. A cycle expands without end and takes the ceiling at once.
 *
 * `reached` is how much of the document those aliases repeat: the nodes
 * under each alias's anchor, summed over the aliases. It is 0 where
 * `expanded` has already passed its ceiling, since the read stops there and
 * a document past one bound is refused whatever the rest of it holds.
 */
export type AliasCost = {
  readonly expanded: number;
  readonly reached: number;
};

/**
 * What a composed document's aliases will cost, from one traversal of it.
 *
 * This package owns the accounting rather than handing the parser a bound
 * of its own, because the parser's own costs more than what it bounds. An
 * alias in `yaml` resolves by scanning the whole document, and its alias
 * accounting takes that scan once per anchor, so a document nesting anchors
 * within anchors pays it once per level: fifty aliases arranged that way in
 * a 4 MiB text cost three minutes inside the parser, where nothing here can
 * see it. `toJS` is given `maxAliasCount: -1` for that reason, and both
 * numbers below are measured instead.
 *
 * `expanded` stands in for the parser's option rather than reproducing it,
 * bounding the quantity that option exists to bound: counted as a sum over
 * the document, where the parser takes a product per anchor against a
 * maximum over its children. It is measured bottom up, so that the sum
 * costs one traversal: a node's weight is the weight of its children, an
 * alias weighs one plus the weight of its anchor, and an anchor is weighed
 * before any alias can reach it because a YAML anchor precedes its aliases.
 * So every node is weighed once however many aliases repeat it, and an
 * anchor whose weight is still being taken when an alias reaches it has
 * been reached from inside itself, which is a cycle.
 *
 * `reached` is what the count alone does not bound, since a one-node anchor
 * is as cheap to alias as a two-million-node one. What an alias costs there
 * is not a copy, because `toJS` hands every alias to one anchor the same
 * value: it is that the nesting walk expands a node again whenever it
 * reaches that node deeper than before, and an alias is one more place its
 * anchor can be reached from. A node expanded again therefore sits under
 * some alias's anchor, so what the aliases add to that walk is at most this
 * count times the depth bound.
 *
 * The traversal costs the document, once. The counting after it costs the
 * ceilings: a node is counted once under an anchor, so a cycle is measured
 * rather than followed, an anchor is walked once however many aliases
 * repeat it and only as far as those repeats need to pass the ceiling, and
 * neither walk holds more than one node's children past what it can still
 * count.
 */
export function aliasCostIn(
  document: ComposedDocument,
  stopAt: AliasCost,
): AliasCost {
  const weighed = weighAliases(document, stopAt.expanded);
  if (weighed.expanded >= stopAt.expanded) {
    return { expanded: stopAt.expanded, reached: 0 };
  }
  return {
    expanded: weighed.expanded,
    reached: nodesReached(weighed, stopAt.reached),
  };
}

type Level = {
  readonly children: readonly unknown[];
  index: number;
};

type Weighing = Level & {
  readonly weighs: unknown;
  total: number;
};

type Weighed = {
  readonly expanded: number;
  readonly boundTo: ReadonlyMap<unknown, unknown>;
  readonly repeats: ReadonlyMap<unknown, number>;
};

function weighAliases(document: ComposedDocument, stopAt: number): Weighed {
  const named = new Map<string, unknown>();
  const boundTo = new Map<unknown, unknown>();
  const repeats = new Map<unknown, number>();
  const weight = new Map<unknown, number>();
  const open = new Set<unknown>();
  const levels: Weighing[] = [
    { children: [document.contents], index: 0, weighs: undefined, total: 0 },
  ];
  let expanded = 0;
  while (levels.length > 0) {
    const level = levels[levels.length - 1];
    if (level.index >= level.children.length) {
      levels.pop();
      if (level.weighs !== undefined) {
        weight.set(level.weighs, level.total);
        open.delete(level.weighs);
      }
      if (levels.length === 0) {
        expanded = level.total;
      } else {
        levels[levels.length - 1].total += level.total;
      }
      continue;
    }
    const node = level.children[level.index];
    level.index += 1;
    if (isPair(node)) {
      levels.push(descend([node.key, node.value], undefined));
      continue;
    }
    if (!isNode(node)) {
      continue;
    }
    if (isAlias(node)) {
      const anchor = named.get(node.source);
      boundTo.set(node, anchor);
      repeats.set(anchor, (repeats.get(anchor) ?? 0) + 1);
      if (open.has(anchor)) {
        return { expanded: stopAt, boundTo, repeats };
      }
      level.total += 1 + (weight.get(anchor) ?? 0);
      if (level.total >= stopAt) {
        return { expanded: stopAt, boundTo, repeats };
      }
      continue;
    }
    if (node.anchor !== undefined) {
      named.set(node.anchor, node);
    }
    if (isCollection(node)) {
      const weighs = node.anchor === undefined ? undefined : node;
      if (weighs !== undefined) {
        open.add(weighs);
      }
      levels.push(descend(node.items, weighs));
    } else if (node.anchor !== undefined) {
      weight.set(node, 0);
    }
  }
  return { expanded, boundTo, repeats };
}

function descend(children: readonly unknown[], weighs: unknown): Weighing {
  return { children, index: 0, weighs, total: 0 };
}

function nodesReached(weighed: Weighed, stopAt: number): number {
  let counted = 0;
  for (const [anchor, times] of weighed.repeats) {
    const room = Math.ceil((stopAt - counted) / times);
    counted += nodesUnder(anchor, weighed.boundTo, room) * times;
    if (counted >= stopAt) {
      return stopAt;
    }
  }
  return counted;
}

function nodesUnder(
  anchor: unknown,
  boundTo: ReadonlyMap<unknown, unknown>,
  stopAt: number,
): number {
  const seen = new Set<unknown>();
  const levels: Level[] = [{ children: [anchor], index: 0 }];
  let counted = 0;
  while (levels.length > 0 && counted < stopAt) {
    const level = levels[levels.length - 1];
    if (level.index >= level.children.length) {
      levels.pop();
      continue;
    }
    const node = level.children[level.index];
    level.index += 1;
    if (isPair(node)) {
      levels.push({ children: [node.key, node.value], index: 0 });
      continue;
    }
    if (!isNode(node) || seen.has(node)) {
      continue;
    }
    seen.add(node);
    counted += 1;
    if (isAlias(node)) {
      levels.push({ children: [boundTo.get(node)], index: 0 });
    } else if (isCollection(node)) {
      levels.push({ children: node.items, index: 0 });
    }
  }
  return counted;
}
