import { DestroyRef, ErrorHandler, inject, Injector, runInInjectionContext } from '@angular/core';
import { catchError, EMPTY, Observable, pipe, Subscription, tap } from 'rxjs';

type ReactiveEffectOptions = {
  injector?: Injector;
};

type TeardownFn = () => void;

/**
 * Standalone function to manage a single effect/ subscription.
 *
 * If you want to manage multiple effects at once use {@link rxEffects}.
 *
 * @example
 * const logEffect = rxEffect(source$, console.log)
 */
export function rxEffect(sub: Subscription): Subscription;
export function rxEffect(sub: Subscription, options: ReactiveEffectOptions): Subscription;
export function rxEffect(sub: Subscription, options: ReactiveEffectOptions, teardown: TeardownFn): Subscription;
export function rxEffect(sub: Subscription, teardown: TeardownFn): Subscription;

export function rxEffect<T>(o$: Observable<T>): Subscription;
export function rxEffect<T>(o$: Observable<T>, options: ReactiveEffectOptions): Subscription;
export function rxEffect<T>(
  o$: Observable<T>,
  options: ReactiveEffectOptions,
  teardown: TeardownFn
): Subscription;
export function rxEffect<T>(o$: Observable<T>, sideEffectFn: (arg: T) => void): Subscription;
export function rxEffect<T>(
  o$: Observable<T>,
  sideEffectFn: (arg: T) => void,
  teardown: TeardownFn
): Subscription;
export function rxEffect<T>(
  o$: Observable<T>,
  sideEffectFn: (arg: T) => void,
  options: ReactiveEffectOptions
): Subscription;
export function rxEffect<T>(
  o$: Observable<T>,
  sideEffectFn: (arg: T) => void,
  options: ReactiveEffectOptions,
  teardown: TeardownFn
): Subscription;

export function rxEffect<T>(
  obsOrSub$: Observable<T> | Subscription,
  sideEffectFnOrOptionsOrTeardown?: ((arg?: T) => void) | ReactiveEffectOptions | TeardownFn,
  optionsOrTeardown?: ReactiveEffectOptions | TeardownFn,
  teardown?: TeardownFn
): Subscription {
  let derivedInjector: Injector | undefined;
  if (typeof sideEffectFnOrOptionsOrTeardown !== 'function') {
    derivedInjector = sideEffectFnOrOptionsOrTeardown?.injector;
  } else {
    derivedInjector = (optionsOrTeardown as ReactiveEffectOptions)?.injector ?? inject(Injector);
  }
  return runInInjectionContext(derivedInjector!, () => {
    const destroyRef = inject(DestroyRef);
    const errorHandler = inject(ErrorHandler, { optional: true });
    const sub = new Subscription();

    /**
     * Clean up subscription
     */
    destroyRef.onDestroy(() => {
      if (
        obsOrSub$ instanceof Subscription &&
        sideEffectFnOrOptionsOrTeardown &&
        typeof sideEffectFnOrOptionsOrTeardown === 'function'
      ) {
        sideEffectFnOrOptionsOrTeardown();
      }
      if (teardown) {
        teardown();
      }
      if (optionsOrTeardown && typeof optionsOrTeardown === 'function') {
        optionsOrTeardown();
      }
      sub.unsubscribe();
    });

    if (obsOrSub$ instanceof Subscription) {
      sub.add(obsOrSub$);
      return sub;
    }

    sub.add(
      obsOrSub$
        .pipe(
          // execute operation/ side effect
          typeof sideEffectFnOrOptionsOrTeardown === 'function' ? tap(sideEffectFnOrOptionsOrTeardown) : pipe(),
          catchError((err) => {
            errorHandler?.handleError(err);
            return EMPTY;
          })
        )
        .subscribe()
    );

    return sub;
  });
}
