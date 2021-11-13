import { createRoutingFactory, Spectator } from '@ngneat/spectator/jest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProposalsPage } from './proposals.page';


describe('ProposalsPage', () => {
  let spectator: Spectator<ProposalsPage>;
  const createComponent = createRoutingFactory({
    component: ProposalsPage
  });


  beforeEach(() => {
    spectator = createComponent();
  });

it('write tests', () => {
  expect(spectator).toBeDefined();
});
});
