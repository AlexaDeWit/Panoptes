import {
  assumptionStatusesToModel,
  assumptionStatusesToWire,
  ciaCategoriesToModel,
  ciaCategoriesToWire,
  ciaDieCategoriesToModel,
  ciaDieCategoriesToWire,
  linddunCategoriesToModel,
  linddunCategoriesToWire,
  mitigationStatusesToModel,
  mitigationStatusesToWire,
  plot4aiCategoriesToModel,
  plot4aiCategoriesToWire,
  severitiesToModel,
  severitiesToWire,
  strideCategoriesToModel,
  strideCategoriesToWire,
  threatStatusesToModel,
  threatStatusesToWire,
} from './panoptes-yaml-vocabulary.js';

type Table = Readonly<Record<string, string>>;

const vocabularies: readonly (readonly [string, Table, Table])[] = [
  ['severity', severitiesToModel, severitiesToWire],
  ['threat status', threatStatusesToModel, threatStatusesToWire],
  ['mitigation status', mitigationStatusesToModel, mitigationStatusesToWire],
  ['assumption status', assumptionStatusesToModel, assumptionStatusesToWire],
  ['STRIDE', strideCategoriesToModel, strideCategoriesToWire],
  ['LINDDUN', linddunCategoriesToModel, linddunCategoriesToWire],
  ['CIA', ciaCategoriesToModel, ciaCategoriesToWire],
  ['CIA-DIE', ciaDieCategoriesToModel, ciaDieCategoriesToWire],
  ['PLOT4ai', plot4aiCategoriesToModel, plot4aiCategoriesToWire],
];

function strays([name, toModel, toWire]: readonly [
  string,
  Table,
  Table,
]): string[] {
  return [
    ...Object.entries(toModel).flatMap(([wire, model]) =>
      toWire[model] === wire ? [] : [`${name}: ${wire} to ${model} and back`],
    ),
    ...Object.entries(toWire).flatMap(([model, wire]) =>
      toModel[wire] === model ? [] : [`${name}: ${model} to ${wire} and back`],
    ),
  ];
}

describe('the tables between the format and the model', () => {
  it('carry every member of every vocabulary back to itself', () => {
    expect(vocabularies.flatMap(strays)).toEqual([]);
  });
});
