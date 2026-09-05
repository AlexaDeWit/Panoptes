import {
  channelDistance,
  contrastRatio,
  darkPalette,
  lightPalette,
  tokenStylesheet,
  type Palette,
} from './tokens.js';

const palettes = [
  { name: 'the light palette', palette: lightPalette },
  { name: 'the dark palette', palette: darkPalette },
] as const;

const surfaces = [
  'surfaceApp',
  'surfaceCanvas',
  'surfacePanel',
  'surfaceActor',
  'surfaceProcess',
] as const satisfies readonly (keyof Palette)[];

const chromeSurfaces = [
  'surfaceApp',
  'surfaceCanvas',
  'surfacePanel',
] as const satisfies readonly (keyof Palette)[];

const tones = [
  'toneCritical',
  'toneHigh',
  'toneMedium',
  'toneLow',
  'toneNeutral',
] as const satisfies readonly (keyof Palette)[];

const textFloor = 4.5;

const markFloor = 3;

const toneDistanceFloor = 40;

type Pair = {
  readonly ink: keyof Palette;
  readonly ground: keyof Palette;
  readonly floor: number;
};

const pairsOf = (
  inks: readonly (keyof Palette)[],
  grounds: readonly (keyof Palette)[],
  floor: number,
): Pair[] =>
  inks.flatMap((ink) => grounds.map((ground) => ({ ink, ground, floor })));

const measured = (palette: Palette, pairs: readonly Pair[]) =>
  pairs.map((pair) => ({
    pair: `${pair.ink} on ${pair.ground}`,
    ratio:
      Math.round(contrastRatio(palette[pair.ink], palette[pair.ground]) * 100) /
      100,
    floor: pair.floor,
  }));

const below = (palette: Palette, pairs: readonly Pair[]) =>
  measured(palette, pairs).filter((entry) => entry.ratio < entry.floor);

describe.each(palettes)('$name', ({ palette }) => {
  it('sets text on every surface at the ratio WCAG 2.2 AA asks of text', () => {
    expect(
      below(
        palette,
        pairsOf(['textPrimary', 'textSecondary'], surfaces, textFloor),
      ),
    ).toEqual([]);
  });

  it('letters a badge and the primary action at that same ratio', () => {
    expect(
      below(palette, [
        ...pairsOf(['badgeGround'], tones, textFloor),
        ...pairsOf(['actionText'], ['actionPrimary', 'actionHover'], textFloor),
      ]),
    ).toEqual([]);
  });

  it('draws every mark on a surface at the ratio it asks of a mark', () => {
    expect(
      below(
        palette,
        pairsOf(
          [...tones, 'border', 'actionPrimary'],
          chromeSurfaces,
          markFloor,
        ),
      ),
    ).toEqual([]);
  });

  it('keeps the five severity tones apart', () => {
    const collapsed = tones.flatMap((one, at) =>
      tones.slice(at + 1).map((other) => ({
        pair: `${one} / ${other}`,
        distance: Math.round(channelDistance(palette[one], palette[other])),
      })),
    );
    expect(new Set(tones.map((tone) => palette[tone])).size).toBe(tones.length);
    expect(
      collapsed.filter((entry) => entry.distance < toneDistanceFloor),
    ).toEqual([]);
  });
});

describe('contrastRatio', () => {
  it('is the WCAG ratio, so the extremes are 21 and 1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(21);
    expect(
      contrastRatio(lightPalette.surfaceApp, lightPalette.surfaceApp),
    ).toBe(1);
  });
});

describe('tokenStylesheet', () => {
  it('publishes the light table on the document root', () => {
    expect(tokenStylesheet.startsWith(':root {')).toBe(true);
    expect(tokenStylesheet).toContain(lightPalette.surfaceApp);
    expect(tokenStylesheet).not.toContain(darkPalette.surfaceApp);
  });
});
