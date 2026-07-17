# Changelog

This file was generated using [@jscutlery/semver](https://github.com/jscutlery/semver).

# [1.4.0](https://github.com/michaelbe812/angular-kit-effects/compare/rx-effects-1.3.0...rx-effects-1.4.0) (2026-07-17)


### Bug Fixes

* effects setup fn ([3c4f3f4](https://github.com/michaelbe812/angular-kit-effects/commit/3c4f3f43cee1f7ef38c63bbae30501d046e81f48))
* **effects:** log source errors instead of crashing host ([1afa859](https://github.com/michaelbe812/angular-kit-effects/commit/1afa85924a353c9530a816860127ac2fa27f3c93))
* **effects:** rethrow source errors when no ErrorHandler available ([d83e1f5](https://github.com/michaelbe812/angular-kit-effects/commit/d83e1f504ef004e7edfe50ec4a9bc3f685cc034a))


### Features

* **effects:** rework rxEffect lifecycle, exports, packaging ([87b6683](https://github.com/michaelbe812/angular-kit-effects/commit/87b66831093fd783f242c12781205d1f8f9e078c))



## 1.3.0 (2024-07-10)

* refactor(effects): rename runOnCleanUp to runOnInstanceDestroy ([8258f4f](https://github.com/michaelbe812/angular-kit-effects/commit/8258f4f))
* refactor(effects): remove teardown callback on factory function, covered by runOnInstanceDestroy ([4b750f8](https://github.com/michaelbe812/angular-kit-effects/commit/4b750f8))
* docs(effects): improve docs ([5cfcfbf](https://github.com/michaelbe812/angular-kit-effects/commit/5cfcfbf))

## 1.2.0 (2024-03-28)

* feat(rx-effects): introduce standalone effect functions ([c100a7f](https://github.com/michaelbe812/angular-kit-effects/commit/c100a7f))
* chore(effects): setup semver ([97a3b14](https://github.com/michaelbe812/angular-kit-effects/commit/97a3b14))
* docs(effects): update docs ([62db2a5](https://github.com/michaelbe812/angular-kit-effects/commit/62db2a5))

## 1.1.0 (2024-05-21)




## 1.0.0 (2024-05-21)

* feat(effects): add effects factory function to manage subs ([7254e4f](https://github.com/michaelbe812/angular-kit-effects/commit/7254e4f))
* feat(effects): enhance options to pass a DestroyRef ([bcd1702](https://github.com/michaelbe812/angular-kit-effects/commit/bcd1702))
* feat(effects): provide a clean up function for a single effect ([45c9ba3](https://github.com/michaelbe812/angular-kit-effects/commit/45c9ba3))
