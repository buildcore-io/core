import { HardhatRuntimeEnvironment } from "hardhat/types";
import { deployments, network } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";


const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { deploy },
    getNamedAccounts,
  } = hre;
  const { deployer } = await getNamedAccounts();

  if (process.env.WITH_PROXY) return;

  const token = await deployments.get("GovernanceToken");
  const timelock = await deployments.get("GovernanceTimeLock");

  await deploy("GovernorContract", {
    from: deployer,
    args: [
      token.address,
      timelock.address,
      10,
      100,
      100,
    ],
    log: true,
  });
};

export default deploy;
deploy.tags = ["GreenStable"];
