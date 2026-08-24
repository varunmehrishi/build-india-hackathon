import type { WorkflowStepConfig } from '../../domain/types'
import { Badge } from './Badge'

interface StepperProps {
  steps: readonly WorkflowStepConfig[]
  activeStepId: WorkflowStepConfig['id']
  onSelectStep: (stepId: WorkflowStepConfig['id']) => void
}

export function Stepper({ steps, activeStepId, onSelectStep }: StepperProps) {
  const activeIndex = steps.findIndex((step) => step.id === activeStepId)

  return (
    <nav className="stepper" aria-label="Workflow progress">
      {steps.map((step, index) => {
        const state =
          index < activeIndex ? 'done' : index === activeIndex ? 'current' : 'todo'

        return (
          <button
            key={step.id}
            type="button"
            className={['stepper-item', `is-${state}`].join(' ')}
            aria-current={state === 'current' ? 'step' : undefined}
            onClick={() => onSelectStep(step.id)}
          >
            <span className="stepper-index">{index + 1}</span>
            <span className="stepper-copy">
              <span className="stepper-kicker">{step.kicker}</span>
              <span className="stepper-title">{step.title}</span>
            </span>
            <Badge tone={state === 'done' ? 'success' : state === 'current' ? 'accent' : 'neutral'}>
              {state === 'done' ? 'Done' : state === 'current' ? 'Now' : 'Next'}
            </Badge>
          </button>
        )
      })}
    </nav>
  )
}
