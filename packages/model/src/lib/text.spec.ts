import { Either } from 'effect';
import { issuesOf, seededModel, validModelFixture } from './fixtures.js';
import { firstRefusedCharacter } from './text.js';

const zeroWidthNonJoiner = '\u200C';

const zeroWidthJoiner = '\u200D';

const arabicLetterMark = '\u061C';

const arabicNumberSign = '\u0600';

const endOfAyah = '\u06DD';

const syriacAbbreviationMark = '\u070F';

const mongolianVowelSeparator = '\u180E';

const scripts = [
  ['Korean', '주문 서비스'],
  ['Chinese', '订单服务'],
  ['Japanese', '注文サービス'],
  [
    'Arabic, with a letter mark and a non-joiner',
    `${arabicLetterMark}خدمة الطلب${zeroWidthNonJoiner}ات`,
  ],
  [
    'Persian, whose spelling needs the non-joiner',
    `می${zeroWidthNonJoiner}خواهم`,
  ],
  [
    'Arabic, with the number sign and the end of ayah',
    `${arabicNumberSign}١٢٣ آية${endOfAyah}١`,
  ],
  ['Syriac, with the abbreviation mark', `${syriacAbbreviationMark}ܐܠܗܐ`],
  ['Mongolian, with the vowel separator', `ᠮᠣᠩᠭᠣᠯ${mongolianVowelSeparator}ᠠ`],
  ['Cyrillic', 'Служба заказов'],
  ['Canadian Aboriginal Syllabics', 'ᐃᓄᒃᑎᑐᑦ'],
  ['Greek', 'Υπηρεσία παραγγελιών'],
  ['Devanagari', 'ऑर्डर सेवा'],
  [
    'an emoji sequence built with the joiner',
    `\u{1F469}${zeroWidthJoiner}\u{1F469}${zeroWidthJoiner}\u{1F467}`,
  ],
] as const;

const nullCharacter = '\u0000';

const bell = '\u0007';

const softHyphen = '\u00AD';

const rightToLeftOverride = '\u202E';

const leftToRightIsolate = '\u2066';

const lineSeparator = '\u2028';

const privateUse = '\uE000';

const unpairedSurrogate = '\uD800';

const zeroWidthSpace = '\u200B';

const wordJoiner = '\u2060';

const byteOrderMark = '\uFEFF';

const leftToRightMark = '\u200E';

const scotlandFlag =
  '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}';

type Refusal = {
  readonly named: string;
  readonly text: string;
  readonly path: readonly (string | number)[];
  readonly plant: (draft: typeof validModelFixture, text: string) => void;
};

const refusals: readonly Refusal[] = [
  {
    named: 'a C0 control in a model title',
    text: `Order${nullCharacter} service`,
    path: ['metadata', 'title'],
    plant: (draft, text) => {
      draft.metadata.title = text;
    },
  },
  {
    named: 'a soft hyphen in a contributor, a format character off the list',
    text: `Alexandra${softHyphen} de Wit`,
    path: ['metadata', 'contributors', 0],
    plant: (draft, text) => {
      draft.metadata.contributors[0] = text;
    },
  },
  {
    named: 'a bidirectional override in a threat description',
    text: `The order is ${rightToLeftOverride}detrosnu`,
    path: ['threats', 0, 'description'],
    plant: (draft, text) => {
      draft.threats[0].description = text;
    },
  },
  {
    named: 'a bidirectional isolate in a custom methodology name',
    text: `Process${leftToRightIsolate}`,
    path: ['threats', 0, 'category', 'methodologyName'],
    plant: (draft, text) => {
      draft.threats[0].category = {
        methodology: 'custom',
        methodologyName: text,
        category: 'documentation',
      };
    },
  },
  {
    named: 'a private use character in an element name',
    text: `Customer ${privateUse}`,
    path: ['diagrams', 0, 'elements', 0, 'name'],
    plant: (draft, text) => {
      draft.diagrams[0].elements[0].name = text;
    },
  },
  {
    named: 'a control character in an element id',
    text: `element${bell}customer`,
    path: ['diagrams', 0, 'elements', 0, 'id'],
    plant: (draft, text) => {
      draft.diagrams[0].elements[0].id = text;
    },
  },
  {
    named: 'an unpaired surrogate in a mitigation prose',
    text: `Terminate TLS ${unpairedSurrogate}`,
    path: ['mitigations', 0, 'prose'],
    plant: (draft, text) => {
      draft.mitigations[0].prose = text;
    },
  },
  {
    named: 'a zero width space in an owner, a format character no script owns',
    text: `Alexandra${zeroWidthSpace} de Wit`,
    path: ['metadata', 'owner'],
    plant: (draft, text) => {
      draft.metadata.owner = text;
    },
  },
  {
    named: 'a left to right mark in a model description',
    text: `Sample model${leftToRightMark}`,
    path: ['metadata', 'description'],
    plant: (draft, text) => {
      draft.metadata.description = text;
    },
  },
  {
    named: 'a word joiner in a diagram title',
    text: `Main data${wordJoiner}flow`,
    path: ['diagrams', 0, 'title'],
    plant: (draft, text) => {
      draft.diagrams[0].title = text;
    },
  },
  {
    named: 'a byte order mark inside a mitigation title',
    text: `TLS on${byteOrderMark} the order flow`,
    path: ['mitigations', 0, 'title'],
    plant: (draft, text) => {
      draft.mitigations[0].title = text;
    },
  },
  {
    named: 'a subdivision flag, which tag characters build',
    text: `Flagged ${scotlandFlag}`,
    path: ['threats', 0, 'title'],
    plant: (draft, text) => {
      draft.threats[0].title = text;
    },
  },
  {
    named: 'a line separator in an assumption prose',
    text: `The database encrypts its disks.${lineSeparator}`,
    path: ['assumptions', 0, 'prose'],
    plant: (draft, text) => {
      draft.assumptions[0].prose = text;
    },
  },
];

