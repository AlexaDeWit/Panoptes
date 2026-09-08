{ runCommand, lib, stdenv, saerskriven, poppler-utils }:

runCommand "saerskriven-installed-check" {
  nativeBuildInputs = [ saerskriven poppler-utils ];
} ''
  ${lib.optionalString stdenv.hostPlatform.isLinux ''
    test ! -e /lib64/ld-linux-x86-64.so.2
    test ! -e /lib/ld-linux-aarch64.so.1
  ''}
  export HOME="$TMPDIR/home"
  mkdir -p "$HOME"
  export DENO_NO_UPDATE_CHECK=1
  export DENO_NO_PROMPT=1

  for tool in node deno typst chromium; do
    if command -v "$tool"; then
      echo "Unexpected external runtime: $tool" >&2
      exit 1
    fi
  done

  test "$(saerskriven --version)" = ${lib.escapeShellArg saerskriven.version}
  test "$(saer --version)" = ${lib.escapeShellArg saerskriven.version}
  cp ${../test-data/saerskriven/ecluse.yaml} model.yaml
  saer validate model.yaml > validation.txt
  for format in md svg pdf; do
    saer render model.yaml --format "$format" --out "model.$format"
    test -s "model.$format"
  done

  grep -Fq 'Écluse' model.md
  grep -F '<svg' model.svg > /dev/null
  test "$(head -c 5 model.pdf)" = '%PDF-'
  pdftotext model.pdf model.txt
  grep -Fq 'Écluse' model.txt
  pdffonts model.pdf > fonts.txt
  awk '
    NR > 2 && $1 ~ /LiberationSans/ {
      found = 1
      if ($(NF - 4) != "yes") bad = 1
    }
    END { exit (!found || bad) }
  ' fonts.txt
  mkdir "$out"
  cp validation.txt fonts.txt "$out/"
''
