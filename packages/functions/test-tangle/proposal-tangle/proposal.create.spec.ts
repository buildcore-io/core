import { Helper } from './Helper';

describe('Create proposal via tangle request', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should create proposal with tangle request', async () => {
    await helper.sendCreateProposalRequest();
  });
});
