import {ethers, network} from "hardhat";
import {expect} from "chai";


describe("ERC20", function () {
  let token: any;
  beforeEach(async function () {
    const TokenFactory = await ethers.getContractFactory('ERC20Mock');
    token = await TokenFactory.deploy("testToken", "tt", 10000);
  });

  it("contract init", async function () {
    expect(await token.name()).to.be.equal("testToken");
    expect(await token.symbol()).to.be.equal("tt");
    expect((await token.totalSupply()).toString()).to.be.equal('10000');
  });
});

