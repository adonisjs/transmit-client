/*
 * @adonisjs/transmit-client
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { setTimeout } from 'node:timers/promises'
import { test } from '@japa/runner'
import { Transmit } from '../src/transmit.js'
import { FakeEventSource } from '../test_utils/fake_event_source.js'
import { Subscription } from '../src/subscription.js'
import { FakeHttpClient } from '../test_utils/fake_http_client.js'

test.group('Transmit', () => {
  test('should connect to the server', ({ assert }) => {
    let eventSource: FakeEventSource | null = null

    new Transmit({
      baseUrl: 'http://localhost',
      uidGenerator: () => '1',
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceFactory(url, options) {
        eventSource = new FakeEventSource(url, options.withCredentials)
        return eventSource
      },
    })

    assert.isDefined(eventSource)
    assert.equal(eventSource!.constructorOptions.url, 'http://localhost/__transmit/events?uid=1')
    assert.isTrue(eventSource!.constructorOptions.withCredentials)
  })

  test('should allow to create subscription', ({ assert }) => {
    const transmit = new Transmit({
      baseUrl: 'http://localhost',
      uidGenerator: () => '1',
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceFactory(url, options) {
        return new FakeEventSource(url, options.withCredentials)
      },
    })

    const subscription = transmit.subscription('channel')

    assert.instanceOf(subscription, Subscription)
  })

  test('should allow to customize the uid generator', ({ assert }) => {
    const transmit = new Transmit({
      baseUrl: 'http://localhost',
      uidGenerator: () => 'custom-uid',
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceFactory(url, options) {
        return new FakeEventSource(url, options.withCredentials)
      },
    })

    assert.equal(transmit.uid, 'custom-uid')
  })

  test('should compute uuid when uid generator is not defined', ({ assert }) => {
    const transmit = new Transmit({
      baseUrl: 'http://localhost',
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceFactory(url, options) {
        return new FakeEventSource(url, options.withCredentials)
      },
    })

    assert.isString(transmit.uid)
  })

  test('should dispatch messages to the subscriptions', async ({ assert }) => {
    assert.plan(1)

    let eventSource: FakeEventSource | null = null

    const transmit = new Transmit({
      baseUrl: 'http://localhost',
      uidGenerator: () => '1',
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceFactory(url, options) {
        eventSource = new FakeEventSource(url, options.withCredentials)
        return eventSource
      },
    })

    const subscription = transmit.subscription('channel')

    subscription.onMessage((payload) => {
      assert.equal(payload, 'hello')
    })

    // @ts-expect-error - Message is not 1:1 with MessageEvent
    eventSource!.emit('message', { data: JSON.stringify({ channel: 'channel', payload: 'hello' }) })
  })

  test('should not register subscription if they are not created on connection failure', async ({
    assert,
  }) => {
    let eventSource: FakeEventSource | null = null
    let httpClient: FakeHttpClient | null = null

    const transmit = new Transmit({
      baseUrl: 'http://localhost',
      uidGenerator: () => '1',
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceFactory(url, options) {
        eventSource = new FakeEventSource(url, options.withCredentials)
        return eventSource
      },
      httpClientFactory(baseUrl, uid) {
        httpClient = new FakeHttpClient({ baseUrl, uid })
        return httpClient
      },
    })

    transmit.subscription('channel1')
    transmit.subscription('channel2')

    // Simulate latency
    await setTimeout(100)

    assert.equal(httpClient!.sentRequests.length, 0)

    eventSource!.sendCloseEvent()
    eventSource!.sendOpenEvent()

    assert.equal(httpClient!.sentRequests.length, 0)
  })

  test('should re-connect only created subscription', async ({ assert }) => {
    let eventSource: FakeEventSource | null = null
    let httpClient: FakeHttpClient | null = null

    const transmit = new Transmit({
      baseUrl: 'http://localhost',
      uidGenerator: () => '1',
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceFactory(url, options) {
        eventSource = new FakeEventSource(url, options.withCredentials)
        return eventSource
      },
      httpClientFactory(baseUrl, uid) {
        httpClient = new FakeHttpClient({ baseUrl, uid })
        return httpClient
      },
    })

    const subscription = transmit.subscription('channel1')
    transmit.subscription('channel2')

    await subscription.create()

    // Simulate latency
    await setTimeout(100)

    assert.equal(httpClient!.sentRequests.length, 1)

    eventSource!.sendCloseEvent()
    eventSource!.sendOpenEvent()

    assert.equal(httpClient!.sentRequests.length, 2)
  })

  test('should settle pending subscription create when closed before connecting', async ({
    assert,
  }) => {
    let httpClient: FakeHttpClient | null = null

    const transmit = new Transmit({
      baseUrl: 'http://localhost',
      uidGenerator: () => '1',
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceFactory(url, options) {
        return new FakeEventSource(url, options.withCredentials)
      },
      httpClientFactory(baseUrl, uid) {
        httpClient = new FakeHttpClient({ baseUrl, uid })
        return httpClient
      },
    })

    const subscription = transmit.subscription('channel')
    const pending = subscription.create()

    transmit.close()

    const settled = await Promise.race([
      pending.then(() => true),
      setTimeout(500).then(() => false),
    ])

    assert.isTrue(settled)
    assert.isFalse(subscription.isCreated)
    assert.lengthOf(httpClient!.sentRequests, 0)
  })

  test('should settle pending subscription create when reconnect attempts are exhausted', async ({
    assert,
  }) => {
    let eventSource: FakeEventSource | null = null
    let httpClient: FakeHttpClient | null = null

    const transmit = new Transmit({
      baseUrl: 'http://localhost',
      uidGenerator: () => '1',
      maxReconnectAttempts: 1,
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceFactory(url, options) {
        eventSource = new FakeEventSource(url, options.withCredentials)
        return eventSource
      },
      httpClientFactory(baseUrl, uid) {
        httpClient = new FakeHttpClient({ baseUrl, uid })
        return httpClient
      },
    })

    const subscription = transmit.subscription('channel')
    const pending = subscription.create()

    eventSource!.emit('error', new MessageEvent('error'))
    eventSource!.emit('error', new MessageEvent('error'))

    const settled = await Promise.race([
      pending.then(() => true),
      setTimeout(500).then(() => false),
    ])

    assert.isTrue(settled)
    assert.isFalse(subscription.isCreated)
    assert.lengthOf(httpClient!.sentRequests, 0)
  })

  test('should announce only the reconnect attempts that happen', async ({ assert }) => {
    let eventSource: FakeEventSource | null = null
    const attempts: number[] = []
    let reconnectFailed = 0

    const transmit = new Transmit({
      baseUrl: 'http://localhost',
      uidGenerator: () => '1',
      maxReconnectAttempts: 2,
      onReconnectAttempt: (attempt) => attempts.push(attempt),
      onReconnectFailed: () => reconnectFailed++,
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceFactory(url, options) {
        eventSource = new FakeEventSource(url, options.withCredentials)
        return eventSource
      },
    })

    const statuses: string[] = []
    for (const status of ['disconnected', 'reconnecting', 'closed'] as const) {
      transmit.on(status, () => statuses.push(status))
    }

    eventSource!.emit('error', new MessageEvent('error'))
    eventSource!.emit('error', new MessageEvent('error'))

    assert.deepEqual(statuses, ['disconnected', 'reconnecting', 'reconnecting'])
    assert.deepEqual(attempts, [1, 2])
    assert.equal(reconnectFailed, 0)
    assert.isFalse(eventSource!.isClosed)

    eventSource!.emit('error', new MessageEvent('error'))

    assert.deepEqual(statuses, ['disconnected', 'reconnecting', 'reconnecting', 'closed'])
    assert.deepEqual(attempts, [1, 2])
    assert.equal(reconnectFailed, 1)
    assert.isTrue(eventSource!.isClosed)
  })

  test('should not reconnect when maxReconnectAttempts is 0', async ({ assert }) => {
    let eventSource: FakeEventSource | null = null
    const attempts: number[] = []
    let reconnectFailed = 0

    const transmit = new Transmit({
      baseUrl: 'http://localhost',
      uidGenerator: () => '1',
      maxReconnectAttempts: 0,
      onReconnectAttempt: (attempt) => attempts.push(attempt),
      onReconnectFailed: () => reconnectFailed++,
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceFactory(url, options) {
        eventSource = new FakeEventSource(url, options.withCredentials)
        return eventSource
      },
    })

    const statuses: string[] = []
    for (const status of ['disconnected', 'reconnecting', 'closed'] as const) {
      transmit.on(status, () => statuses.push(status))
    }

    eventSource!.emit('error', new MessageEvent('error'))

    assert.deepEqual(statuses, ['disconnected', 'closed'])
    assert.isTrue(eventSource!.isClosed)
    assert.deepEqual(attempts, [])
    assert.equal(reconnectFailed, 1)
  })

  test('should not mutate the options passed by the caller', ({ assert }) => {
    const options = Object.freeze({
      baseUrl: 'http://localhost',
      eventSourceFactory: (url: string | URL, { withCredentials }: { withCredentials: boolean }) =>
        new FakeEventSource(url, withCredentials) as unknown as EventSource,
    })

    new Transmit(options)

    assert.deepEqual(Object.keys(options), ['baseUrl', 'eventSourceFactory'])
  })

  test('should remove subscription from map after delete', async ({ assert }) => {
    let eventSource: FakeEventSource | null = null

    const transmit = new Transmit({
      baseUrl: 'http://localhost',
      uidGenerator: () => '1',
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceFactory(url, options) {
        eventSource = new FakeEventSource(url, options.withCredentials)
        return eventSource
      },
      httpClientFactory(baseUrl, uid) {
        return new FakeHttpClient({ baseUrl, uid })
      },
    })

    eventSource!.sendOpenEvent()

    const subscription = transmit.subscription('channel')
    await subscription.create()
    await subscription.delete()

    const newSubscription = transmit.subscription('channel')

    assert.notStrictEqual(subscription, newSubscription)
    assert.isTrue(subscription.isDeleted)
    assert.isFalse(newSubscription.isDeleted)
  })
})
