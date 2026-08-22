import { beforeAll, describe, expect, test, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  h,
  nextTick,
  readonly,
  ref,
  shallowRef
} from 'vue'

import type { ParticipantRegistrationDraft } from '../../../../app/domains/applications/participant-registration-definition'
import { useParticipantRegistrationController } from '../../../../app/components/applications/participant-registration/useParticipantRegistrationController'
import {
  createParticipantRegistrationDraft,
  resolveParticipantRegistrationDefinition
} from '../../../../app/domains/applications/participant-registration-definition'

interface HostNode {
  parent: HostElement | null
  text: string
}

interface HostElement extends HostNode {
  type: string
  props: Record<string, unknown>
  children: HostNode[]
}

function createHostElement(type: string): HostElement {
  return { type, props: {}, children: [], parent: null, text: '' }
}

const renderer = createRenderer<HostNode, HostElement>({
  patchProp(element, key, _previous, next) {
    element.props[key] = next
  },
  insert(child, parent, anchor) {
    child.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index < 0) parent.children.push(child)
    else parent.children.splice(index, 0, child)
  },
  remove(child) {
    if (!child.parent) return
    const index = child.parent.children.indexOf(child)
    if (index >= 0) child.parent.children.splice(index, 1)
    child.parent = null
  },
  createElement: createHostElement,
  createText: text => ({ parent: null, text }),
  createComment: text => ({ parent: null, text }),
  setText(node, text) {
    node.text = text
  },
  setElementText(element, text) {
    element.text = text
    element.children = []
  },
  parentNode: node => node.parent,
  nextSibling(node) {
    if (!node.parent) return null
    const index = node.parent.children.indexOf(node)
    return node.parent.children[index + 1] ?? null
  },
  querySelector: () => null,
  setScopeId: () => {},
  cloneNode: node => ({ ...node, props: { ...node.props }, children: [...node.children] }),
  insertStaticContent(content, parent, anchor) {
    const node = createHostElement('static')
    node.text = content
    node.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index < 0) parent.children.push(node)
    else parent.children.splice(index, 0, node)
    return [node, node]
  }
})

beforeAll(() => {
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('nextTick', nextTick)
  vi.stubGlobal('readonly', readonly)
  vi.stubGlobal('shallowRef', shallowRef)
  vi.stubGlobal('CSS', { escape: (value: string) => value })
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: true })
  })
})

function mountController(draft: ParticipantRegistrationDraft) {
  const draftRef = ref(draft)
  const definition = resolveParticipantRegistrationDefinition({
    event: {
      eventType: 'meetup',
      inPersonEvent: false,
      applicationWhyThisEventVisible: false,
      applicationProofOfExecutionVisible: false,
      applicationTeamIntentVisible: false,
      applicationAiKnowledgeVisible: false,
      requireWhyThisEvent: false,
      requireProofOfExecution: false,
      requireTeamIntent: false,
      requireAiKnowledge: false
    },
    profileFields: [],
    trackOptions: [],
    maxTeamMembers: 1,
    currentApplicationTerms: null,
    talkProposal: null
  })
  let controller: ReturnType<typeof useParticipantRegistrationController> | null = null
  const Harness = defineComponent({
    setup() {
      controller = useParticipantRegistrationController({ draft: draftRef, definition: () => definition })
      return () => h('div')
    }
  })
  const root = createHostElement('root')
  const app = renderer.createApp(Harness)
  app.mount(root)

  if (!controller) throw new Error('Controller did not mount.')
  return { app, controller, draftRef }
}

describe('mounted participant registration controller', () => {
  test('updates progress from the mounted reactive draft', async () => {
    const mounted = mountController(createParticipantRegistrationDraft())
    expect(mounted.controller.progressPercent.value).toBe(0)
    expect(mounted.controller.readinessText.value).toBe('2 required items left')

    mounted.draftRef.value.profileForm.firstName = 'Ada'
    mounted.draftRef.value.profileForm.familyName = 'Lovelace'
    await nextTick()

    expect(mounted.controller.progressPercent.value).toBe(100)
    expect(mounted.controller.readinessText.value).toBe('Ready to submit')
    mounted.app.unmount()
  })

  test('focuses the first invalid field with reduced motion after submit', async () => {
    const mounted = mountController(createParticipantRegistrationDraft())
    let focused = false
    let behavior = ''
    const control = {
      focus: () => { focused = true }
    }
    const field = {
      matches: () => false,
      querySelector: () => control,
      scrollIntoView: (options: ScrollIntoViewOptions) => { behavior = String(options.behavior) }
    }
    const root = {
      querySelector: (selector: string) => selector.includes('profileForm.firstName') ? field : null
    } as unknown as HTMLElement

    await expect(mounted.controller.validateSubmitAttempt(root)).resolves.toBe(false)
    expect(focused).toBe(true)
    expect(behavior).toBe('auto')
    expect(mounted.controller.displayedErrors.value['profileForm.firstName']).toBe('Enter your first name.')
    mounted.app.unmount()
  })

  test('navigates the rail through the centrally derived section target', () => {
    const mounted = mountController(createParticipantRegistrationDraft())
    let selector = ''
    let focused = false
    const target = {
      scrollIntoView: vi.fn(),
      focus: () => { focused = true }
    }
    const root = {
      querySelector: (value: string) => {
        selector = value
        return target
      }
    } as unknown as HTMLElement

    mounted.controller.navigateToSection(root, 'confirmation')
    expect(selector).toBe('#registration-section-confirmation')
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
    expect(focused).toBe(true)
    mounted.app.unmount()
  })
})
