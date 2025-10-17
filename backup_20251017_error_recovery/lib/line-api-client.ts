interface RetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  timeout: number
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  timeout: 5000
}

class LineApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message)
    this.name = 'LineApiError'
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

async function exponentialBackoff(
  attempt: number,
  config: RetryConfig
): Promise<void> {
  const delay = Math.min(
    config.initialDelay * Math.pow(2, attempt),
    config.maxDelay
  )
  await new Promise(resolve => setTimeout(resolve, delay))
}

export class LineApiClient {
  private accessToken: string
  private config: RetryConfig

  constructor(
    accessToken: string = process.env.LINE_CHANNEL_ACCESS_TOKEN!,
    config: Partial<RetryConfig> = {}
  ) {
    this.accessToken = accessToken
    this.config = { ...defaultRetryConfig, ...config }
  }

  async getUserProfile(userId: string): Promise<any> {
    return this.requestWithRetry(
      'GET',
      `https://api.line.me/v2/bot/profile/${userId}`
    )
  }

  async pushMessage(userId: string, messages: any[]): Promise<void> {
    await this.requestWithRetry(
      'POST',
      'https://api.line.me/v2/bot/message/push',
      {
        to: userId,
        messages
      }
    )
  }

  async replyMessage(replyToken: string, messages: any[]): Promise<void> {
    await this.requestWithRetry(
      'POST',
      'https://api.line.me/v2/bot/message/reply',
      {
        replyToken,
        messages
      }
    )
  }

  private async requestWithRetry(
    method: string,
    url: string,
    body?: any
  ): Promise<any> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetchWithTimeout(
          url,
          {
            method,
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
          },
          this.config.timeout
        )

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const delay = retryAfter
            ? parseInt(retryAfter) * 1000
            : this.config.maxDelay

          console.warn(`LINE API rate limit hit, waiting ${delay}ms`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        // Handle server errors with retry
        if (response.status >= 500 && attempt < this.config.maxRetries) {
          console.warn(`LINE API server error (${response.status}), retrying...`)
          await exponentialBackoff(attempt, this.config)
          continue
        }

        // Handle client errors (no retry)
        if (!response.ok && response.status < 500) {
          const error = await response.json().catch(() => ({}))
          throw new LineApiError(
            `LINE API error: ${response.statusText}`,
            response.status,
            error
          )
        }

        // Success
        if (response.headers.get('content-type')?.includes('application/json')) {
          return await response.json()
        }
        return null

      } catch (error: any) {
        lastError = error

        // Don't retry on client errors or abort
        if (
          error.name === 'AbortError' ||
          error instanceof LineApiError && error.statusCode && error.statusCode < 500
        ) {
          throw error
        }

        // Log and retry on network errors
        console.error(`LINE API request failed (attempt ${attempt + 1}):`, error.message)

        if (attempt < this.config.maxRetries) {
          await exponentialBackoff(attempt, this.config)
        }
      }
    }

    throw lastError || new Error('LINE API request failed after all retries')
  }
}

// Singleton instance
export const lineApiClient = new LineApiClient()

// Helper functions for common operations
export async function sendLineMessage(
  userId: string,
  text: string,
  options?: { quickReply?: any }
): Promise<boolean> {
  try {
    const message: any = {
      type: 'text',
      text
    }

    if (options?.quickReply) {
      message.quickReply = options.quickReply
    }

    await lineApiClient.pushMessage(userId, [message])
    return true
  } catch (error) {
    console.error('Failed to send LINE message:', error)
    return false
  }
}

export async function getLineUserProfile(userId: string): Promise<any> {
  try {
    return await lineApiClient.getUserProfile(userId)
  } catch (error) {
    console.error('Failed to get LINE user profile:', error)
    return null
  }
}