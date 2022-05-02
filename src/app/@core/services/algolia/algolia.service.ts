import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import algoliasearch from "algoliasearch/lite";
import {UntilDestroy, untilDestroyed} from "@ngneat/until-destroy";
import {CollectionAccess, Space} from "@functions/interfaces/models";
import {CacheService} from "@core/services/cache/cache.service";
import {Mappings} from "../../../@algolia/refinement.component";

const spaceMapping: Mappings = {};
const accessMapping: Mappings = {};

@UntilDestroy()
@Injectable({
  providedIn: 'root'
})
export class AlgoliaService {
  // public modalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly searchClient = algoliasearch(
    '2WGM1RPQKZ',
    '4c4da0d2d8b2d582b6f5f232b75314b4'
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
      const name = accessMapping[algolia.value] || algolia.label.substring(0, 10) + '...'
      return {
        ...algolia,
        label: name,
        highlighted: name,
      }
    });
  }

}
