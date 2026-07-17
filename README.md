# @angular-kit/effects

See [README.md](./libs/effects/README.md) for more information.

## Quick start

```bash
npm install @angular-kit/effects
```

```ts
import { rxEffect } from '@angular-kit/effects';
import { interval } from 'rxjs';

const effects = rxEffect(({run}) => {
  run(interval(1000), v => console.log(v))
  // run more effects

})
```
