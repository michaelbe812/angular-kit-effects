# angular-kit/effects

Tooling to handle your effects (subscriptions)!

## Installation

  ```bash
  npm install @angular-kit/effects
  ```


## Included

- `rxEffect`

### `rxEffect`

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
const effects = rxEffect(({register}) => {
  register(interval(1000), v => console.log(v))
  // register more effects

})

```
*Note* that you need to use `rxEffect` within an injection context. If you want to
use it outside an injection context you can pass the `Ìnjector` as argument.

#### Run Code when an effect is cleaned up

Todo add docs


