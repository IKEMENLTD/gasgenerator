// LINE API関連の型定義

// LINE Webhook Event（必要最小限）
export interface LineWebhookEvent {
  type: 'message' | 'follow' | 'unfollow' | 'postback'
  replyToken?: string
  source: {
    userId: string
    type: 'user'
  }
  timestamp: number
  message?: {
    type: 'text'
    text: string
  }
  postback?: {
    data: string
  }
}

// LINE Webhook Body
export interface LineWebhookBody {
  destination: string
  events: LineWebhookEvent[]
}

// LINE Message Types（簡略化）
export interface TextMessage {
  type: 'text'
  text: string
  quickReply?: QuickReply
}

export interface FlexMessage {
  type: 'flex'
  altText: string
  contents: FlexBubble | FlexCarousel
}

export interface FlexBubble {
  type: 'bubble'
  header?: FlexBox
  body?: FlexBox
  footer?: FlexBox
}

export interface FlexCarousel {
  type: 'carousel'
  contents: FlexBubble[]
}

export interface FlexBox {
  type: 'box'
  layout: 'vertical' | 'horizontal'
  contents: FlexComponent[]
  spacing?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
}

export type FlexComponent = FlexText | FlexButton | FlexSeparator

export interface FlexText {
  type: 'text'
  text: string
  weight?: 'regular' | 'bold'
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '3xl' | '4xl' | '5xl'
  color?: string
  wrap?: boolean
  margin?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
}

export interface FlexButton {
  type: 'button'
  action: MessageAction | PostbackAction
  style?: 'primary' | 'secondary' | 'link'
}

export interface FlexSeparator {
  type: 'separator'
  margin?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
}

// Actions
export interface MessageAction {
  type: 'message'
  label: string
  text: string
}

export interface PostbackAction {
  type: 'postback'
  label: string
  data: string
  text?: string
}

// Quick Reply
export interface QuickReply {
  items: QuickReplyButton[]
}

export interface QuickReplyButton {
  type: 'action'
  action: MessageAction | PostbackAction
}

// LINE API Client関連
export interface LineApiConfig {
  channelAccessToken: string
  channelSecret: string
}

export interface LinePushMessage {
  to: string
  messages: (TextMessage | FlexMessage)[]
}

export type LineMessage = TextMessage | FlexMessage