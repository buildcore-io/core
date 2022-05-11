const {task} = require("hardhat/config");

task("query_supply", "query total supply of a erc20 token")
    .addParam("address", "token address")
    .setAction(async (taskArgs, hre) => {
        const {getNamedAccounts, ethers, deployments} = hre;
        console.log(taskArgs.address);
        const token = await ethers.getContractAt("ERC20Mock", taskArgs.address);

        const res = await token.totalSupply();
        console.log("supply = ", res.toString());
    });

