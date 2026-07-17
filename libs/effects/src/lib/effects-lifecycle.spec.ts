import {
  rxEffect,
  EffectCleanUpRef,
  RunOptions,
  RxEffect,
  EffectsSetupFn,
} from '../index';
import { TestBed } from '@angular/core/testing';
import { Component, DestroyRef, ErrorHandler, Injector } from '@angular/core';
import {
  config,
  interval,
  Observable,
  of,
  Subject,
  Subscription,
  throwError,
} from 'rxjs';

@Component({ template: '' })
class HostComponent {
  effects = rxEffect();
}

async function setup(errorHandlerMock?: { handleError: jest.Mock }) {
  await TestBed.configureTestingModule({
    declarations: [HostComponent],
    providers: errorHandlerMock
      ? [{ provide: ErrorHandler, useValue: errorHandlerMock }]
      : [],
  }).compileComponents();

  const fixture = TestBed.createComponent(HostComponent);
  return { fixture, effects: fixture.componentInstance.effects };
}

class FakeDestroyRef extends DestroyRef {
  private callbacks: Array<() => void> = [];
  destroyed = false;

  onDestroy(callback: () => void): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.callbacks.forEach((cb) => cb());
  }
}

describe(`${rxEffect.name} lifecycle`, () => {
  describe('onCleanUp idempotency', () => {
    it('should execute onCleanUp only once on repeated manual cleanUp (observable + sideEffectFn)', async () => {
      const { effects } = await setup();
      const spy = jest.fn();
      const noop = () => void 0;
      const ref = effects.run(new Subject<number>(), noop, {
        onCleanUp: spy,
      });

      ref.cleanUp();
      ref.cleanUp();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should execute onCleanUp only once on repeated manual cleanUp (observable + options only)', async () => {
      const { effects } = await setup();
      const spy = jest.fn();
      const ref = effects.run(new Subject<number>(), { onCleanUp: spy });

      ref.cleanUp();
      ref.cleanUp();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should execute onCleanUp only once on repeated manual cleanUp (subscription)', async () => {
      const { effects } = await setup();
      const spy = jest.fn();
      const ref = effects.run(new Subject<number>().subscribe(), {
        onCleanUp: spy,
      });

      ref.cleanUp();
      ref.cleanUp();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should execute onCleanUp only once when instance is destroyed and cleanUp is called afterwards', async () => {
      const { effects, fixture } = await setup();
      const spy = jest.fn();
      const noop = () => void 0;
      const ref = effects.run(new Subject<number>(), noop, {
        onCleanUp: spy,
      });

      fixture.destroy();
      ref.cleanUp();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should keep instance cleanUp idempotent', async () => {
      const { effects } = await setup();
      const spy = jest.fn();
      effects.runOnInstanceDestroy(spy);

      effects.cleanUp();
      effects.cleanUp();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('throwing user code', () => {
    it('should unsubscribe the effect even when onCleanUp throws', async () => {
      const errorHandler = { handleError: jest.fn() };
      const { effects } = await setup(errorHandler);
      const src$$ = new Subject<number>();
      const spy = jest.fn();
      const ref = effects.run(src$$, spy, {
        onCleanUp: () => {
          throw new Error('boom');
        },
      });

      ref.cleanUp();
      src$$.next(1);

      expect(spy).not.toHaveBeenCalled();
      expect(errorHandler.handleError).toHaveBeenCalledTimes(1);
    });

    it('should clean up already registered effects when setupFn throws', async () => {
      jest.useFakeTimers();
      const spy = jest.fn();
      await TestBed.configureTestingModule({}).compileComponents();

      expect(() =>
        TestBed.runInInjectionContext(() =>
          rxEffect(({ run }) => {
            run(interval(1000), spy);
            throw new Error('setup boom');
          })
        )
      ).toThrow('setup boom');

      jest.advanceTimersByTime(5000);
      expect(spy).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('should rethrow the setup error even when a registered teardown throws during cleanup', () => {
      const destroyRef = new FakeDestroyRef();

      expect(() =>
        rxEffect(
          ({ run }) => {
            run(
              new Subscription(() => {
                throw new Error('teardown boom');
              })
            );
            throw new Error('setup boom');
          },
          { destroyRef }
        )
      ).toThrow('setup boom');
    });
  });

  describe('error handling', () => {
    it('should forward source errors to the ErrorHandler and keep sibling effects alive', async () => {
      const errorHandler = { handleError: jest.fn() };
      const { effects } = await setup(errorHandler);
      const error = new Error('source error');
      const sibling$$ = new Subject<number>();
      const siblingSpy = jest.fn();

      effects.run(sibling$$, siblingSpy);
      effects.run(throwError(() => error), jest.fn());
      sibling$$.next(1);

      expect(errorHandler.handleError).toHaveBeenCalledWith(error);
      expect(siblingSpy).toHaveBeenCalledWith(1);
    });

    it('should log source errors when no ErrorHandler is available (destroyRef-only)', () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => void 0);

      try {
        const destroyRef = new FakeDestroyRef();
        const effects = rxEffect(undefined, { destroyRef });
        effects.run(throwError(() => new Error('source boom')), jest.fn());

        expect(consoleSpy).toHaveBeenCalledWith(
          '[rxEffect] Unhandled source error:',
          expect.objectContaining({ message: 'source boom' })
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('should not report an unhandled rxjs error when no ErrorHandler is available', () => {
      // a rethrow inside catchError would surface here and crash the host app
      jest.useFakeTimers();
      const unhandled = jest.fn();
      const previous = config.onUnhandledError;
      config.onUnhandledError = unhandled;
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => void 0);

      try {
        const destroyRef = new FakeDestroyRef();
        const effects = rxEffect(undefined, { destroyRef });
        const sibling$$ = new Subject<number>();
        const siblingSpy = jest.fn();

        effects.run(sibling$$, siblingSpy);
        effects.run(throwError(() => new Error('source boom')), jest.fn());
        jest.runAllTimers();
        sibling$$.next(1);

        expect(unhandled).not.toHaveBeenCalled();
        expect(siblingSpy).toHaveBeenCalledWith(1);
      } finally {
        config.onUnhandledError = previous;
        consoleSpy.mockRestore();
        jest.useRealTimers();
      }
    });
  });

  describe('behavior after instance destroy', () => {
    it('should not execute effects registered via run after cleanUp', async () => {
      const { effects } = await setup();
      const spy = jest.fn();

      effects.cleanUp();
      effects.run(of(1, 2, 3), spy);

      expect(spy).not.toHaveBeenCalled();
    });

    it('should unsubscribe a passed subscription after cleanUp and execute its onCleanUp', async () => {
      const { effects } = await setup();
      const src$$ = new Subject<number>();
      const spy = jest.fn();
      const onCleanUpSpy = jest.fn();

      effects.cleanUp();
      const sub = src$$.subscribe(spy);
      effects.run(sub, { onCleanUp: onCleanUpSpy });
      src$$.next(1);

      expect(sub.closed).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      expect(onCleanUpSpy).toHaveBeenCalledTimes(1);
    });

    it('should execute runOnInstanceDestroy immediately when registered after cleanUp', async () => {
      const { effects } = await setup();
      const spy = jest.fn();

      effects.cleanUp();
      effects.runOnInstanceDestroy(spy);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should still execute onCleanUp when the passed subscription throws on unsubscribe', async () => {
      const { effects } = await setup();
      const onCleanUpSpy = jest.fn();

      effects.cleanUp();
      const throwingSub = new Subscription(() => {
        throw new Error('unsubscribe boom');
      });

      expect(() =>
        effects.run(throwingSub, { onCleanUp: onCleanUpSpy })
      ).toThrow('unsubscribe boom');
      expect(onCleanUpSpy).toHaveBeenCalledTimes(1);
    });

    it('should return independent no-op cleanup refs after destroy', async () => {
      const { effects } = await setup();

      effects.cleanUp();
      const refA = effects.run(of(1));
      const refB = effects.run(of(2));

      expect(refA).not.toBe(refB);
    });
  });

  describe('injection context options', () => {
    it('should work outside an injection context when an injector is provided', async () => {
      await TestBed.configureTestingModule({}).compileComponents();
      const injector = TestBed.inject(Injector);
      const spy = jest.fn();

      const effects = rxEffect(({ run }) => run(of(1), spy), { injector });

      expect(spy).toHaveBeenCalledWith(1);
      expect(effects.cleanUp).toBeDefined();
    });

    it('should throw outside an injection context without injector or destroyRef', () => {
      expect(() => rxEffect()).toThrow();
    });

    it('should work outside an injection context with only a destroyRef', () => {
      const destroyRef = new FakeDestroyRef();
      const spy = jest.fn();
      const teardownSpy = jest.fn();
      const src$$ = new Subject<number>();

      const effects = rxEffect(undefined, { destroyRef });
      effects.run(src$$, spy);
      effects.runOnInstanceDestroy(teardownSpy);

      src$$.next(1);
      expect(spy).toHaveBeenCalledWith(1);

      destroyRef.destroy();
      src$$.next(2);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(teardownSpy).toHaveBeenCalledTimes(1);
    });

    it('should prefer a provided destroyRef over the injected one', async () => {
      const { fixture } = await setup();
      const destroyRef = new FakeDestroyRef();
      const spy = jest.fn();
      const src$$ = new Subject<number>();

      const effects = rxEffect(({ run }) => run(src$$, spy), {
        injector: fixture.componentRef.injector,
        destroyRef,
      });
      expect(effects).toBeDefined();

      destroyRef.destroy();
      src$$.next(1);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('public API', () => {
    it('should expose the public types via the barrel', async () => {
      const { effects } = await setup();

      // compile-time assertions: fails to build if barrel exports regress
      const instance: RxEffect = effects;
      const ref: EffectCleanUpRef = instance.run(of(1));
      const runOptions: RunOptions = { onCleanUp: () => void 0 };
      const setupFn: EffectsSetupFn = ({ run }) => run(of(1), runOptions);

      expect(typeof ref.cleanUp).toBe('function');
      expect(typeof setupFn).toBe('function');
    });

    it('should accept union typed sources (Observable | Subscription)', async () => {
      const { effects } = await setup();
      const spy = jest.fn();
      const source: Observable<number> | Subscription = of(1);

      // compile-time assertion: union sources must stay accepted
      const ref = effects.run(source, { onCleanUp: spy });
      ref.cleanUp();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
