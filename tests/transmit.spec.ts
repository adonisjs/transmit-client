/*
 * @adonisjs/transmit-client
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { Transmit } from '../src/transmit.js'
import { FakeEventSource } from '../test_utils/fake_event_source.js'
import { Subscription } from '../src/subscription.js'

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
})
