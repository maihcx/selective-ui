export type SelectiveMockInstance = {
  bind: jest.Mock;
  find: jest.Mock;
  destroy: jest.Mock;
  rebind: jest.Mock;
  registerPlugin: jest.Mock;
  unregisterPlugin: jest.Mock;
  Observer: jest.Mock;
};

export type LibsMock = {
  getBindedCommand: jest.Mock;
};