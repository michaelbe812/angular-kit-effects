import { Effects, rxEffect } from './effects';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Component, inject, OnDestroy } from '@angular/core';
import { interval, of, Subject, tap } from 'rxjs';

describe(`${rxEffect.name} standalone`, () => {
  it('should create instance of Effects', async () => {
    const { effects } = await setupSingleEffectsInstance();
    expect(effects).toBeInstanceOf(Effects);
  });
  describe('run', () => {
    it('should accept subscription and execute side effect', async () => {
      const { effects } = await setupSingleEffectsInstance();
      const spy = jest.fn();
      effects.run(of(1).pipe(tap((x) => spy(x))));

      expect(spy).toHaveBeenCalledWith(1);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should accept observable and execute side effect', async () => {
      const { effects } = await setupSingleEffectsInstance();

      const spy = jest.fn();
      effects.run(of(1), (v) => spy(v));

      expect(spy).toHaveBeenCalledWith(1);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
  describe('OnDestroy', () => {
    it('should unsubscribe from all sources', fakeAsync(async () => {
      const { effects, fixture } = await setupSingleEffectsInstance();
      const spy = jest.fn();
      effects.run(interval(1), (v) => spy(v));
      tick(1);
      expect(spy).toHaveBeenCalledWith(0);
      expect(spy).toHaveBeenCalledTimes(1);

      fixture.destroy();
      tick(1);

      expect(spy).not.toHaveBeenCalledWith(1);
      expect(spy).toHaveBeenCalledTimes(1);
    }));

    it('should execute functions registered in runOnInstanceCleanUp ', async () => {
      const { effects, fixture } = await setupSingleEffectsInstance();
      const spy = jest.fn();
      effects.runOnInstanceCleanUp(() => spy());

      fixture.destroy();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('CleanUp on single effect', () => {
    it('should unsubscribe from single effect when calling cleanUp', fakeAsync(async () => {
      const { effects, service } = await setupSingleEffectsInstance();
      const trigger$$ = new Subject<number>();
      const effect1 = effects.run(trigger$$, (v) => service.triggerEffect(v));
      const effect2 = effects.run(interval(10), (v) => service.sourceEffect(v));

      trigger$$.next(10);
      tick(10);
      effect2.cleanUp();

      tick(20);
      trigger$$.next(20);
      effect1.cleanUp();

      trigger$$.next(30);

      expect(service.triggerEffect).toBeCalledTimes(2);
      expect(service.triggerEffect).toHaveBeenNthCalledWith(1, 10);
      expect(service.triggerEffect).toHaveBeenNthCalledWith(2, 20);

      expect(service.sourceEffect).toBeCalledTimes(1);
      expect(service.sourceEffect).toHaveBeenNthCalledWith(1, 0);
    }));
    it('should execute the cleanUp function when the effect is cleaned-up', async () => {
      const { service, effects } = await setupSingleEffectsInstance();
      // scenario call .cleanUp on a single effect

      const trigger$$ = new Subject<number>();
      const cleanUpSpy = jest.fn();
      const cleanUpSpy2 = jest.fn();
      const cleanUpSpy3 = jest.fn();

      const effect = effects.run(trigger$$, (v) => service.triggerEffect(v), {
        onCleanUp: cleanUpSpy,
      });
      const effect2 = effects.run(
        trigger$$.subscribe((v) => service.triggerEffect(v)),
        {
          onCleanUp: cleanUpSpy2,
        }
      );

      const effect3 = effects.run(
        trigger$$.pipe(tap((v) => service.triggerEffect(v))),
        {
          onCleanUp: cleanUpSpy3,
        }
      );

      trigger$$.next(10);
      effect.cleanUp();
      effect2.cleanUp();
      effect3.cleanUp();

      expect(cleanUpSpy).toBeCalledTimes(1);
      expect(cleanUpSpy2).toBeCalledTimes(1);
      expect(cleanUpSpy3).toBeCalledTimes(1);
    });
    it('should execute the cleanUp function when the effects-instance is destroyed', fakeAsync(async () => {
      // scenario call .cleanUp on a single effect
      const { service, fixture, effects } = await setupSingleEffectsInstance();

      const trigger$$ = new Subject<number>();
      const cleanUpSpy = jest.fn();
      const cleanUpSpy2 = jest.fn();
      const cleanUpSpy3 = jest.fn();

      const effect = effects.run(
        trigger$$.subscribe((v) => service.triggerEffect(v)),
        {
          onCleanUp: cleanUpSpy,
        }
      );

      const effect2 = effects.run(trigger$$, (v) => service.triggerEffect(v), {
        onCleanUp: cleanUpSpy2,
      });

      const effect3 = effects.run(
        trigger$$.pipe(tap((v) => service.triggerEffect(v))),
        {
          onCleanUp: cleanUpSpy3,
        }
      );

      trigger$$.next(10);
      fixture.destroy();
      tick();

      // cleanup function on effect should be called
      expect(cleanUpSpy).toBeCalledTimes(1);
      expect(cleanUpSpy2).toBeCalledTimes(1);
      expect(cleanUpSpy3).toBeCalledTimes(1);
    }));
    it('should NOT execute the cleanUp function again when the effects-instance is destroyed but the cleanUp has been executed beforehand', async () => {
      const { service, component, fixture, effects } =
        await setupSingleEffectsInstance();

      const trigger$$ = new Subject<number>();
      const cleanUpSpy = jest.fn();
      const cleanUpSpy2 = jest.fn();
      const cleanUpSpy3 = jest.fn();

      const effect = effects.run(
        trigger$$.subscribe((v) => service.triggerEffect(v)),
        {
          onCleanUp: cleanUpSpy,
        }
      );

      const effect2 = effects.run(trigger$$, (v) => service.triggerEffect(v), {
        onCleanUp: cleanUpSpy2,
      });
      const effect3 = effects.run(
        trigger$$.pipe(tap((v) => service.triggerEffect(v))),
        {
          onCleanUp: cleanUpSpy3,
        }
      );

      trigger$$.next(10);
      effect.cleanUp();
      effect2.cleanUp();
      effect3.cleanUp();
      fixture.destroy();

      // cleanup function on effect should be called
      expect(cleanUpSpy).toBeCalledTimes(1);
      expect(cleanUpSpy2).toBeCalledTimes(1);
      expect(cleanUpSpy3).toBeCalledTimes(1);
    });
  });
});

async function setupSingleEffectsInstance() {
  const serviceMock = {
    sourceEffect: jest.fn(),
    triggerEffect: jest.fn(),
    teardownEffect: jest.fn(),
  };
  await TestBed.configureTestingModule({
    providers: [{ provide: Service, useValue: serviceMock }],
    declarations: [TestSingleEffectsInstanceComponent],
  }).compileComponents();

  jest.restoreAllMocks();
  jest.clearAllMocks();

  const fixture = TestBed.createComponent(TestSingleEffectsInstanceComponent);
  const component = fixture.componentInstance;
  const service = TestBed.inject(Service);

  return {
    component,
    fixture,
    service,
    effects: component.effects,
  };
}

class Service {
  sourceEffect(v: number) {
    return v;
  }
  triggerEffect(v: number) {
    return v;
  }
  teardownEffect() {}
}

@Component({
  template: '',
})
class TestSingleEffectsInstanceComponent implements OnDestroy {
  service = inject(Service);

  effects = rxEffect();

  ngOnDestroy() {}
}
