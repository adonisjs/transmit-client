interface TransmitOptions {
  baseUrl: string
  eventSourceConstructor?: typeof EventSource
  beforeSubscribe?: (request: RequestInit) => void
  beforeUnsubscribe?: (request: RequestInit) => void
  maxReconnectAttempts?: number
  onReconnectAttempt?: (attempt: number) => void
  onReconnectFailed?: () => void
  onSubscribeFailed?: (response: Response) => void
  onSubscription?: (channel: string) => void
  onUnsubscription?: (channel: string) => void
  removeSubscriptionOnZeroListener?: boolean
}

export const TransmitStatus = {
  Initializing: 'initializing',
  Connecting: 'connecting',
  Connected: 'connected',
  Disconnected: 'disconnected',
  Reconnecting: 'reconnecting',
} as const

type TTransmitStatus = (typeof TransmitStatus)[keyof typeof TransmitStatus]

export class Transmit extends EventTarget {
  /**
   * Unique identifier for this client.
   */
  #uid: string = crypto.randomUUID()

  /**
   * Options for this client.
   */
  #options: TransmitOptions

  /**
   * Registered listeners.
   */
  #listeners: Map<string, Set<(message: any) => void>> = new Map()

  /**
   * Current status of the client.
   */
  #status: TTransmitStatus = TransmitStatus.Initializing

  /**
   * EventSource instance.
   */
  #eventSource!: EventSource

  /**
   * Number of reconnect attempts.
   */
  #reconnectAttempts: number = 0

  /**
   * Locks for channel subscriptions.
   */
  #channelSubscriptionLock: Set<string> = new Set()

  get uid() {
    return this.#uid
  }

  get listOfSubscriptions() {
    return Array.from(this.#listeners.keys())
  }

  constructor(options: TransmitOptions) {
    super()

    if (typeof options.eventSourceConstructor === 'undefined') {
      options.eventSourceConstructor = EventSource
    }

    if (typeof options.maxReconnectAttempts === 'undefined') {
      options.maxReconnectAttempts = 5
    }

    if (typeof options.removeSubscriptionOnZeroListener === 'undefined') {
      options.removeSubscriptionOnZeroListener = false
    }

    this.#options = options
    this.#connect()
  }

  #changeStatus(status: TTransmitStatus) {
    this.#status = status
    this.dispatchEvent(new CustomEvent(status))
  }

  #connect() {
    this.#changeStatus(TransmitStatus.Connecting)

    const url = new URL(`${this.#options.baseUrl}/__transmit/events`)
    url.searchParams.append('uid', this.#uid)

    this.#eventSource = new this.#options.eventSourceConstructor(url.toString(), {
      withCredentials: true,
    })
    this.#eventSource.addEventListener('message', this.#onMessage.bind(this))
    this.#eventSource.addEventListener('error', this.#onError.bind(this))
    this.#eventSource.addEventListener('open', () => {
      this.#changeStatus(TransmitStatus.Connected)
      this.#reconnectAttempts = 0

      for (const channel of this.#listeners.keys()) {
        void this.#subscribe(channel)
      }
    })
  }

  #onMessage(event: MessageEvent) {
    const data = JSON.parse(event.data)
    const listeners = this.#listeners.get(data.channel)

    if (typeof listeners === 'undefined') {
      return
    }

    for (const listener of listeners) {
      try {
        listener(data.payload)
      } catch (error) {
        // TODO: Rescue
        console.log(error)
      }
    }
  }

  #retrieveXsrfToken() {
    const match = document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'))

    return match ? decodeURIComponent(match[3]) : null
  }

  #onError() {
    if (this.#status !== TransmitStatus.Reconnecting) {
      this.#changeStatus(TransmitStatus.Disconnected)
    }

    this.#changeStatus(TransmitStatus.Reconnecting)

    if (this.#options.onReconnectAttempt) {
      this.#options.onReconnectAttempt(this.#reconnectAttempts + 1)
    }

    if (
      this.#options.maxReconnectAttempts &&
      this.#reconnectAttempts >= this.#options.maxReconnectAttempts
    ) {
      this.#eventSource.close()

      if (this.#options.onReconnectFailed) {
        this.#options.onReconnectFailed()
      }

      return
    }

    this.#reconnectAttempts++
  }

  async #subscribe(channel: string, callback?: any) {
    if (this.#status !== TransmitStatus.Connected) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(this.#subscribe(channel, callback))
        }, 100)
      })
    }

    const listeners = this.#listeners.get(channel)

    if (typeof listeners !== 'undefined' && typeof callback !== 'undefined') {
      this.#options.onSubscription?.(channel)
      listeners.add(callback)
      return
    }

    if (this.#channelSubscriptionLock.has(channel)) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(this.#subscribe(channel, callback))
        }, 100)
      })
    }

    this.#channelSubscriptionLock.add(channel)

    const request = new Request(`${this.#options.baseUrl}/__transmit/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': this.#retrieveXsrfToken() ?? '',
      },
      body: JSON.stringify({ uid: this.#uid, channel }),
      credentials: 'include',
    })

    this.#options.beforeSubscribe?.(request)

    try {
      const response = await fetch(request)

      if (!response.ok) {
        this.#options.onSubscribeFailed?.(response)
        this.#channelSubscriptionLock.delete(channel)
        return
      }

      if (typeof callback !== 'undefined') {
        const listeners = this.#listeners.get(channel)

        if (typeof listeners === 'undefined') {
          this.#listeners.set(channel, new Set([callback]))
        } else {
          listeners.add(callback)
        }

        this.#options.onSubscription?.(channel)
      }
    } finally {
      this.#channelSubscriptionLock.delete(channel)
    }
  }

  async #unsubscribe(channel: string) {
    const request = new Request(`${this.#options.baseUrl}/__transmit/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': this.#retrieveXsrfToken() ?? '',
      },
      body: JSON.stringify({ uid: this.#uid, channel }),
      credentials: 'include',
    })

    this.#options.beforeUnsubscribe?.(request)

    const response = await fetch(request)

    if (!response.ok) {
      return
    }
  }

  on(event: Exclude<TTransmitStatus, 'connecting'>, callback: (event: CustomEvent) => void) {
    this.addEventListener(event, callback)
  }

  listenOn<T = unknown>(channel: string, callback: (message: T) => void) {
    void this.#subscribe(channel, callback)

    return (unsubscribeOnTheServer?: boolean) => {
      const listeners = this.#listeners.get(channel)

      if (typeof listeners === 'undefined') {
        return
      }

      listeners.delete(callback)
      this.#options.onUnsubscription?.(channel)

      if (
        (unsubscribeOnTheServer ?? this.#options.removeSubscriptionOnZeroListener) &&
        listeners.size === 0
      ) {
        void this.#unsubscribe(channel)
      }
    }
  }

  listenOnce<T = unknown>(channel: string, callback: (message: T) => void) {
    const unsubscribe = this.listenOn<T>(channel, (message) => {
      callback(message)
      unsubscribe()
    })
  }

  close() {
    this.#eventSource.close()
  }
}
