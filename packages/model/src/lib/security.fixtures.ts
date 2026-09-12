import { validModelFixture } from './fixtures.js';

/** Security fields aligned with the element order in validModelFixture. */
export const securityPropertyFixtures = [
  { providesAuthentication: false },
  {
    handlesCardPayment: true,
    handlesGoodsOrServices: false,
    isWebApplication: true,
    privilegeLevel: '',
  },
  {
    isALog: false,
    isEncrypted: true,
    isSigned: false,
    storesCredentials: true,
    storesInventory: false,
  },
  {
    protocol: 'HTTPS',
    isEncrypted: true,
    isPublicNetwork: false,
    trustBoundaryIds: ['element-perimeter'],
  },
  {
    containedElements: ['element-api', 'element-db'],
    crossingFlows: ['element-order-flow'],
  },
  { containedElements: [], crossingFlows: [] },
];

/** Every security field is recorded, including explicit false, empty text and empty lists. */
export const securityModelFixture = {
  ...validModelFixture,
  diagrams: validModelFixture.diagrams.map((diagram) => ({
    ...diagram,
    elements: diagram.elements.map((element, index) => ({
      ...element,
      ...securityPropertyFixtures[index],
    })),
  })),
};
