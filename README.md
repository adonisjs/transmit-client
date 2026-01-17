<div align="center">
  <h1> AdonisJS Transmit Client</h1>
  <p>A client for the native Server-Sent-Event (SSE) module of AdonisJS.</p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url]
[![gh-workflow-image]][gh-workflow-url]
[![npm-image]][npm-url]
[![npm-download-image]][npm-download-url]
[![license-image]][license-url]

</div>

<div align="center">
  <h3>
    <a href="#installation">
      Usage
    </a>
    <span> | </span>
    <a href="https://adonisjs.com">
      Checkout AdonisJS
    </a>
  </h3>
</div>

<br />

<hr />

AdonisJS Transmit Client is a client for the native Server-Sent-Event (SSE) module of AdonisJS. It is built on top of the [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) API and provides a simple API to receive events from the server.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

  - [Installation](#installation)
  - [Usage](#usage)
  - [Creating a subscription](#creating-a-subscription)
    - [Unsubscribing](#unsubscribing)
    - [Subscription Request](#subscription-request)
    - [Authenticated event stream](#authenticated-event-stream)
    - [Custom UID Generator](#custom-uid-generator)
    - [Reconnecting](#reconnecting)
- [Events](#events)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

Install the package from the npm registry as follows:

```sh
npm i @adonisjs/transmit-client
```

## Usage

The module exposes a `Transmit` class, which can be used to connect to the server and listen for events.

```ts
import { Transmit } from '@adonisjs/transmit-client'

const transmit = new Transmit({
  baseUrl: 'http://localhost:3333',
})
```

## Creating a subscription

The `subscription` method is used to create a subscription to a channel. The method accepts the channel name

```ts
const subscription = transmit.subscription('chat/1')
```

Then, you have to call the `create` method on the subscription to register it on the backend.

```ts
await subscription.create()
```

You can listen for events on the channel using the `onMessage` method. You can define as many listeners as you want on the same subscription.

```ts
subscription.onMessage((message) => {
  console.log(message)
})
```

You can also listen only once for a message using the `onMessagetOnce` method.

```ts
subscription.onMessageOnce((message) => {
  console.log('I will be called only once')
})
```

Note listeners are local only; you can add them before or after registering your subscription on the server.

### Unsubscribing

The `onMessage` method returns a function to remove the message handler from the subscription.

```ts
const unsubscribe = subscription.onMessage(() => {
  console.log('message received!')
})

// later
unsubscribe()
```

If you want to entirely remove the subscription from the server, you can call the `delete` method.

```ts
await subscription.delete()
```

### Subscription Request

You can alter the subscription request by using the `beforeSubscribe` or `beforeUnsubscribe` options.

```ts
const transmit = new Transmit({
  baseUrl: 'http://localhost:3333',
  beforeSubscribe: (_request: Request) => {
    console.log('beforeSubscribe')
  },
  beforeUnsubscribe: (_request: Request) => {
    console.log('beforeUnsubscribe')
  },
})
```

### Authenticated event stream

The `__transmit/events` stream is opened using `EventSource`, which cannot send custom headers. That means `beforeSubscribe`/`beforeUnsubscribe` only affect the subscribe/unsubscribe HTTP calls. If you rely on header-based auth, protect `__transmit/subscribe` and `__transmit/unsubscribe`, or provide a custom `eventSourceFactory` that can send headers.

Example using `@microsoft/fetch-event-source`:

```ts
import { fetchEventSource } from '@microsoft/fetch-event-source'

function createFetchEventSource(
  url: string | URL,
  options: { withCredentials: boolean },
  headers: Record<string, string>
) {
  const controller = new AbortController()
  const listeners = new Map<string, Set<(event: MessageEvent) => void>>()

  const dispatch = (type: string, data?: string) => {
    const event = new MessageEvent(type, { data })
    listeners.get(type)?.forEach((listener) => listener(event))
  }

  fetchEventSource(url.toString(), {
    headers,
    credentials: options.withCredentials ? 'include' : 'omit',
    signal: controller.signal,
    onopen: () => dispatch('open'),
    onmessage: (message) => dispatch(message.event ?? 'message', message.data),
    onerror: () => {
      dispatch('error')
    },
  })

  return {
    addEventListener(type: string, listener: (event: MessageEvent) => void) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set())
      }
      listeners.get(type)!.add(listener)
    },
    removeEventListener(type: string, listener: (event: MessageEvent) => void) {
      listeners.get(type)?.delete(listener)
    },
    close() {
      controller.abort()
    },
  } as EventSource
}

const transmit = new Transmit({
  baseUrl: 'http://localhost:3333',
  eventSourceFactory: (url, options) => {
    return createFetchEventSource(url, options, {
      Authorization: `Bearer ${token}`,
    })
  },
})
```

Note: this adapter is minimal and only wires `open`, `error`, and `message` (or custom event names). If you rely on other `EventSource` features like `readyState` or `onopen`, you may want to expand it.

### Custom UID Generator

By default, Transmit uses `crypto.randomUUID()` to generate unique client identifiers. This method only works in [secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) (HTTPS). If you need to use Transmit over HTTP (e.g., local network deployments), you can provide a custom `uidGenerator` function.

```ts
const transmit = new Transmit({
  baseUrl: 'http://localhost:3333',
  uidGenerator: () => {
    return Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('')
  },
})
```

Or using a library like `uuid`:

```ts
import { v4 as uuid } from 'uuid'

const transmit = new Transmit({
  baseUrl: 'http://localhost:3333',
  uidGenerator: () => uuid(),
})
```

### Reconnecting

The transmit client will automatically reconnect to the server when the connection is lost. You can change the number of retries and hook into the reconnect lifecycle as follows:

```ts
const transmit = new Transmit({
  baseUrl: 'http://localhost:3333',
  maxReconnectionAttempts: 5,
  onReconnectAttempt: (attempt) => {
    console.log('Reconnect attempt ' + attempt)
  },
  onReconnectFailed: () => {
    console.log('Reconnect failed')
  },
})
```

# Events

The `Transmit` class uses the [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) class to emits multiple events.

```ts
transmit.on('connected', () => {
  console.log('connected')
})

transmit.on('disconnected', () => {
  console.log('disconnected')
})

transmit.on('reconnecting', () => {
  console.log('reconnecting')
})
```

That means you can also remove an event listener previously registered, by passing the event listener function itself.

```ts
const onConnected = () => {
  console.log('connected')
}

transmit.on('connected', onConnected)
transmit.off('connected', onConnected)
```

[gh-workflow-image]: https://img.shields.io/github/actions/workflow/status/adonisjs/transmit-client/checks.yml?branch=develop&style=for-the-badge
[gh-workflow-url]: https://github.com/adonisjs/transmit-client/actions/workflows/checks.yml
[npm-image]: https://img.shields.io/npm/v/@adonisjs/transmit-client.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@adonisjs/transmit-client
[npm-download-image]: https://img.shields.io/npm/dm/@adonisjs/transmit-client?style=for-the-badge
[npm-download-url]: https://www.npmjs.com/package/@adonisjs/transmit-client
[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org
[license-image]: https://img.shields.io/npm/l/@adonisjs/transmit-client?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md
