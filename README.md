[![SoonLabs](https://badgen.net/discord/members/5RVhemRU)](https://discord.gg/5RVhemRU)
[![TypeScript](https://img.shields.io/badge/--3178C6?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org/)
[![Open Source? Yes!](https://badgen.net/badge/Open%20Source%20%3F/Yes%21/blue?icon=github)](https://github.com/Naereen/badges/)
[![Front End Unit Tests](https://github.com/soonlabs/soonaverse/actions/workflows/front-end-unit-tests.yml/badge.svg)](https://github.com/soonlabs/soonaverse/actions/workflows/front-end-unit-tests.yml)
[![Smart Contract Tests](https://github.com/soonlabs/soonaverse/actions/workflows/smart-contracts-unit-test.yml/badge.svg)](https://github.com/soonlabs/soonaverse/actions/workflows/smart-contracts-unit-test.yml)
[![Functions Unit Tests](https://github.com/soonlabs/soonaverse/actions/workflows/functions-unit-tests.yml/badge.svg)](https://github.com/soonlabs/soonaverse/actions/workflows/functions-unit-tests.yml)
# Overview
The Soonaverse is a decentralized platform for communities, enabling the seamless creation, management, and interoperability of DAOs.

DAO-on-Demand (DoD) enables the “one-click” setup of DAOs and provides components that simplify complex DAO operations through an integrated set of feeless core modules. This includes the Secure Feeless Voting module, the first feeless, on-chain voting system in the industry. The Soonaverse also includes 2 innovative and feature-enhancing service modules; the Token LaunchPad and the Reputation Station.

**Core modules:**
- Discussion Forum
- Secure Feeless Voting
- DAO token deployment
- Treasury Management

**Service Modules:**
- Token Launchpad
- Reputation Station
  
_See [Litepaper](https://docs.google.com/document/d/107AWznbIIz1CwsqRO2Jwj5vmqVdj_2g-eavnmCeTvd8) for more._

----

TBD

## Framework
Application is designed to eventually transition fully into the ISCP and away from any centralized services. Centralized services are transitioned as infrastructure becomes ready for production use.

There are three key frameworks:

### /protocol
Solidity Smart Contracts. Hardhat is used to manage testing, migration, deployments, etc.

### /functions
Interim centralized TypeScript functions that runs on Firebase Cloud Functions.

### /src
Front-end application in Angular. It uses @api to connect to protocol & firestore (interim).

## 🧙‍♂️ Commands
### Interim centralized server-less functions - "/functions"
| Command       | Description                                                    |
| -----------   | -------------------------------------------------------------- |
| npm run serve | Serve locally                                                  |

### Protocol Smart Contracts - "/protocol"
| Command             | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| npx hardhat compile | Compile Solidity Smart Contract                                |
| npx hardhat test    | Test smart contract                                            |

### Front end - "/src"

| Command     | Description                                                    |
| ----------- | -------------------------------------------------------------- |
| ng          | See available commands                                         |
| start       | Run your app in development mode                               |
| build       | Build your app for production                                  |
| build:stats | Build your app for production and generate a "stats.json" file |
| watch       | Run build when files change.                                   |
| test        | Run your unit tests                                            |
| lint        | Use ESLint to lint your app                                    |
| analyze     | Open webpack-bundle-analyzer                                   |
