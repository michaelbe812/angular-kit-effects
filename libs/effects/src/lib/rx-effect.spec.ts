import { Component, inject, OnDestroy } from '@angular/core';
import { of, Subject } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { rxEffect } from './rx-effect';

describe('standalone rxEffect', () => {
  it('should execute all effects', async () => {
    const { service, component } = await setup();

    component.trigger$$.next(10);
    component.trigger$$.next(20);

    expect(service.sourceEffect).toHaveBeenCalledWith(10);
    expect(service.triggerEffect).toBeCalledTimes(2);
    expect(service.triggerEffect).toHaveBeenNthCalledWith(1, 10);
    expect(service.triggerEffect).toHaveBeenNthCalledWith(2, 20);
  });
  it('should unsubscribe from sources onDestroy', async () => {
    const { service, component, fixture } = await setup();
    jest.spyOn(service, 'triggerEffect');
    fixture.destroy();
    component.trigger$$.next(10);

    expect(service.triggerEffect).not.toHaveBeenCalled();
  });
  it('should execute teardown function onDestroy', async () => {
    const { component, fixture } = await setup();
    jest.spyOn(component.clearInterval$$, 'next');
    fixture.destroy();

    expect(component.clearInterval$$.next).toHaveBeenCalled();
  });
  /*  describe('terminate', () => {
    it('should execute teardown function when terminate is called', async () => {
      const { component } = await setup();
      jest.spyOn(component.clearInterval$$, 'next');
      component.effects.terminate();

      expect(component.clearInterval$$.next).toHaveBeenCalled();
    });
    it('should unsubscribe from all sources when terminate is called', async () => {
      const {service, component} = await setup();

      component.effects.terminate()
      component.trigger$$.next(10);

      expect(service.triggerEffect).not.toHaveBeenCalled();

    });
  })*/
  describe('TeardownFunction given', () => {
    it('should execute teardown function when injection context is cleaned up', async () => {
      const { service, component, fixture } = await setup();
      jest.spyOn(component.clearInterval$$, 'next');
      fixture.destroy();

      expect(component.clearInterval$$.next).toHaveBeenCalled();
      expect(service.teardownEffect).toHaveBeenCalled();
    });
  });

  describe('unregister', () => {
    it('should unsubscribe trigger$$ when unsubscribeTrigger$$ emits', async () => {
      const { component, service } = await setup();

      component.trigger$$.next(10);
      component.unsubscribeTrigger$$.next(void 0);
      component.trigger$$.next(20);

      expect(service.triggerEffect).toBeCalledTimes(1);
      expect(service.triggerEffect).toHaveBeenCalledWith(10);
    });
  });
});

async function setup() {
  const serviceMock = {
    sourceEffect: jest.fn(),
    triggerEffect: jest.fn(),
    teardownEffect: jest.fn(),
  };
  await TestBed.configureTestingModule({
    providers: [{ provide: Service, useValue: serviceMock }],
    declarations: [TestComponent],
  }).compileComponents();

  jest.restoreAllMocks();
  jest.clearAllMocks();

  const fixture = TestBed.createComponent(TestComponent);
  const component = fixture.componentInstance;
  const service = TestBed.inject(Service);

  return {
    component,
    fixture,
    service,
  };
}

class Service {
  sourceEffect(v: number) {
    return v;
  }

  triggerEffect(v: number) {
    console.log('triggerEffect');
    return v;
  }

  teardownEffect() {
    //
  }
}

@Component({
  template: '',
})
class TestComponent implements OnDestroy {
  service = inject(Service);
  trigger$$ = new Subject<number>();
  unsubscribeTrigger$$ = new Subject();

  destroy$$ = new Subject();
  source$ = of(10);
  clearInterval$$ = new Subject();

  sourceEffect = rxEffect(
    this.source$,
    (v) => this.service.sourceEffect(v),
    () => this.service.teardownEffect()
  );
  triggerEffectId = rxEffect(this.trigger$$, (v: number) => this.service.triggerEffect(v));
  unsubTriggerEffect = rxEffect(this.unsubscribeTrigger$$, () => this.triggerEffectId.unsubscribe());

  /*  effects = reactiveEffects(({ register, registerOnTeardown, unregister }) => {

    registerOnTeardown(() => this.service.teardownEffect());

    return () => this.clearInterval$$.next(void 0);
  });*/

  ngOnDestroy() {
    this.destroy$$.next(void 0);
    this.clearInterval$$.next(void 0);
  }
}