const titled = (title: string) =>
  seededModel((draft) => {
    draft.metadata.title = title;
  });

describe('the characters a model string accepts', () => {
  it.each(scripts)('carry %s through the parse unchanged', (_script, text) => {
    const result = titled(text);
    expect(issuesOf(result)).toEqual([]);
    expect(Either.getOrNull(result)?.metadata.title).toBe(text);
  });

  it('include the tab, line feed and carriage return prose is written with', () => {
    const text = 'Order service\nover two lines\tand a return\r';
    expect(Either.getOrNull(titled(text))?.metadata.title).toBe(text);
  });

  it('include the empty string, so a model saves before it is described', () => {
    expect(Either.getOrNull(titled(''))?.metadata.title).toBe('');
  });
});

describe('the characters a model string refuses', () => {
  it.each(refusals)('name where they sit: $named', ({ text, path, plant }) => {
    expect(
      issuesOf(
        seededModel((draft) => {
          plant(draft, text);
        }),
      ),
    ).toContainEqual(expect.objectContaining({ path }));
  });

  it('say what was refused rather than print the pattern', () => {
    expect(issuesOf(titled(`Order${nullCharacter} service`))).toEqual([
      {
        path: ['metadata', 'title'],
        message: 'Text carries a character the model does not accept.',
        code: 'custom',
      },
    ]);
  });
});

describe('the format characters the rule reaches', () => {
  it('are the set pinned beside this spec, so a Unicode upgrade shows', async () => {
    const formatCharacters: { code: number; accepted: boolean }[] = [];
    for (let code = 0; code <= 0x10ffff; code += 1) {
      const character = String.fromCodePoint(code);
      if (/\p{Cf}/u.test(character)) {
        formatCharacters.push({
          code,
          accepted: firstRefusedCharacter(character) === undefined,
        });
      }
    }
    const accepted = formatCharacters.filter((entry) => entry.accepted);
    await expect(
      [
        'Format characters (general category Cf) the model accepts, from the',
        `rule in \`src/lib/text.ts\` as this runtime's Unicode data has it:`,
        `${String(accepted.length)} of the ${String(formatCharacters.length)} Cf code points it knows. An upgrade that`,
        'moves the set arrives as a diff on this file, and the model README',
        'says what to make of one. Regenerate with',
        '`pnpm nx test @panoptes/model -- -u`.',
        '',
        ...accepted.map(
          (entry) =>
            `U+${entry.code.toString(16).toUpperCase().padStart(4, '0')}`,
        ),
        '',
      ].join('\n'),
    ).toMatchFileSnapshot('./text.format-characters.snapshot.txt');
  });
});

describe('a text as long as a read admits, in two-byte characters', () => {
  it('is read in one pass, where an anchored repetition exhausts the stack', () => {
    const long = 'Служба заказов '.repeat(300000);
    expect(long.length).toBeGreaterThan(4 * 1024 * 1024);
    expect(firstRefusedCharacter(long)).toBeUndefined();
    expect(issuesOf(titled(long))).toEqual([]);
  });
});

describe('firstRefusedCharacter', () => {
  it('points at nothing for text the model accepts whole', () => {
    expect(firstRefusedCharacter('Order service')).toBeUndefined();
    expect(
      firstRefusedCharacter(`می${zeroWidthNonJoiner}خواهم`),
    ).toBeUndefined();
  });

  it('points at the first refused character, counting UTF-16 units', () => {
    expect(firstRefusedCharacter(`Order${nullCharacter} service`)).toBe(5);
    expect(firstRefusedCharacter(`\u{1F469}${byteOrderMark}`)).toBe(2);
  });
});
