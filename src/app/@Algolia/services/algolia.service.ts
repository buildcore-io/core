import { Injectable } from '@angular/core';
import { CacheService } from "@core/services/cache/cache.service";
import { environment } from '@env/environment';
import { CollectionAccess, Space } from "@functions/interfaces/models";
import { UntilDestroy, untilDestroyed } from "@ngneat/until-destroy";
import algoliasearch from "algoliasearch/lite";
import { RefinementMappings } from "../refinement.component";

const spaceMapping: RefinementMappings = {};
const accessMapping: RefinementMappings = {};

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
    // quick & temporary ....
    this.cacheService.allSpaces$
      .pipe(untilDestroyed(this)).subscribe( (spaces) => {
        spaces.forEach((space: Space) => {
          if (space.name) {
            spaceMapping[space.uid] = space.name;
          }
        });
      })
    // very hacky... but let's go quick for now
    Object.values(CollectionAccess)
      .forEach((value, index) => {
        if (typeof value === 'string') {
          accessMapping[''+index] = value
        }
      })
  }
  public convertToSpaceName(algoliaItems: any[]) {
    console.log(`convertToSpaceName ${algoliaItems.length}`, algoliaItems)
    return algoliaItems.map(algolia => {
      const name = spaceMapping[algolia.value] || algolia.label.substring(0, 10) + '... (no name found???)'
      return {
        ...algolia,
        label: name,
        highlighted: name,
      }
    });
  }

  public convertToAccessName(algoliaItems: any[]) {
    console.log(`convertToAccessName ${algoliaItems.length}`, algoliaItems)

    return algoliaItems.map(algolia => {
      const name = accessMapping[algolia.value] || algolia.label;
      return {
        ...algolia,
        label: name,
        highlighted: name,
      }
    });
  }

}
