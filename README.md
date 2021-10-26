# Overview

Soonaverse platform:
- Dao As a Service
- Academy
- Platform Station

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
