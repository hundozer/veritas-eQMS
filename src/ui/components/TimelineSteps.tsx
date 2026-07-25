import type { TimelineStep } from '../types';

interface TimelineStepsProps {
  steps: TimelineStep[];
  current: number;
}

export function TimelineSteps({ steps, current }: TimelineStepsProps) {
  return (
    <div className="batch-timeline">
      {steps.map((step, i) => {
        const isDone = i < current;
        const isCurrent = i === current;

        return (
          <div
            key={step.label}
            className={`timeline-step${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}`}
          >
            <div className={`timeline-dot${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}`} />
            {i < steps.length - 1 && (
              <div className={`timeline-line${isDone ? ' done' : ''}`} />
            )}
            <div className="timeline-label">{step.label}</div>
          </div>
        );
      })}
    </div>
  );
}
