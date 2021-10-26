// import * as admin from "firebase-admin";
import funcTest from "firebase-functions-test";
// import { stubObject } from "ts-sinon";

describe("test helloworld api", () => {
  let hwApi: any;
  // let adminInitStub: any;
  const tester = funcTest();
  before(async () => {
    // adminInitStub = stubObject(admin, "initializeApp");
    hwApi = await import("../src/index");
  });

  it("hello world no crash", () => {
    const wrapped = tester.wrap(hwApi.helloWorld);
    wrapped(null);
  });

  after(() => {
    // adminInitStub.restore();
    tester.cleanup();
  });
});
