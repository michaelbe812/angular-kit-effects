import { getCounter, getGreeting, getStopCounterButton } from '../support/app.po';

describe('demo', () => {
  beforeEach(() => cy.visit('/'));

  it('should display the demo page', () => {
    getGreeting().contains('Welcome demo');
  });

  it('should show the rxEffect-driven counter', () => {
    getCounter().should('exist').and('contain', 'Counter:');
  });

  it('should have a stop counter button', () => {
    getStopCounterButton().should('exist').and('contain', 'Stop counter');
  });
});
