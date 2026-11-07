/*
 * @adonisjs/transmit-client
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { SubscriptionStatus } from './subscription_status.js'
import type { Hook } from './hook.js'
import type { HttpClient } from './http_client.js'

interface SubscriptionOptions {
  channel: string
  httpClient: HttpClient
  hooks?: Hook

  /**
   * Called by create() to ask the owner to subscribe. The owner decides
   * when to call $subscribe() and settles the promise when it gives up.
   */
  onCreate: () => Promise<void>
  onDelete?: () => void
}

export class Subscription {
  /**
   * HTTP client instance.
   */
  #httpClient: HttpClient

  /**
   * Hook instance.
   */
  #hooks: Hook | undefined

  /**
   * Callback to call when create() is requested.
   */
  readonly #onCreate: () => Promise<void>

  /**
   * Callback to call when the subscription is deleted.
   */
  readonly #onDelete: (() => void) | undefined

  /**
   * Channel name.
   */
  #channel: string

  /**
   * Registered message handlers.
   */
  #handlers = new Set<(message: any) => void>()

  /**
   * Current status of the subscription.
   */
  #status: SubscriptionStatus = SubscriptionStatus.Pending

  /**
   * Returns if the subscription is created or not.
   */
  get isCreated() {
    return this.#status === SubscriptionStatus.Created
  }

  /**
   * Returns if the subscription is deleted or not.
   */
  get isDeleted() {
    return this.#status === SubscriptionStatus.Deleted
  }

  /**
   * Returns the number of registered handlers.
   */
  get handlerCount() {
    return this.#handlers.size
  }

  constructor(options: SubscriptionOptions) {
    this.#channel = options.channel
    this.#httpClient = options.httpClient
    this.#hooks = options.hooks
    this.#onCreate = options.onCreate
    this.#onDelete = options.onDelete
  }

  /**
   * Run all registered handlers for the subscription.
   */
  $runHandler(message: unknown) {
    for (const handler of this.#handlers) {
      try {
        handler(message)
      } catch (error) {
        // TODO: Rescue
        console.error(error)
      }
    }
  }

  /**
   * Subscribes to the channel. A deleted subscription stays deleted:
   * get a new one from `transmit.subscription()` instead.
   */
  async create() {
    if (this.#status !== SubscriptionStatus.Pending) {
      return
    }

    return this.#onCreate()
  }

  /**
   * Sends the subscribe request. Transmit calls it once the connection
   * is open, and again for created subscriptions after a reconnect.
   */
  async $subscribe() {
    const request = this.#httpClient.createRequest('/__transmit/subscribe', {
      channel: this.#channel,
    })

    this.#hooks?.beforeSubscribe(request)

    try {
      const response = await this.#httpClient.send(request)

      //? Dump the response text
      void response.text()

      if (!response.ok) {
        this.#hooks?.onSubscribeFailed(response)
        return
      }

      //? A response that arrives after delete() must not revive the subscription
      if (this.isDeleted) {
        return
      }

      this.#status = SubscriptionStatus.Created
      this.#hooks?.onSubscription(this.#channel)
    } catch (error) {}
  }

  async delete() {
    if (this.isDeleted || !this.isCreated) {
      return
    }

    const request = this.#httpClient.createRequest('/__transmit/unsubscribe', {
      channel: this.#channel,
    })

    this.#hooks?.beforeUnsubscribe(request)

    try {
      const response = await this.#httpClient.send(request)

      //? Dump the response text
      void response.text()

      if (!response.ok) {
        return
      }

      this.#status = SubscriptionStatus.Deleted
      this.#hooks?.onUnsubscription(this.#channel)
      this.#onDelete?.()
    } catch (error) {}
  }

  onMessage<T>(handler: (message: T) => void) {
    this.#handlers.add(handler)

    return () => {
      this.#handlers.delete(handler)
    }
  }

  onMessageOnce<T>(handler: (message: T) => void) {
    const deleteHandler = this.onMessage<T>((message) => {
      handler(message)
      deleteHandler()
    })
  }
}
