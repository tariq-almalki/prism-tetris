class EventBus {
  constructor() {
    this.listeners = new Map();
  }
  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }
  once(event, callback) {
    const off = this.on(event, (data) => {
      off();
      callback(data);
    });
    return off;
  }
  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }
  emit(event, data) {
    for (const callback of this.listeners.get(event) ?? []) callback(data);
  }
  clear() {
    this.listeners.clear();
  }
}
export const bus = new EventBus();
export { EventBus };
