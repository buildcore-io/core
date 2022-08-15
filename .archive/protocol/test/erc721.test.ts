import {ethers, network} from "hardhat";
import {expect} from "chai";

describe("ERC721", function () {
  let token: any;
  let owner: any;
  let user1: any;
  let user2: any;
  let user3: any;
  beforeEach(async function () {
    const accounts = await ethers.getSigners();
    [owner, user1, user2, user3] = accounts;
    const TokenFactory = await ethers.getContractFactory('ERC721Mock');
    token = await TokenFactory.deploy("testToken", "tt", owner.address);
  });

  it('test contract creation', async ()=>{
    let name = await token.name();
    let symbol = await token.symbol();

    expect(name).to.be.equal('testToken');
    expect(symbol).to.be.equal('tt');
  })

  it('test setters', async ()=>{
    await token.setBaseURI("dd");
    expect((await token.baseURI())).to.be.equal('dd');
  })

  it('test mint token', async ()=>{
    await token.mintNewNFT(user1.address);
    let currentId = await token.idTracker();
    expect((await currentId.toString())).to.be.equal('2');

    await token.mintNewNFT(user1.address);
    currentId = await token.idTracker();
    expect((await currentId.toString())).to.be.equal('3');
  })

  it('test transfer token', async ()=>{
    await token.mintNewNFT(user1.address);
    let currentId = await token.idTracker();
    expect((await currentId.toString())).to.be.equal('2');

    await expect(token.connect(user2).transferFrom(user1.address, user2.address, 1)).to.be.revertedWith("");
    await expect(token.connect(user1).transferFrom(user1.address, user2.address, 2)).to.be.revertedWith("");
    await token.connect(user1).transferFrom(user1.address, user2.address, 1)
    const owner = await token.ownerOf(1);
    let balance = await token.balanceOf(user1.address);

    expect((await balance.toString())).to.be.equal('0');
    expect((await owner.toString())).to.be.equal(user2.address);
    balance = await token.balanceOf(user2.address);
    expect((await balance.toString())).to.be.equal('1');
  })

  it('test approve and transfer token', async ()=>{
    let tokenURI = "a";
    await token.mintNewNFT(user1.address);
    let currentId = await token.idTracker();
    expect((await currentId.toString())).to.be.equal('2');

    await expect(token.connect(user2).approve(user2.address, 1)).to.be.revertedWith("");
    await expect(token.connect(user1).approve(user1.address, 2)).to.be.revertedWith("");
    await token.connect(user1).approve(user2.address, 1)
    const approved = await token.getApproved(1);
    expect((await approved.toString())).to.be.equal(user2.address);

    await token.connect(user2).transferFrom(user1.address, user3.address, 1)
    const owner = await token.ownerOf(1);
    let balance = await token.balanceOf(user1.address);
    expect((await balance.toString())).to.be.equal('0');
    expect((await owner.toString())).to.be.equal(user3.address);
    balance = await token.balanceOf(user3.address);
    expect((await balance.toString())).to.be.equal('1');
  })


  it('test burn token', async ()=>{
    await token.mintNewNFT(user1.address);
    let currentId = await token.idTracker();
    expect((await currentId.toString())).to.be.equal('2');

    await expect(token.burn(1)).to.be.revertedWith("");
    await token.connect(user1).burn(1);
    let balance = await token.balanceOf(owner.address);
    expect(balance.toString()).to.be.equal('0');

  })
  it('test pause contract', async ()=>{
    await token.pause()
    await expect(token.mintNewNFT(user1.address)).to.be.revertedWith("");
    await token.unpause()
    await token.mintNewNFT(user1.address);
  })

    it('test contract ownership', async ()=>{
      //await catchRevert(token.mintNewNFT(user1, tokenURI, {from: user1}));
      //await catchRevert(token.mintNewNFTWithData(user1, tokenURI, "0x123", {from: user1}));
      await expect(token.connect(user1).setBaseURI("dd",)).to.be.revertedWith("");
    })

    it('test contract autoincreament', async ()=>{
      let tokenURI = "a";
      await token.mintNewNFT(user1.address);
      expect((await token.idTracker()).toString()).to.be.equal('2')
      await token.mintNewNFT(user2.address);
      expect((await token.idTracker()).toString()).to.be.equal('3')
    })
})