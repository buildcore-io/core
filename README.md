[![SoonLabs](https://badgen.net/discord/members/5RVhemRU)](https://discord.gg/5RVhemRU)
[![TypeScript](https://img.shields.io/badge/--3178C6?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org/)
[![Open Source? Yes!](https://badgen.net/badge/Open%20Source%20%3F/Yes%21/blue?icon=github)](https://github.com/Naereen/badges/)
[![Front End Unit Tests](https://github.com/soonlabs/soonaverse/actions/workflows/front-end-unit-tests.yml/badge.svg)](https://github.com/soonlabs/soonaverse/actions/workflows/front-end-unit-tests.yml)
[![Smart Contract Tests](https://github.com/soonlabs/soonaverse/actions/workflows/smart-contracts-unit-test.yml/badge.svg)](https://github.com/soonlabs/soonaverse/actions/workflows/smart-contracts-unit-test.yml)
[![Functions Unit Tests](https://github.com/soonlabs/soonaverse/actions/workflows/functions-unit-tests.yml/badge.svg)](https://github.com/soonlabs/soonaverse/actions/workflows/functions-unit-tests.yml)

# About
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

# Framework
The platform is designed to transition fully into the ISCP and away from any centralized services. Centralized services are transitioned as infrastructure becomes ready for production use.

There are three key elements:

### /protocol
- Solidity
- Hardhat

Solidity Smart Contracts. Hardhat is used to manage testing, migration, deployments, etc. Eventually native ISCP smart contracts will be utilized once more tooling is available.

Compile SC: ```npx hardhat compile```

Test SC: ``` npx hardhat test```

### /functions (interim)
- Firebase Cloud Functions
- Firestore
- Typescript
  
Interim centralized TypeScript functions that runs on Firebase Cloud Functions. Typically we would run smart contracts in parallel.

Serve functions locally: ```npm run serve```

Test functions: ```npm run test```

Deploy functions: ```npm run deploy```

### /src
- Angular
- Typescript
- Tailwindcss
- NG Ant Design

Front-end application in Angular/Typescript. @api wraps any calls to backend and decides where to contact smart contracts or interim centralized functions.

Build project: ```npm run build```

Serve project locally: ```npm start```

Run unit tests: ```npm run test```

# 🤝 Contributing

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/soonlabs/soonaverse/pulls)

We welcome all contributions. Please read our [CONTRIBUTING.md](https://github.com/soonlabs/soonaverse/blob/master/CONTRIBUTING.md) first. You can submit any ideas as [pull requests](https://github.com/soonlabs/soonaverse/pulls) or as [GitHub issues](https://github.com/soonlabs/soonaverse/issues).

Thank you for supporting us free open source licenses.
