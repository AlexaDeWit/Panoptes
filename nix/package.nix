{ lib, stdenv, stdenvNoCC, fetchurl, patchelf }:

let
  release = builtins.fromJSON (builtins.readFile ./release.json);
  system = stdenvNoCC.hostPlatform.system;
  asset = release.assets.${system} or
    (throw "Saerskriven has no release binary for ${system}. Supported systems: ${lib.concatStringsSep ", " (builtins.attrNames release.assets)}");
in stdenvNoCC.mkDerivation {
  pname = "saerskriven";
  inherit (release) version;

  src = fetchurl {
    url = "https://github.com/AlexaDeWit/Saerskriven/releases/download/v${release.version}/saerskriven-${release.version}-${asset.target}";
    sha256 = asset.hash;
  };

  dontUnpack = true;
  # Fixup would strip the payload or move Deno's trailer away from EOF.
  # On macOS it would also change the signed Mach-O bytes.
  dontFixup = true;
  nativeBuildInputs = lib.optionals stdenvNoCC.hostPlatform.isLinux [ patchelf ];

  installPhase = ''
    runHook preInstall
    mkdir -p "$out/bin"
  '' + lib.optionalString stdenvNoCC.hostPlatform.isLinux ''
    # Deno 2.8.3 uses libsui 0.12.6's EOF-relative payload trailer.
    # Patch only the ELF runtime, then restore the payload and its trailer.
    # See docs/nix.md for the format and the failed alternatives.
    read -r magic name_hash < <(tail -c 16 "$src" | od --endian=little -An -tx4 -N8)
    read -r payload_size < <(tail -c 8 "$src" | od --endian=little -An -tu8)
    file_size=$(stat -c %s "$src")
    if [ "$magic" != 0000501e ] || [ "$name_hash" != 000002a7 ] \
      || [ "$payload_size" -le 16 ] || [ "$payload_size" -ge "$file_size" ]; then
      echo "Unsupported Saerskriven ELF payload trailer. Review the release's Deno format." >&2
      exit 1
    fi
    head -c "$((file_size - payload_size))" "$src" > "$out/bin/saerskriven"
    patchelf \
      --set-interpreter "${stdenv.cc.bintools.dynamicLinker}" \
      --set-rpath "${lib.makeLibraryPath [ stdenv.cc.libc stdenv.cc.cc.lib ]}" \
      "$out/bin/saerskriven"
    tail -c "$payload_size" "$src" >> "$out/bin/saerskriven"
  '' + lib.optionalString stdenvNoCC.hostPlatform.isDarwin ''
    cp "$src" "$out/bin/saerskriven"
  '' + ''
    chmod 755 "$out/bin/saerskriven"
    runHook postInstall
  '';

  meta = {
    description = "Threat model validation and rendering CLI";
    homepage = "https://github.com/AlexaDeWit/Saerskriven";
    license = lib.licenses.asl20;
    mainProgram = "saerskriven";
    platforms = builtins.attrNames release.assets;
    sourceProvenance = [ lib.sourceTypes.binaryNativeCode ];
  };
}
