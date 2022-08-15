import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CollectionMintNetworkComponent } from './collection-mint-network.component';

describe('CollectionMintNetworkComponent', () => {
  let component: CollectionMintNetworkComponent;
  let fixture: ComponentFixture<CollectionMintNetworkComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      declarations: [ CollectionMintNetworkComponent ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CollectionMintNetworkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
