import { noDivergence, renderDivergences } from '@panoptes/formats';
import { parseModel } from '@panoptes/model';
import { renderRegister } from '@panoptes/render';
import { Either } from 'effect';

const empty = parseModel({
  metadata: { title: '', owner: '', description: '', contributors: [] },
  diagrams: [],
  threats: [],
  lastIssuedThreatNumber: 0,
  mitigations: [],
  assumptions: [],
});

console.log(renderDivergences(noDivergence));
console.log(Either.map(empty, renderRegister).pipe(Either.getOrElse(() => '')));
