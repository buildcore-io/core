---
title: NFT Marketplace
tags:
  - tutorial
  - nft
  - marketplace
---

The NFT Marketplace tutorial shows you how to use Build.5 technology to create a basic marketplace.
We have both a [live demo](https://dr-electron.github.io/nft-marketplace-example/) and the open source [repo](https://github.com/Dr-Electron/nft-marketplace-example) for your to explore.



## Ready To Code

If you want to play with the code immediately, use one of the following ready-to-code solutions. Clicking the button will open a workspace of your choice and automatically build and run everything for you.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/dr-electron/nft-marketplace-example)  
[![Gitpod Ready-to-Code](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/dr-electron/nft-marketplace-example)

## Application

You can find all the essential code in `src/app`. Most Build.5 related code is in `src/app/services`

### Run Application

To run the example, execute `npm install` and `npm start` in the root folder.

### Explanation

The example uses Build.5 [https](../getting-started.mdx#https) to fetch data from a Build.5 verse (in this case, Soonaverse). It creates Metadata for an [OTR](../getting-started.mdx#otr), which can be executed with a Wallet (in the example, we use Bloom Deeplinks) to buy one of the NFTs.

<!-- TODO: Use saucelabs after it got updated to v3 of docusaurus https://github.com/saucelabs/docusaurus-theme-github-codeblock -->
#### Fetch NFTs

First, we need to create a Build.5 "https" client (here, we use the soonaverse token and keys):

```ts
private client = https(environment.build5Env).project(environment.build5Token).dataset(Dataset.NFT);
```

Then we can use [`getByFieldLive`](../how-to/get.md#get-by-field-live) to get all availabel NFTs from a collection:

:::tip Auction and Sale

We can filter by `available` to get either auctions or sales for NFTs.

:::

```ts
getByCollectionAvailableForSaleLive(col: string): Observable<Nft[] | undefined> {
    return from(this.client.getByFieldLive(['collection', 'available'], [col, NftAvailable.SALE]));
}
```

And we then use the return value of the above function in our Angular frontend:

```html
<app-product *ngFor="let p of products$ | async" [nft]="p"></app-product>
```

:::info

Check out the code and try to find out how we use the NFT object to also show properties like [`totalTrades`](../reference-api/interfaces/Nft.md#totaltrades), [`availablePrice`](../reference-api/interfaces/Nft.md#availableprice) and more in the cards

:::

#### Buy NFTs

To enable buying NFTs, we first add a button to every card:

```html
<button class="mt-4 text-xl w-full text-white bg-indigo-600 py-2 rounded-xl shadow-lg"
(click)="buyOtr(nft.uid)">Buy On Tangle Request</button>
```

Now, we have to implement the buyOtr function:

```ts
public async buyOtr(id: string): Promise<void> {
    // Get NFT Price
    const nfts = await this.nftService.getNfts(id);
    const price = nfts[0].price;
    this.log.add('NFT Price: ' + price);

    const request = this.nftService.purchase(id, price);
    const url = request.getBloomDeepLink();
    try {
        window.open(url);
    } catch (e) {
        this.log.add('ERRROR: ' + e)
    }
    this.log.add('Deep link created: ' + url);
    const trackingTag = request.getTag(url);
    this.log.add('Tracking of progress:');
    https(Build5.TEST).project(environment.build5Token).trackByTag(trackingTag).subscribe((v) => {
        this.log.add(JSON.stringify(v));
    })
}
```

Let's take a deeper look at what we did here. Be aware that most logic is part of the NFT service and, therefore, wrapped into our functions.
First, we must get the NFT, as we only passed its ID. We can do that using the [`getManyById`](../how-to/get.md#get-many-by-id) function, which we use inside our getNfts function
Now, we can get the price of the NFT. We can use the price to call the [`purchase`](../how-to/nft/purchase.md) function.
Now, we need to get the deep link of that request and open it so your installed wallet opens and prepares everything for the OTR and your purchase transaction.

:::tip OTR Client

The purchase function is part of OTR. So we also had to create an OTR client in this example like this:

```ts
private otrClient = otr(SoonaverseOtrAddress.TEST).dataset(Dataset.NFT);
```

:::

After we have opened the deep link, we can track the transaction. So we use the tag of the request in the [`trackByTag`](../how-to/track-otrs.md) function and subscribe to it to get informed when there are updates on the purchase.

And that's it. You can learn more by playing with the example and creating your marketplace. Have fun trying it out.
