import {
  DestroyRef,
  ErrorHandler,
  inject,
  Injectable,
  Injector,
  Optional,
  runInInjectionContext,
} from '@angular/core';
import {
  catchError,
  EMPTY,
  Observable,
  pipe,
  ReplaySubject,
  Subscription,
  tap,
} from 'rxjs';
import { assertInjector } from './assert-injector';

export type EffectCleanUpRef = {
  cleanUp: () => void;
};

type RunOptions = {
  onCleanUp?: () => void;
};

export function isRunOptionsGuard(obj: any): obj is RunOptions {
  return (
    typeof obj === 'object' &&
    obj?.onCleanUp !== undefined &&
    typeof obj.onCleanUp === 'function'
  );
}

type EffectsSetupFn = (rxEffect: {
  run: <T>(
    obsOrSub$: Observable<T> | Subscription,
    sideEffectFn?: ((arg: T) => void) | RunOptions,
    options?: RunOptions
  ) => EffectCleanUpRef;
  runOnInstanceDestroy: (sideEffectFn: () => void) => EffectCleanUpRef;
}) => void;

/**
 * @description
 * Functional way to setup observable based side effects.
 *
 * It will destroy itself when the provided {@link DestroyRef} is destroyed.
 *
 * @param setupFn
 * @param options
 *
 * @example
 *
 * const ef = effects(({run, runOnInstanceDestroy}) => {
 *     run(source$, console.log)
 *
 *     run(source$.subscribe(console.log))
 *
 *     run(source$.pipe(tap(console.log)))
 *
 *     runOnInstanceDestroy(() => {
 *       // any teardown logic, e.g unsubscribe from any source, clear timers etc.
 *     })
 * })
 */
export function rxEffect(
  setupFn?: EffectsSetupFn,
  options?: {
    injector?: Injector;
    destroyRef?: DestroyRef;
  }
) {
  const injector = assertInjector(rxEffect, options?.injector);

  return runInInjectionContext(injector, () => {
    const errorHandler = inject(ErrorHandler, { optional: true });
    const destroyRef = options?.destroyRef ?? inject(DestroyRef);

    let nextId = 0;
    const sub = new Subscription();
    const idSubMap = new Map<number, Subscription>();
    const destroyHook$$ = new ReplaySubject<void>(1);

    // Inner function for unregistering an effect
    function unregister(effectId: number): void {
      const subscription = idSubMap.get(effectId);
      if (subscription) {
        subscription.unsubscribe();
      }
    }

    // Implementation of run method
    function run<T>(
      obsOrSub$: Observable<T> | Subscription,
      sideEffectFn?: ((arg: T) => void) | RunOptions,
      options?: RunOptions
    ): EffectCleanUpRef {
      const effectId = nextId++;

      if (obsOrSub$ instanceof Subscription) {
        sub.add(obsOrSub$);
        idSubMap.set(effectId, obsOrSub$);
        let runOnInstanceDestroySub: undefined | EffectCleanUpRef = undefined;
        if (sideEffectFn ?? isRunOptionsGuard(sideEffectFn)) {
          runOnInstanceDestroySub = runOnInstanceDestroy(() =>
            (sideEffectFn as RunOptions).onCleanUp?.()
          );
        }

        return {
          cleanUp: () => {
            if (sideEffectFn ?? isRunOptionsGuard(sideEffectFn)) {
              (sideEffectFn as RunOptions).onCleanUp?.();
              runOnInstanceDestroySub?.cleanUp();
            }
            unregister(effectId);
          },
        };
      }

      const subscription = obsOrSub$
        .pipe(
          // execute operation/ side effect
          sideEffectFn && typeof sideEffectFn === 'function'
            ? tap(sideEffectFn)
            : pipe(),
          catchError((err) => {
            errorHandler?.handleError(err);
            return EMPTY;
          })
        )
        .subscribe();
      sub.add(subscription);
      idSubMap.set(effectId, subscription);

      // cases sideEffectFn is a CleanUpRef OR options given
      let runOnInstanceDestroySub: undefined | EffectCleanUpRef = undefined;
      if (options && options.onCleanUp) {
        runOnInstanceDestroySub = runOnInstanceDestroy(() =>
          options.onCleanUp?.()
        );
      }
      if (sideEffectFn && isRunOptionsGuard(sideEffectFn)) {
        runOnInstanceDestroySub = runOnInstanceDestroy(() =>
          (sideEffectFn as RunOptions).onCleanUp?.()
        );
      }

      return {
        cleanUp: () => {
          if (options && options.onCleanUp) {
            options.onCleanUp?.();
            runOnInstanceDestroySub?.cleanUp();
          }
          if (sideEffectFn && isRunOptionsGuard(sideEffectFn)) {
            (sideEffectFn as RunOptions).onCleanUp?.();
            runOnInstanceDestroySub?.cleanUp();
          }
          unregister(effectId);
        },
      };
    }

    // Implementation of runOnInstanceDestroy
    function runOnInstanceDestroy(sideEffectFn: () => void) {
      return run(destroyHook$$.pipe(tap(sideEffectFn)).subscribe());
    }

    // Cleanup function
    function cleanUp() {
      destroyHook$$.next(void 0);
      sub.unsubscribe();
    }

    const effects = {
      run,
      runOnInstanceDestroy,
      cleanUp,
    };

    // Setup the effects
    setupFn?.({
      run: effects.run,
      runOnInstanceDestroy: effects.runOnInstanceDestroy,
    });

    // Register the cleanup on destroy
    destroyRef.onDestroy(() => {
      effects.cleanUp();
    });

    return effects;
  });
}
