{ lib, stdenv, rustPlatform, cargo, rustc, lld }:

let
  lock = builtins.fromTOML (builtins.readFile ./Cargo.lock);
  locked = lib.findFirst (crate: crate.name == "resvg") null lock.package;
  # The nix expression is not an input to the compile, so naming the files
  # keeps a change here from rebuilding the module.
  sources = lib.fileset.toSource {
    root = ./.;
    fileset = lib.fileset.unions [ ./Cargo.toml ./Cargo.lock ./src ];
  };
in
stdenv.mkDerivation {
  pname = "saerskriven-resvg-wasm";
  version = locked.version;
  src = sources;

  # Every crate comes from the checksums in Cargo.lock, fetched before the
  # build. --offline then fails loudly rather than reaching the registry.
  cargoDeps = rustPlatform.importCargoLock { lockFile = ./Cargo.lock; };

  # nixpkgs' rustc ships no rust-lld, and wasm32-unknown-unknown links with
  # lld rather than the stdenv's cc.
  nativeBuildInputs = [ rustPlatform.cargoSetupHook cargo rustc lld ];

  buildPhase = ''
    runHook preBuild
    cargo build --release --offline --frozen --target wasm32-unknown-unknown
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    install -Dm444 \
      target/wasm32-unknown-unknown/release/saerskriven_resvg.wasm \
      "$out/lib/saerskriven_resvg.wasm"
    runHook postInstall
  '';

  # The fixup phase's strip and ELF patching do not read wasm.
  dontStrip = true;
  dontPatchELF = true;

  meta = {
    description = "SVG to PNG rasterizer built from the resvg crate as WebAssembly";
    homepage = "https://github.com/linebender/resvg";
    license = [ lib.licenses.mpl20 lib.licenses.asl20 ];
    platforms = lib.platforms.all;
  };
}
