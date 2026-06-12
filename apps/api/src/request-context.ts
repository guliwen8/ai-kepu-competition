import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = {
  requestId: string;
};

const als = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext(ctx: RequestContext, fn: () => void) {
  als.run(ctx, fn);
}

export function getRequestContext() {
  return als.getStore();
}
