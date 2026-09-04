import { runCli, writeOutcome } from './cli.js';

process.exitCode = writeOutcome(runCli(process.argv.slice(2)), {
  out: (text) => {
    process.stdout.write(text);
  },
  err: (text) => {
    process.stderr.write(text);
  },
});
