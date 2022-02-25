import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NFTPage } from './nft.page';


describe('NFTPage', () => {
  let component: NFTPage;
  let fixture: ComponentFixture<NFTPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NFTPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NFTPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
