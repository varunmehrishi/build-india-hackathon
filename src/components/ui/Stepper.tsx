import type { WorkflowStepConfig } from '../../domain/types'
import { Badge } from './Badge'

interface StepperProps {
  steps: readonly WorkflowStepConfig[]
  activeStepId: WorkflowStepConfig['id']
  onSelectStep: (stepId: WorkflowStepConfig['id']) => void
  maxSelectableIndex?: number
}

export function Stepper({ steps, activeStepId, onSelectStep, maxSelectableIndex }: StepperProps) {
  const activeIndex = steps.findIndex((step) => step.id === activeStepId)

  return (
    <nav className="stepper" aria-label="Workflow progress">
      {steps.map((step, index) => {
        const state =
          index < activeIndex ? 'done' : index === activeIndex ? 'current' : 'todo'
        const isLocked = maxSelectableIndex !== undefined && index > maxSelectableIndex

        return (
          <button
            key={step.id}
            type="button"
            className={['stepper-item', `is-${state}`].join(' ')}
            aria-current={state === 'current' ? 'step' : undefined}
            aria-label={`${index + 1}. ${step.title}${state === 'current' ? ', current step' : ''}${isLocked ? ', locked' : ''}`}
            disabled={isLocked}
            onClick={() => onSelectStep(step.id)}
          >
            <span className="stepper-index">{index + 1}</span>
            <span className="stepper-copy">
              <span className="stepper-kicker">{step.kicker}</span>
              <span className="stepper-title">{step.title}</span>
            </span>
            <Badge tone={state === 'done' ? 'success' : state === 'current' ? 'accent' : 'neutral'}>
              {isLocked ? 'Locked' : state === 'done' ? 'Done' : state === 'current' ? 'Now' : 'Next'}
            </Badge>
          </button>
        )
      })}
    </nav>
  )
}
