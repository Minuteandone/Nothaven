// Tiny event bus shared by all modules.
const handlers = {};
export const bus = {
  on(evt, fn) { (handlers[evt] ||= []).push(fn); },
  off(evt, fn) { handlers[evt] = (handlers[evt] || []).filter(h => h !== fn); },
  emit(evt, payload) { (handlers[evt] || []).forEach(h => h(payload)); },
};
