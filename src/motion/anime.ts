import { createScope, type Scope } from 'animejs';
import type { RefObject } from 'react';

export const MOTION = {
  fast: 130,
  interface: 190,
  reveal: 280,
  hero: 620,
  stagger: 38,
} as const;

export function createMotionScope(root: RefObject<HTMLElement | null>) {
  return createScope({
    root,
    defaults: { ease: 'out(3)' },
    mediaQueries: {
      reduceMotion: '(prefers-reduced-motion: reduce)',
      smallScreen: '(max-width: 767px)',
      coarsePointer: '(pointer: coarse)',
    },
  });
}

export function motionDuration(scope: Scope, duration: number) {
  return scope.matches.reduceMotion ? 0 : duration;
}

export function motionDistance(scope: Scope, distance: number) {
  return scope.matches.reduceMotion ? 0 : distance;
}
