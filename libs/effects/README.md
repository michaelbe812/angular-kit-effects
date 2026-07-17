# @angular-kit/effects

Tooling to handle your effects (subscriptions)!

## Installation

  ```bash
  npm install @angular-kit/effects
  ```

## Compatibility

- Angular `>=16 <23`
- rxjs `^7.4.0`


## `rxEffect`

`rxEffect` is a standalone convenience function to take care of a subscription and
execute side effects.

You can run a single effect
```ts
const intervalEffect = rxEffect().run(interval(1000), console.log)

// or
const effects = rxEffect();

const logEffect = effects.run(...)
```

`run` accepts three forms:

```ts
run(source$, sideEffectFn, options?)        // subscribe + execute side effect
run(source$.pipe(tap(sideEffectFn)))        // observable with side effect inside
run(source$.subscribe(sideEffectFn))        // existing subscription
```

Or create a group of effects:

```ts
const effects = rxEffect(({run}) => {
  run(interval(1000), v => console.log(v))
  // run more effects

})

```
*Note* that you need to use `rxEffect` within an injection context. If you want to
use it outside an injection context you can pass the `Injector` via `options.injector`,
or pass `options.destroyRef`. With `destroyRef` alone, errors are reported to `ErrorHandler`
only if `injector` is also provided.

### Run Code on Clean up

#### `runOnInstanceDestroy`-  Run code when the `rxEffect` instance is destroyed

When a `rxEffect`-instance is destroyed you can execute code which is registered in the `runOnInstanceDestroy`-hook.

`runOnInstanceDestroy` is executed whenever the respective `DestroyRef.onDestroy`-callback is executed
or when `cleanUp()` is called manually on the instance — whatever comes first.

Example for standalone function
```ts
  const effects = rxEffect()

  effects.runOnInstanceDestroy(() => // do something e.g. interact with local storage)

```

Example for factory function
```ts
  const effects = rxEffect(({runOnInstanceDestroy}) => {
    runOnInstanceDestroy(() =>
      // do something e.g. interact with local storage
    )
})

```


#### Run Code when a single effect is cleaned up
When creating an effect: 

```ts
 const effects = rxEffect()
  const logEffect = effects.run(of(1), console.log)

```
You can optionally specify a callback which is executed **one time** if **either** cleanUp() is called on this single
effect or the instance is destroyed (`DestroyRef.onDestroy()` or manual instance `cleanUp()`). Whatever comes first will be executed.

You do this by:
```ts
 const effects = rxEffect()
  const logEffect = effects.run(of(1), console.log, {onCleanUp: () => {}})

```

### Manually destroy `rxEffect`

You can call `cleanUp()` on the `rxEffect` instance to destroy the instance.

### Manually clean up/ destroy a single effect
When creating an effect:

```ts
 const effects = rxEffect()
  const logEffect = effects.run(of(1), console.log)

```
You get a `EffectCleanUpRef` which exposes a `cleanUp`-function. You can call this function and 
destroy this single effect.

## Exported types

`EffectCleanUpRef`, `RunOptions`, `RxEffect`, `EffectsSetupFn` are exported alongside `rxEffect`.

## Error handling

Errors from a source observable are caught, forwarded to Angular's `ErrorHandler` (when available),
and the effect terminates — it does not resubscribe. Errors thrown by `onCleanUp` callbacks are also
routed to `ErrorHandler`. When no `ErrorHandler` is available (`destroyRef`-only usage without
`injector`) errors are rethrown as unhandled errors instead of being swallowed.

## Behavior after destroy

After the `rxEffect` instance is destroyed/cleaned up, `run()` is a no-op — a passed `Subscription`
is unsubscribed immediately — and `runOnInstanceDestroy()` executes its callback immediately.

## Demo

See `apps/demo` in the repo or this [stackblitz](https://stackblitz.com/edit/stackblitz-starters-baeufy?file=src%2Fapp%2Fchild%2Fchild.component.ts)
