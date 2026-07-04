import { useEffect, useRef, type ReactNode } from 'react';
import { animate, stagger, utils } from 'animejs';
import { createMotionScope, MOTION, motionDistance, motionDuration } from '@/motion/anime';

export function RouteMotion({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = createMotionScope(root).add((self) => {
      if (!self) return;
      const sections = utils.$('[data-motion-page] > *').slice(0, 8);
      if (!sections.length) return;
      animate(sections, {
        y: { from: motionDistance(self, 8) },
        duration: motionDuration(self, MOTION.reveal),
        delay: self.matches.reduceMotion ? 0 : stagger(MOTION.stagger),
      });
    });
    return () => scope.revert();
  }, [routeKey]);

  return <div ref={root} className="min-h-full">{children}</div>;
}
