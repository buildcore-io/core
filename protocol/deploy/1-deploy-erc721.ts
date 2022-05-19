import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    deployments: { deploy },
    getNamedAccounts,
  } = hre;
  const { deployer } = await getNamedAccounts();

  if (process.env.WITH_PROXY) return;

  await deploy("ERC721Mock", {
    from: deployer,
    args: [
      "testMock",
      "testMock",
      deployer,
    ],
    log: true,
  });
};

export default deploy;
deploy.tags = ["GreenStable"];
