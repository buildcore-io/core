<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->

<a name="readme-top"></a>

<!--
*** Thanks for checking out the Best-README-Template. If you have a suggestion
*** that would make this better, please fork the repo and create a pull request
*** or simply open an issue with the tag "enhancement".
*** Don't forget to give the project a star!
*** Thanks again! Now go create something AMAZING! :D
-->

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![Apache2 License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/buildcore-io/core">
    <img src="docs/static/img/buildcore_logo.png" alt="BUILD.5 logo" height="80">
  </a>

<h3 align="center">Buildcore</h3>

  <p align="center">
    Your Enterprise ready web3 plug & play platform
    <br />
    <a href="https://developer.buildcore.io/"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/buildcore-io/core/issues/new?template=bug_report.md">Report Bug</a>
    ·
    <a href="https://github.com/buildcore-io/core/issues/new?template=feature_request.md">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

Buildcore is your Enterprise ready web3 plug & play platform. This repo contains the back-end based on [serverless functions](./packages/functions/) and our easy to use [SDK](./packages/sdk/) for third parties.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

- [![Typescript][Typescript]][Typescript-url]
- [![Postgresql][Postgresql]][Postgresql-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

To build the project locally, follow these simple steps. If you are interested in using the SDK to interact with our services, please refer to the [SDK documentation](https://developer.buildcore.io/).

### Prerequisites

Make sure you have the following installed:

- npm
- node >= 20
- modern yarn (optional, for running the docs locally)

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/buildcore-io/core.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Build the packages
   ```sh
   npm run build
   ```

For running the docs locally, please refer to the documentation [README](./docs/README.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->

## Usage

The best way to get started with the SDK and interacting with Buildcore is [installing the SDK](https://www.npmjs.com/package/@buildcore/sdk) and have a look at our [documentation](https://developer.buildcore.io).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Running it locally
  Navigate to the root folder and build the entire projet by running
  ```sh
   npm run build
   ```

  Buildcore backend consist of 3 individually ran services.
  1. Search API
      This is a small express server that connects to the Postgres Database and exposes HTTP endpoints to query the data.
      To run it navigate to `packages/search` folder, upate `.env.sample` with your DB connection params and run `npm run start`
  
  2. Functions:
    This is the main part of the backend. It is an express server that exposes several HTTP enpoints. One part of the enpoints are for users who wish to interrect with the backend. The other part of the endpoints are triggered by the Notifier once there is a change in the database. To run the Functions locally:  
      a) Navigate to `packages/functions`.  
      b) Upate `.env.sample` with your DB connection params  
      c) Run`npm run serve`. This will start the express server and it will run the Notifier locally.  

  3. Notifier:
    The Notifier is responsible for listening to changes in the database. Every time there is a change, the Notifier calls the relevant endpoint sending the data before and after the update. Locally, the notifier calls the endpoint directly but if deployed from the `packages/notifier` folder, it posts the changes to Google pub/sub.

Currently some tests in Functions are still strongly dependent on Google Cloud Storage, so to run the full test suite, you will need a Google Cloud service account file.

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

For more information on how to contribute, please read [CONTRIBUTING.md](./CONTRIBUTING.md)

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/buildcore-io/core/pulls)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->

## License

Distributed under the Apache License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

Buildcore - [@buildcoretech](https://twitter.com/buildcoretech) - hello@buildcore.io

Project Link: [https://buildcore.io](https://buildcore.io)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[contributors-shield]: https://img.shields.io/github/contributors/buildcore-io/core.svg?style=for-the-badge
[contributors-url]: https://github.com/buildcore-io/core/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/buildcore-io/core.svg?style=for-the-badge
[forks-url]: https://github.com/buildcore-io/core/network/members
[stars-shield]: https://img.shields.io/github/stars/buildcore-io/core.svg?style=for-the-badge
[stars-url]: https://github.com/buildcore-io/core/stargazers
[issues-shield]: https://img.shields.io/github/issues/buildcore-io/core.svg?style=for-the-badge
[issues-url]: https://github.com/buildcore-io/core/issues
[license-shield]: https://img.shields.io/github/license/buildcore-io/core.svg?style=for-the-badge
[license-url]: https://github.com/buildcore-io/core/blob/master/LICENSE
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/company/buildcore-io/
[Typescript]: https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white
[Typescript-url]: https://www.typescriptlang.org/
[Postgresql]: https://img.shields.io/badge/postgresql-4169e1?style=for-the-badge&logo=postgresql&logoColor=white
[Postgresql-url]: https://www.postgresql.org/
