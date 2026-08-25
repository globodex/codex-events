import type { Ref } from 'vue'

import { onBeforeUnmount, watch } from 'vue'

export interface WebMcpTool<Input = Record<string, unknown>, Output = unknown> {
  name: string
  title?: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: {
    readOnlyHint?: boolean
    untrustedContentHint?: boolean
  }
  execute: (
    input: Input,
    options: { signal: AbortSignal }
  ) => Output | Promise<Output>
}

export interface WebMcpModelContext {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal }
  ) => void | Promise<void>
}

declare global {
  interface Document {
    modelContext?: WebMcpModelContext
  }
}

export function createWebMcpToolRegistrationLifecycle(modelContext?: WebMcpModelContext) {
  let registrationController: AbortController | null = null

  function setTool(tool: WebMcpTool | null) {
    registrationController?.abort()
    registrationController = null

    if (!modelContext || !tool) {
      return
    }

    const controller = new AbortController()
    registrationController = controller

    void Promise.resolve(modelContext.registerTool(tool, {
      signal: controller.signal
    })).catch((error) => {
      if (!controller.signal.aborted) {
        console.warn(`Unable to register WebMCP tool "${tool.name}".`, error)
      }
    })
  }

  function dispose() {
    registrationController?.abort()
    registrationController = null
  }

  return {
    dispose,
    setTool
  }
}

function getWebMcpModelContext() {
  if (typeof document === 'undefined'
    || typeof document.modelContext?.registerTool !== 'function') {
    return undefined
  }

  return document.modelContext
}

export function useWebMcpTool(tool: Readonly<Ref<WebMcpTool | null>>) {
  const registration = createWebMcpToolRegistrationLifecycle(getWebMcpModelContext())

  watch(tool, registration.setTool, { immediate: true })
  onBeforeUnmount(registration.dispose)
}
