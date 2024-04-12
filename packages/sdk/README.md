<p align="center">Super easy to use framework to interact with Web3</p>
<p align="center">
    <a href="https://www.npmjs.com/package/@build-5/sdk"><img src="https://img.shields.io/npm/v/@build-5/sdk.svg?style=flat-square&colorB=51C838"
                                                       alt="NPM Version" /></a>
    <img
            src="https://img.shields.io/badge/license-APACHE2-brightgreen.svg?style=flat-square" alt="License" />
</p>

> @build-5/sdk is a complete framework to interact with Build5 platform and various DLTs like IOTA and Shimmer.

- 🕒 Fast and Reliable
- 💪 Tested and trusted
- 🔥 Scalable
- 📦 Simple and easy to use
- 👫 Supports both client and server use

---

## Getting Started

### Documentation

You can find more details, API, and other docs on [developer.buildcore.io](https://developer.buildcore.io/) website.

### Installation

```console
npm install @build-5/sdk --save
npm install @build-5/interfaces --save
```

### API

It's easy to use Build5 SDK to read, post or constract OTR requests.

```
import { Build5, https } from '@build-5/sdk';
import { Dataset } from '@build-5/interfaces';

const member = await https(origin).createProject(<YourProjectApiKey>)
                                  .dataset(Dataset.MEMBER)
                                  .id('0x551fd2c7c7bf356bac194587dab2fcd46420054b')
                                  .get();

console.log(member);
```

📚[API Reference](https://developer.buildcore.io)

## Contributors

This project exists thanks to all the people who contribute.

Please give us a 💖 star 💖 to support us. Thank you.

And thank you to all our backers! 🙏

## License

Build.5 solutions are licensed under a [APACHE 2 License](./LICENSE).
