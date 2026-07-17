import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { interval } from 'rxjs';
import { EffectCleanUpRef, rxEffect } from '@angular-kit/effects';

@Component({
  standalone: true,
  imports: [RouterModule],
  selector: 'angular-kit-effects-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'demo';
  counter = 0;

  // ref to stop the interval effect on demand
  private counterEffectRef!: EffectCleanUpRef;

  // must be created in an injection context -> field initializer
  private readonly effects = rxEffect(({ run, runOnInstanceDestroy }) => {
    this.counterEffectRef = run(interval(1000), () => this.counter++);

    runOnInstanceDestroy(() => console.log('destroyed'));
  });

  stopCounter(): void {
    this.counterEffectRef.cleanUp();
  }
}
