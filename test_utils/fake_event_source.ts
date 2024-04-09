export class FakeEventSource {
  hadError = false
  hadMessage = false
  isOpen = false
  constructorOptions: { url: string | URL; withCredentials: boolean }
  listeners: { [type: string]: ((this: EventSource, event: MessageEvent) => any)[] } = {}

  constructor(url: string | URL, withCredentials: boolean = false) {
    this.constructorOptions = { url, withCredentials }
  }

  onerror(): any {
    this.hadError = true
  }

  onmessage(): any {
    this.hadMessage = true
  }

  onopen(): any {
    this.isOpen = true
  }

  addEventListener(type: string, listener: (this: EventSource, event: MessageEvent) => any) {
    if (!this.listeners[type]) {
      this.listeners[type] = []
    }

    this.listeners[type].push(listener)
  }

  emit(type: string, event: MessageEvent) {
    // @ts-expect-error - We know this is a valid type
    this.listeners[type]?.forEach((listener) => listener.call(this, event))
  }
}
