import test from "firebase-functions-test";
import { createMember } from '../src/controls/member.control';

describe('token required', () => {
  it('successfully invokes function', async () => {
    const wrapped: any = test().wrap(createMember);
    const data: any = { name: 'hello - world', broadcastAt: new Date() }

    expect(wrapped({
      data: () => (data),
      ref:{
        set: jest.fn()
      }
    })).rejects.toThrow(Error);
  })
})
