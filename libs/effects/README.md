# angular-kit/effects

Tooling to handle your effects (subscriptions)!

## Installation

  ```bash
  npm install @angular-kit/effects
  ```


## `rxEffect`

`rxEffect` is a standalone convenience function to take care of a subscription and
execute side effects.

You can run a single effect
```ts
const intervalEffect = rxEffect().run(interval(1000), console.log)

// or
const effects = rxEffect();

logEffect = this.effects.run(...)
```

Or create a group of effects:

```ts
const effects = rxEffect(({run}) => {
  run(interval(1000), v => console.log(v))
  // run more effects

})

```
*Note* that you need to use `rxEffect` within an injection context. If you want to
use it outside an injection context you can pass the `Ìnjector` as argument.

### Run Code on Clean up

#### `runOnInstanceDestroy`-  Run code when the `rxEffect` instance is destroyed

When a `rxEffect`-instance is destroyed you can execute code which is registered in the `runOnInstanceDestroy`-hook.

`runOnInstanceDestroy` is executed whenever the repsective `DestroyRef.onDestroy`-callback is executed.

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
effect or the `DestroyRef.onDestroy()`-callback iun the current scope executed. Whatever comes first will be executed.

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

## Demo

See this [stackblitz](https://stackblitz.com/edit/stackblitz-starters-baeufy?file=src%2Fapp%2Fchild%2Fchild.component.ts)
