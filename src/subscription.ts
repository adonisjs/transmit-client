/*
 * @adonisjs/transmit-client
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { SubscriptionStatus } from './subscription_status.js'
import { HttpClient } from './http_client.js'
import { Hook } from './hook.js'
import { TransmitStatus } from './transmit_status.js'

interface SubscriptionOptions {
  channel: string
  httpClient: HttpClient
  getEventSourceStatus: () => TransmitStatus
  hooks?: Hook
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
   * Channel name.
   */
  #channel: string

  /**
   * Event source status getter.
   */
  #getEventSourceStatus: () => TransmitStatus

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
    this.#getEventSourceStatus = options.getEventSourceStatus
  }

  /**
   * Run all registered handlers for the subscription.
   */
  $runHandler(message: unknown) {
    for (const handler of this.#handlers) {
      handler(message)
    }
  }

  async create() {
    if (this.isCreated) {
      return
    }

    if (this.#getEventSourceStatus() !== TransmitStatus.Connected) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(this.create())
        }, 100)
      })
    }

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
