import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { RouterTestingModule } from '@angular/router/testing';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterTestingModule],
    }).compileComponents();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Welcome demo');
  });

  it(`should have as title 'demo'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('demo');
  });

  it('should render the counter and increment it via the interval effect', () => {
    jest.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(
        compiled.querySelector('[data-testid="counter"]')?.textContent
      ).toContain('Counter: 0');

      jest.advanceTimersByTime(2000);
      fixture.detectChanges();
      expect(
        compiled.querySelector('[data-testid="counter"]')?.textContent
      ).toContain('Counter: 2');
    } finally {
      jest.useRealTimers();
    }
  });

  it('should stop the counter when the stop button is clicked', () => {
    jest.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      jest.advanceTimersByTime(1000);
      const button = fixture.nativeElement.querySelector(
        '[data-testid="stop-counter"]'
      ) as HTMLButtonElement;
      button.click();

      jest.advanceTimersByTime(3000);
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-testid="counter"]')
          ?.textContent
      ).toContain('Counter: 1');
    } finally {
      jest.useRealTimers();
    }
  });
});
