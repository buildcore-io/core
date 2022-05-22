import { Injectable } from '@angular/core';
import { RefinementMappings } from "@components/algolia/refinement/refinement.component";
import { CacheService } from "@core/services/cache/cache.service";
import { enumToArray } from '@core/utils/manipulations.utils';
import { environment } from '@env/environment';
import { Categories, CollectionAccess, Space } from "@functions/interfaces/models";
import { NftAvailable } from '@functions/interfaces/models/nft';
import { UntilDestroy, untilDestroyed } from "@ngneat/until-destroy";
import algoliasearch from "algoliasearch/lite";

const spaceMapping: RefinementMappings = {};
const accessMapping: RefinementMappings = {};
const spacesObj: { [key: string]: Space } = {};

@UntilDestroy()
@Injectable({
  providedIn: 'root'
})
export class AlgoliaService {
  public readonly searchClient = algoliasearch(
    environment.algolia.appId,
    environment.algolia.key
  );

  constructor( private readonly cacheService: CacheService,
  ) {
    this.cacheService.allSpaces$
      .pipe(untilDestroyed(this)).subscribe((spaces) => {
        spaces.forEach((space: Space) => {
          if (space.name) {
            spaceMapping[space.uid] = space.name;
            spacesObj[space.uid] = space;
          }
        });
      })
    Object.values(CollectionAccess)
      .forEach((value, index) => {
        if (typeof value === 'string') {
          accessMapping[''+index] = value
        }
      })
  }

  public convertToSpaceName(algoliaItems: any[]) {
    return algoliaItems.map(algolia => {
      const name = spaceMapping[algolia.value] || algolia.label.substring(0, 10)
      return {
        ...algolia,
        label: name,
        highlighted: name,
        avatar: spacesObj[algolia.value]?.avatarUrl,
      }
    });
  }

  public convertToAccessName(algoliaItems: any[]) {
    return algoliaItems.map(algolia => {
      let label = $localize`Open`;
      if (Number(algolia.value) === CollectionAccess.GUARDIANS_ONLY) {
        label = $localize`Guardians of Space Only`;
      } else if (Number(algolia.value) === CollectionAccess.MEMBERS_ONLY) {
        label = $localize`Members of Space Only`;
      } else if (Number(algolia.value) === CollectionAccess.MEMBERS_WITH_BADGE) {
        label = $localize`Members With Badge Only`;
      } else if (Number(algolia.value) === CollectionAccess.MEMBERS_WITH_NFT_FROM_COLLECTION) {
        label = $localize`Members With NFT only`;
      }

      return {
        ...algolia,
        label: label,
        highlighted: label
      }
    });
  }

  public convertNftAvailable(algoliaItems: any[]) {
    return algoliaItems.map(algolia => {
      let label = $localize`Unavailable for sale`;
      if (Number(algolia.value) === NftAvailable.AUCTION) {
        label = $localize`Auction`;
      } else if (Number(algolia.value) === NftAvailable.AUCTION_AND_SALE) {
        label = $localize`Available`;
      } else if (Number(algolia.value) === NftAvailable.SALE) {
        label = $localize`On Sale`;
      }

      return {
        ...algolia,
        label: label,
        highlighted: label,
      }
    });
  }

  public convertCollectionCategory(algoliaItems: any[]) {
    const categories = enumToArray(Categories)
    return algoliaItems.map(algolia => {
      const label = categories.find(category => category.key === algolia.value)?.value
      return {
        ...algolia,
        label: label,
        highlighted: label
      }
    });
  }
}
