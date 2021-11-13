import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AwardsPage } from './awards.page';


describe('AwardsPage', () => {
  let spectator: Spectator<AwardsPage>;
  const createComponent = createRoutingFactory({
    component: AwardsPage
  });


  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
