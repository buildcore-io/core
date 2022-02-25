import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NFTsPage } from './nfts.page';

describe('NFTsPage', () => {
  let component: NFTsPage;
  let fixture: ComponentFixture<NFTsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NFTsPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NFTsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
