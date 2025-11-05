export interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: string
}

export interface Scenario {
  id: string
  title: string
  description: string
  userRequest: string
  aiResponse: string
  code: string
  setupInstructions: string
  timeSaved: number
  costSaved: number
  errorReduction: number
  details?: {
    timeSavedDetail: string
    costSavedDetail: string
    errorReductionDetail: string
  }
}
