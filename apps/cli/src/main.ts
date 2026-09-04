import { noDivergence, renderDivergences } from '@panoptes/formats';
import { parseModel } from '@panoptes/model';
import { renderRegister } from '@panoptes/render';
import { Either } from 'effect';
import { cliVersion } from './version.js';

if (process.argv[2] === '--version') {
  console.log(cliVersion);
} else {
  const empty = parseModel({
    metadata: { title: '', owner: '', description: '', contributors: [] },
    diagrams: [],
    threats: [],
    lastIssuedThreatNumber: 0,
    mitigations: [],
    assumptions: [],
  });

  console.log(renderDivergences(noDivergence));
  console.log(
    Either.map(empty, renderRegister).pipe(Either.getOrElse(() => '')),
  );
}
