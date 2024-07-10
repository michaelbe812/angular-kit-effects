import { DestroyRef, ErrorHandler, inject, Injectable, Injector, Optional, runInInjectionContext } from '@angular/core';
import { catchError, EMPTY, Observable, pipe, ReplaySubject, Subscription, tap } from 'rxjs';
import { assertInjector } from './assert-injector';

export type EffectCleanUpRef = {
  cleanUp: () => void;
};

type RunOptions = {
  onCleanUp?: () => void;
};

export function isRunOptionsGuard(obj: any): obj is RunOptions {
  return typeof obj === 'object' && obj?.onCleanUp !== undefined && typeof obj.onCleanUp === 'function';
}

/**
 * @internal
 *
 * @description
 * Keeps track of your subscriptions and unsubscribes them automatically when destroyed.
 *
 */
@Injectable()
export class Effects {
  private static nextId = 0;
  private readonly sub = new Subscription();
  private readonly idSubMap = new Map<number, Subscription>();
  private readonly destroyHook$$ = new ReplaySubject<void>(1);

  constructor(@Optional() private readonly errorHandler: ErrorHandler | null) {}

  /**
   * @description
   * Manage the subscription of an observable and execute the side effect.
   *
   * Unsubscribes automatically when the provided {@link DestroyRef} is destroyed.
   *
   * Manually unsubscribe by calling {@link EffectCleanUpRef.cleanUp}.
   *
   * @example
   * ```typescript
   * ef = effects(({run})=> run(source$.subscribe(console.log)))
   * ```
   * @param sub
   * @param options
   */
  run(sub: Subscription, options?: RunOptions): EffectCleanUpRef;
  /**
   * @description
   * Subscribe to the passed observable and execute the side effect.
   *
   * Unsubscribes automatically when the provided {@link DestroyRef} is destroyed.
   *
   * Manually unsubscribe by calling {@link EffectCleanUpRef.cleanUp}.
   *
   * @example
   * ```typescript
   * ef = effects(({run})=> run(source$.pipe(tap(console.log))))
   * ```
   *
   * @param o$
   * @param options
   */
  run<T>(o$: Observable<T>, options?: RunOptions): EffectCleanUpRef;
  /**
   * @description
   * Subscribe to the passed observable and execute the side effect.
   *
   * Unsubscribes automatically when the provided {@link DestroyRef} is destroyed.
   *
   * Manually unsubscribe by calling {@link EffectCleanUpRef.cleanUp}.
   *
   * @example
   * ```typescript
   * const trigger$ = of(1);
   * const effect = console.log;
   * ef = effects(({run})=> run(trigger$, effect))
   * ```
   *
   * @param o$
   * @param sideEffectFn
   * @param options
   */
  run<T>(o$: Observable<T>, sideEffectFn: (arg: T) => void, options?: RunOptions): EffectCleanUpRef;
  /**
   * @internal
   */
  run<T>(
    obsOrSub$: Observable<T> | Subscription,
    sideEffectFn?: ((arg: T) => void) | RunOptions,
    options?: RunOptions
  ): EffectCleanUpRef {
    const effectId = Effects.nextId++;

    if (obsOrSub$ instanceof Subscription) {
      this.sub.add(obsOrSub$);
      this.idSubMap.set(effectId, obsOrSub$);
      let runOnInstanceDestroySub: undefined | EffectCleanUpRef = undefined;
      if (sideEffectFn ?? isRunOptionsGuard(sideEffectFn)) {
        runOnInstanceDestroySub = this.runOnInstanceCleanUp(() => (sideEffectFn as RunOptions).onCleanUp?.());
      }

      return {
        cleanUp: () => {
          if (sideEffectFn ?? isRunOptionsGuard(sideEffectFn)) {
            (sideEffectFn as RunOptions).onCleanUp?.();
            runOnInstanceDestroySub?.cleanUp();
          }
          this.unregister(effectId);
        },
      };
    }

    const subscription = obsOrSub$
      .pipe(
        // execute operation/ side effect
        sideEffectFn && typeof sideEffectFn === 'function' ? tap(sideEffectFn) : pipe(),
        catchError((err) => {
          this.errorHandler?.handleError(err);
          return EMPTY;
        })
      )
      .subscribe();
    this.sub.add(subscription);
    this.idSubMap.set(effectId, subscription);

    // cases sideEffectFn is a CleanUpRef OR options given
    let runOnInstanceDestroySub: undefined | EffectCleanUpRef = undefined;
    if (options && options.onCleanUp) {
      runOnInstanceDestroySub = this.runOnInstanceCleanUp(() => options.onCleanUp?.());
    }
    if (sideEffectFn && isRunOptionsGuard(sideEffectFn)) {
      runOnInstanceDestroySub = this.runOnInstanceCleanUp(() => (sideEffectFn as RunOptions).onCleanUp?.());
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
        this.unregister(effectId);
      },
    };
  }

  /**
   * Execute a sideEffect when the rxEffect instance OnDestroy hook is executed
   * @param sideEffectFn
   */
  runOnInstanceCleanUp(sideEffectFn: () => void) {
    return this.run(this.destroyHook$$.pipe(tap(sideEffectFn)).subscribe());
  }

  /**
   * Cancel a registered side effect
   * @param effectId
   */
  private unregister(effectId: number): void {
    const sub = this.idSubMap.get(effectId);
    if (sub) {
      sub.unsubscribe();
    }
  }

  cleanUp() {
    this.destroyHook$$.next(void 0);
    this.sub.unsubscribe();
  }
}


type EffectsSetupFn = (rxEffect: Pick<Effects, 'run' | 'runOnInstanceCleanUp' >) => void;


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
): Effects {
  const injector = assertInjector(rxEffect, options?.injector);
  return runInInjectionContext(injector, () => {
    const errorHandler = inject(ErrorHandler, { optional: true });
    const destroyRef = options?.destroyRef ?? inject(DestroyRef);
    const effects = new Effects(errorHandler);

    const teardownFn = setupFn?.({
      run: effects.run.bind(effects),
      runOnInstanceCleanUp: effects.runOnInstanceCleanUp.bind(effects),
    });


    destroyRef.onDestroy(() => {
      effects.cleanUp()
    });

    return effects;
  });
}
