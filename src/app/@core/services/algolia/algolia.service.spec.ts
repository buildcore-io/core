import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { MockProvider } from 'ng-mocks';
import {TestBed} from "@angular/core/testing";
import {AlgoliaService} from "@core/services/algolia/algolia.service";
import {CacheService} from "@core/services/cache/cache.service";
import {BehaviorSubject} from "rxjs";
import {Collection, Space} from "@functions/interfaces/models";

describe('AlgoliaService', () => {
  let service: AlgoliaService;
  const allSpaces$ = new BehaviorSubject<Space[]>([]);
  const allCollections$ = new BehaviorSubject<Collection[]>([]);


  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MockProvider(CacheService, {allSpaces$, allCollections$})
      ],
    });
    service = TestBed.inject(AlgoliaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

});

