import { setTimeout } from 'node:timers/promises'
import { test } from '@japa/runner'
import EventSource from 'eventsource'
import { Transmit } from '../src/transmit.js'
import { createServer } from 'node:http'

const PORT = 1337

test.group('Client', () => {
  test('should be able to connect to the server', async ({ assert, cleanup }, done) => {
    assert.plan(1)

    const server = createServer((req) => {
      assert.match(
        req.url!,
        /\/__transmit\/events\?uid=([0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12})/
      )

      done()
    }).listen(PORT)

    cleanup(() => void server.close())

    const transmit = new Transmit({
      baseUrl: `http://localhost:${PORT}`,
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceConstructor: EventSource,
    })

    cleanup(() => void transmit.close())
  }).waitForDone()

  test('should be able to subscribe to a channel', async ({ assert, cleanup }, done) => {
    assert.plan(3)

    const server = createServer((req, res) => {
      //? Handling the connection request
      if (req.url?.startsWith('/__transmit/events')) {
        res.statusCode = 200
        res.write('\n')
        return
      }

      assert.equal(req.url!, '/__transmit/subscribe')
      assert.equal(req.method, 'POST')
      assert.equal(req.headers['content-type'], 'application/json')

      done()
    }).listen(PORT)

    cleanup(() => void server.close())

    const transmit = new Transmit({
      baseUrl: `http://localhost:${PORT}`,
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceConstructor: EventSource,
    })

    cleanup(() => void transmit.close())

    const unsubscribe = transmit.listenOn('channel', () => {})

    cleanup(() => void unsubscribe())
  }).waitForDone()

  test('should not send unsubscription request to server by default', async ({
    assert,
    cleanup,
  }) => {
    const server = createServer((req, res) => {
      //? Handling the connection request
      if (req.url?.startsWith('/__transmit/events')) {
        res.statusCode = 200
        res.write('\n')
        return
      }

      //? Handling the subscription request
      if (req.url?.startsWith('/__transmit/subscribe')) {
        res.statusCode = 200
        res.end()
        return
      }

      assert.fail('Should not reach here')
    }).listen(PORT)

    cleanup(() => void server.close())

    const transmit = new Transmit({
      baseUrl: `http://localhost:${PORT}`,
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceConstructor: EventSource,
    })

    cleanup(() => void transmit.close())

    const unsubscribe = transmit.listenOn('channel', () => {})
    unsubscribe()

    await setTimeout(500)
  })

  test('should send unsubscription request when set up in Transmit instance', async ({
    assert,
    cleanup,
  }, done) => {
    assert.plan(3)

    const server = createServer((req, res) => {
      //? Handling the connection request
      if (req.url?.startsWith('/__transmit/events')) {
        res.statusCode = 200
        res.write('\n')
        return
      }

      //? Handling the subscription request
      if (req.url?.startsWith('/__transmit/subscribe')) {
        res.statusCode = 200
        res.end()
        return
      }

      assert.equal(req.url!, '/__transmit/unsubscribe')
      assert.equal(req.method, 'POST')
      assert.equal(req.headers['content-type'], 'application/json')
      done()
    }).listen(PORT)

    cleanup(() => void server.close())

    const transmit = new Transmit({
      baseUrl: `http://localhost:${PORT}`,
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceConstructor: EventSource,
      removeSubscriptionOnZeroListener: true,
    })

    cleanup(() => void transmit.close())

    const unsubscribe = await transmit.listenOn('channel', () => {})
    await unsubscribe()

    await setTimeout(500)
  }).waitForDone()

  test('should send unsubscription request when set up unsubscribe call', async ({
    assert,
    cleanup,
  }, done) => {
    assert.plan(3)

    const server = createServer((req, res) => {
      //? Handling the connection request
      if (req.url?.startsWith('/__transmit/events')) {
        res.statusCode = 200
        res.write('\n')
        return
      }

      //? Handling the subscription request
      if (req.url?.startsWith('/__transmit/subscribe')) {
        res.statusCode = 200
        res.end()
        return
      }

      assert.equal(req.url!, '/__transmit/unsubscribe')
      assert.equal(req.method, 'POST')
      assert.equal(req.headers['content-type'], 'application/json')
      done()
    }).listen(PORT)

    cleanup(() => void server.close())

    const transmit = new Transmit({
      baseUrl: `http://localhost:${PORT}`,
      // @ts-expect-error - Mock is not 1:1 with EventSource
      eventSourceConstructor: EventSource,
    })

    cleanup(() => void transmit.close())

    const unsubscribe = transmit.listenOn('channel', () => {})
    unsubscribe(true)

    await setTimeout(500)
  }).waitForDone()
})
