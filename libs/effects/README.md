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

```ts
const intervalEffect = rxEffect(interval(1000), (v) => console.log(v))
```

*Note* that you need to use `rxEffect` within an injection context. If you want to
use it outside an injection context you can pass the `Ìnjector` as argument.

### `rxEffect`

`rxEffect` is a convenience function which acts as a container to take care of
multiple subscriptions and execute sideffects.

*Note* that you need to use `rxEffect` within an injection context. If you want to
use it outside an injection context you can pass the `Ìnjector` as argument.

```ts
const effects = rxEffect(({register}) => {
  register(interval(1000), v => console.log(v))
  // register more effects

})
```
