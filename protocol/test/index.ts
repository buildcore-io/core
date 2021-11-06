import { expect } from "chai";
import { ethers } from "hardhat";

describe("Greeter", function () {
  it("Should return the new greeting once it's changed", async function () {
    const Greeter = await ethers.getContractFactory("Greeter");
    const greeter = await Greeter.deploy("Hello, world!");
    await greeter.deployed();

    expect(await greeter.greet()).to.equal("Hello, world!");

    const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

    // wait until the transaction is mined
    await setGreetingTx.wait();

    expect(await greeter.greet()).to.equal("Hola, mundo!");
  });
});

describe("Minting the token and returning it", function () {
  it("should the contract be able to mint a function and return it", async function () {
    const metadata = "IFPS_ADDRESS" // Metadata URL will be stored in IPFS

    const FactoryContract = await ethers.getContractFactory("AvatarNft");
    const factoryContract = await FactoryContract.deploy();

    const transaction = await factoryContract.createToken(metadata);
    const tx = await transaction.wait();

    const event = tx.events![0];
    const value = event.args![2];
    const tokenId = value.toNumber();

    const tokenURI = await factoryContract.tokenURI(tokenId);
    expect(tokenURI).to.be.equal(metadata);

  });
});
