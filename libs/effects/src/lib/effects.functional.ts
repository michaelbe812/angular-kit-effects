import {
  DestroyRef,
  ErrorHandler,
  inject,
  Injector,
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

export type RunOptions = {
  onCleanUp?: () => void;
};

export type RxEffect = {
  run(sub: Subscription, options?: RunOptions): EffectCleanUpRef;
  run<T>(o$: Observable<T>, options?: RunOptions): EffectCleanUpRef;
  run<T>(
    o$: Observable<T>,
    sideEffectFn: (arg: T) => void,
    options?: RunOptions
  ): EffectCleanUpRef;
  run<T>(
    obsOrSub: Observable<T> | Subscription,
    options?: RunOptions
  ): EffectCleanUpRef;
  runOnInstanceDestroy: (sideEffectFn: () => void) => EffectCleanUpRef;
  cleanUp: () => void;
};

export type EffectsSetupFn = (
  rxEffect: Pick<RxEffect, 'run' | 'runOnInstanceDestroy'>
) => void;

function isRunOptions(obj: unknown): obj is RunOptions {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as RunOptions).onCleanUp === 'function'
  );
}

function noopCleanUpRef(): EffectCleanUpRef {
  return { cleanUp: () => void 0 };
}

/**
 * @description
 * Functional way to setup observable based side effects.
 *
 * It will destroy itself when the provided {@link DestroyRef} is destroyed.
 *
 * Must be called in an injection context, unless an `injector` or a
 * `destroyRef` is provided via options.
 *
 * @param setupFn
 * @param options
 *
 * @example
 *
 * const ef = rxEffect(({run, runOnInstanceDestroy}) => {
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
): RxEffect {
  const providedDestroyRef = options?.destroyRef ?? null;

  let injector: Injector | null = null;
  try {
    injector = assertInjector(rxEffect, options?.injector);
  } catch (error) {
    // a provided DestroyRef replaces the injection context requirement
    if (!providedDestroyRef) throw error;
  }

  if (!injector) {
    // outside any injection context: no ErrorHandler available
    return createEffects(setupFn, providedDestroyRef as DestroyRef, null);
  }

  return runInInjectionContext(injector, () =>
    createEffects(
      setupFn,
      providedDestroyRef ?? inject(DestroyRef),
      inject(ErrorHandler, { optional: true })
    )
  );
}

function createEffects(
  setupFn: EffectsSetupFn | undefined,
  destroyRef: DestroyRef,
  errorHandler: ErrorHandler | null
): RxEffect {
  let nextId = 0;
  let destroyed = false;
  const rootSub = new Subscription();
  const idSubMap = new Map<number, Subscription>();
  const destroyHook$$ = new ReplaySubject<void>(1);

  /**
   * Route errors thrown by user provided cleanup logic to the ErrorHandler
   * so one failing teardown cannot break the remaining cleanup work.
   * Rethrows when no ErrorHandler is available.
   */
  function invokeGuarded(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      if (errorHandler) {
        errorHandler.handleError(error);
      } else {
        throw error;
      }
    }
  }

  function register(subscription: Subscription): number {
    const effectId = nextId++;
    idSubMap.set(effectId, subscription);
    // remove the map entry as soon as the subscription closes for any
    // reason (manual cleanUp, instance destroy, completion, error)
    subscription.add(() => idSubMap.delete(effectId));
    rootSub.add(subscription);
    return effectId;
  }

  /**
   * Cancel a registered side effect
   * @param effectId
   */
  function unregister(effectId: number): void {
    idSubMap.get(effectId)?.unsubscribe();
    idSubMap.delete(effectId);
  }

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
   * ef = rxEffect(({run})=> run(source$.subscribe(console.log)))
   * ```
   * @param sub
   * @param options
   */
  function run(sub: Subscription, options?: RunOptions): EffectCleanUpRef;
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
   * ef = rxEffect(({run})=> run(source$.pipe(tap(console.log))))
   * ```
   *
   * @param o$
   * @param options
   */
  function run<T>(o$: Observable<T>, options?: RunOptions): EffectCleanUpRef;
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
   * ef = rxEffect(({run})=> run(trigger$, effect))
   * ```
   *
   * @param o$
   * @param sideEffectFn
   * @param options
   */
  function run<T>(
    o$: Observable<T>,
    sideEffectFn: (arg: T) => void,
    options?: RunOptions
  ): EffectCleanUpRef;
  /**
   * @description
   * Accepts a source that is either an observable or an already created
   * subscription (union typed variables).
   *
   * @param obsOrSub
   * @param options
   */
  function run<T>(
    obsOrSub: Observable<T> | Subscription,
    options?: RunOptions
  ): EffectCleanUpRef;
  function run<T>(
    obsOrSub: Observable<T> | Subscription,
    sideEffectFnOrOptions?: ((arg: T) => void) | RunOptions,
    options?: RunOptions
  ): EffectCleanUpRef {
    const sideEffectFn =
      typeof sideEffectFnOrOptions === 'function'
        ? sideEffectFnOrOptions
        : undefined;
    const runOptions = isRunOptions(sideEffectFnOrOptions)
      ? sideEffectFnOrOptions
      : isRunOptions(options)
      ? options
      : undefined;

    if (destroyed) {
      // the instance is gone: never start new work. A passed subscription
      // is already live, so it is stopped and its cleanup executed.
      if (obsOrSub instanceof Subscription) {
        try {
          obsOrSub.unsubscribe();
        } finally {
          if (runOptions?.onCleanUp) invokeGuarded(runOptions.onCleanUp);
        }
      }
      return noopCleanUpRef();
    }

    const subscription =
      obsOrSub instanceof Subscription
        ? obsOrSub
        : obsOrSub
            .pipe(
              // execute operation/ side effect
              sideEffectFn ? tap(sideEffectFn) : pipe(),
              catchError((error) => {
                if (errorHandler) {
                  errorHandler.handleError(error);
                  return EMPTY;
                }
                // no ErrorHandler available (destroyRef-only usage):
                // rethrow so rxjs reports an unhandled error instead of
                // swallowing it silently (same policy as invokeGuarded)
                throw error;
              })
            )
            .subscribe();

    const effectId = register(subscription);

    // onCleanUp must execute exactly once: on manual cleanUp or on
    // instance destroy, whichever comes first
    let cleanUpExecuted = false;
    const executeOnCleanUp = () => {
      if (cleanUpExecuted) return;
      cleanUpExecuted = true;
      if (runOptions?.onCleanUp) invokeGuarded(runOptions.onCleanUp);
    };

    let destroyHookSub: Subscription | null = null;
    if (runOptions?.onCleanUp) {
      destroyHookSub = destroyHook$$.subscribe(executeOnCleanUp);
      rootSub.add(destroyHookSub);
    }

    return {
      cleanUp: () => {
        try {
          executeOnCleanUp();
        } finally {
          destroyHookSub?.unsubscribe();
          unregister(effectId);
        }
      },
    };
  }

  /**
   * Execute a sideEffect when the rxEffect instance is destroyed or cleaned up.
   *
   * When called after the instance was already destroyed the sideEffect
   * executes immediately (mirrors RxJS `Subscription.add` on a closed subscription).
   * @param sideEffectFn
   */
  function runOnInstanceDestroy(sideEffectFn: () => void): EffectCleanUpRef {
    if (destroyed) {
      invokeGuarded(sideEffectFn);
      return noopCleanUpRef();
    }
    return run(
      destroyHook$$.pipe(tap(() => invokeGuarded(sideEffectFn))).subscribe()
    );
  }

  // Cleanup function - idempotent
  function cleanUp(): void {
    if (destroyed) return;
    destroyed = true;
    destroyHook$$.next(void 0);
    destroyHook$$.complete();
    rootSub.unsubscribe();
    idSubMap.clear();
  }

  const effects: RxEffect = {
    run,
    runOnInstanceDestroy,
    cleanUp,
  };

  // Register the cleanup on destroy BEFORE running the setup so effects
  // registered before a throwing setupFn do not leak
  destroyRef.onDestroy(() => {
    effects.cleanUp();
  });

  if (setupFn) {
    try {
      setupFn({
        run: effects.run,
        runOnInstanceDestroy: effects.runOnInstanceDestroy,
      });
    } catch (error) {
      try {
        effects.cleanUp();
      } catch (cleanUpError) {
        // the setup error takes precedence over failing teardown logic
        errorHandler?.handleError(cleanUpError);
      }
      throw error;
    }
  }

  return effects;
}
