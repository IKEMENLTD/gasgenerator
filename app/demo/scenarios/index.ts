import { salesAggregation } from './salesAggregation'
import { inventoryAlert } from './inventoryAlert'
import { weeklyReport } from './weeklyReport'

export const scenarios = {
  salesAggregation,
  inventoryAlert,
  weeklyReport
}

export type ScenarioId = keyof typeof scenarios
