<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'

import type { EventCertificate } from '#shared/domains/events/certificates'
import {
  eventCertificateTypeLabels,
  formatEventCertificatePlacement,
  resolveEventCertificatePlacementTier
} from '#shared/domains/events/certificates'

import platformMarkWhite from '~/assets/images/platform-mark-white.png'

const props = defineProps<{
  certificate: EventCertificate
  celebrate?: boolean
  variant?: 'holo' | 'normal'
}>()

const isHolo = computed(() => props.variant !== 'normal')
const markGradientId = useId()
const stageElement = ref<HTMLElement | null>(null)
const isPointerActive = ref(false)
const tiltX = ref(0)
const tiltY = ref(0)
const glareX = ref(50)
const glareY = ref(30)
const reducedMotion = usePreferredReducedMotion()

const tiltTarget = { x: 0, y: 0, glareX: 50, glareY: 30 }
let tiltFrame = 0

function stopTiltLoop() {
  if (tiltFrame) {
    cancelAnimationFrame(tiltFrame)
    tiltFrame = 0
  }
}

function runTiltLoop() {
  tiltFrame = 0
  tiltX.value += (tiltTarget.x - tiltX.value) * 0.18
  tiltY.value += (tiltTarget.y - tiltY.value) * 0.18
  glareX.value += (tiltTarget.glareX - glareX.value) * 0.18
  glareY.value += (tiltTarget.glareY - glareY.value) * 0.18

  const settled = Math.abs(tiltTarget.x - tiltX.value) < 0.01 && Math.abs(tiltTarget.y - tiltY.value) < 0.01

  if (!settled && isPointerActive.value) {
    tiltFrame = requestAnimationFrame(runTiltLoop)
  }
}

function handlePointerMove(event: PointerEvent) {
  const element = stageElement.value

  if (!element || !isHolo.value || reducedMotion.value === 'reduce') {
    return
  }

  const rect = element.getBoundingClientRect()
  const pointerX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const pointerY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))

  isPointerActive.value = true
  tiltTarget.x = (pointerX - 0.5) * 12
  tiltTarget.y = (0.5 - pointerY) * 10
  tiltTarget.glareX = pointerX * 100
  tiltTarget.glareY = pointerY * 100

  if (!tiltFrame) {
    tiltFrame = requestAnimationFrame(runTiltLoop)
  }
}

function resetTilt() {
  stopTiltLoop()
  isPointerActive.value = false
  tiltTarget.x = 0
  tiltTarget.y = 0
  tiltTarget.glareX = 50
  tiltTarget.glareY = 30
  tiltX.value = 0
  tiltY.value = 0
  glareX.value = 50
  glareY.value = 30
}

onBeforeUnmount(stopTiltLoop)

const cardStyle = computed(() => ({
  transform: `rotateX(${tiltY.value.toFixed(2)}deg) rotateY(${tiltX.value.toFixed(2)}deg)`,
  transition: isPointerActive.value ? 'none' : 'transform 700ms cubic-bezier(0.2, 0.8, 0.2, 1)'
}))

const glareStyle = computed(() => ({
  background: `radial-gradient(circle at ${glareX.value.toFixed(1)}% ${glareY.value.toFixed(1)}%, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0.06) 30%, rgba(255, 255, 255, 0) 60%)`,
  opacity: isPointerActive.value ? 1 : 0.6
}))

const sheenStyle = computed(() => ({
  backgroundPosition: `${(50 + tiltX.value * 5).toFixed(1)}% 0%`
}))

const isCelebrating = ref(false)
let celebrationTimeout: ReturnType<typeof setTimeout> | undefined

watch(() => props.celebrate, (celebrate) => {
  if (!celebrate) {
    return
  }

  isCelebrating.value = true
  clearTimeout(celebrationTimeout)
  celebrationTimeout = setTimeout(() => {
    isCelebrating.value = false
  }, 2400)
})

onBeforeUnmount(() => clearTimeout(celebrationTimeout))

const celebrationSparkSeeds = [
  { left: '24%', top: '30%', dx: '-90px', dy: '-110px', delay: '0ms', tone: 'gold' },
  { left: '50%', top: '18%', dx: '10px', dy: '-130px', delay: '60ms', tone: 'plain' },
  { left: '74%', top: '28%', dx: '110px', dy: '-90px', delay: '120ms', tone: 'accent' },
  { left: '14%', top: '52%', dx: '-130px', dy: '-10px', delay: '90ms', tone: 'plain' },
  { left: '86%', top: '50%', dx: '130px', dy: '-20px', delay: '40ms', tone: 'gold' },
  { left: '30%', top: '74%', dx: '-100px', dy: '90px', delay: '150ms', tone: 'accent' },
  { left: '52%', top: '82%', dx: '0px', dy: '120px', delay: '110ms', tone: 'gold' },
  { left: '72%', top: '72%', dx: '110px', dy: '90px', delay: '30ms', tone: 'plain' },
  { left: '40%', top: '24%', dx: '-50px', dy: '-120px', delay: '180ms', tone: 'gold' },
  { left: '62%', top: '22%', dx: '60px', dy: '-115px', delay: '200ms', tone: 'plain' },
  { left: '20%', top: '40%', dx: '-120px', dy: '-60px', delay: '230ms', tone: 'plain' },
  { left: '80%', top: '38%', dx: '120px', dy: '-60px', delay: '170ms', tone: 'accent' }
] as const

const celebrationSparkTones = computed(() => isHolo.value
  ? { gold: '#ffe9a8', plain: '#ffffff', accent: '#c4b5ff' }
  : { gold: '#f59e0b', plain: '#6366f1', accent: '#a855f7' })
const celebrationSparks = computed(() => celebrationSparkSeeds.map(seed => ({
  ...seed,
  color: celebrationSparkTones.value[seed.tone]
})))

const typeLabel = computed(() => eventCertificateTypeLabels[props.certificate.eventType])

const placementTier = computed(() => props.certificate.placement
  ? resolveEventCertificatePlacementTier(props.certificate.placement)
  : null)
const placementLabel = computed(() => props.certificate.placement
  ? formatEventCertificatePlacement(props.certificate.placement).toUpperCase()
  : '')

const participantNameSize = computed(() => {
  const length = props.certificate.participantName.length

  if (length <= 14) {
    return '7.4cqw'
  }

  if (length <= 22) {
    return '5.9cqw'
  }

  if (length <= 32) {
    return '4.1cqw'
  }

  return '3.3cqw'
})
</script>

<template>
  <div
    class="certificate-card-stage relative w-full"
    :class="[`certificate-card-stage--${certificate.eventType}`, { 'certificate-card-stage--normal': !isHolo }]"
    data-testid="event-certificate-card"
    :data-variant="isHolo ? 'holo' : 'normal'"
  >
    <div
      ref="stageElement"
      class="certificate-card-perspective"
      @pointermove="handlePointerMove"
      @pointerleave="resetTilt"
      @pointercancel="resetTilt"
    >
      <div
        class="certificate-card text-left"
        :class="{ 'certificate-card--celebrating': isCelebrating }"
        :style="cardStyle"
        role="img"
        :aria-label="`${certificate.participantName} — Certificate of Participation, ${certificate.eventName}`"
      >
        <template v-if="isHolo">
          <div
            class="certificate-card__grid"
            aria-hidden="true"
          />
          <div
            class="certificate-card__dots certificate-card__dots--top"
            aria-hidden="true"
          />
          <div
            class="certificate-card__dots certificate-card__dots--right"
            aria-hidden="true"
          />
          <div
            class="certificate-card__rings"
            aria-hidden="true"
          />
          <div
            class="certificate-card__sheen"
            :class="{ 'certificate-card__sheen--celebrating': isCelebrating }"
            :style="sheenStyle"
            aria-hidden="true"
          />
          <div
            class="certificate-card__glare"
            :style="glareStyle"
            aria-hidden="true"
          />
          <span
            class="certificate-card__spark left-[26%] top-[18%] text-[1.7cqw]"
            aria-hidden="true"
          >+</span>
          <span
            class="certificate-card__spark left-[8%] top-[62%] text-[1.3cqw]"
            aria-hidden="true"
          >+</span>
          <span
            class="certificate-card__spark left-[58%] top-[12%] text-[1.2cqw]"
            aria-hidden="true"
          >+</span>
        </template>

        <img
          v-if="isHolo"
          :src="platformMarkWhite"
          alt=""
          aria-hidden="true"
          class="certificate-card__mark absolute right-[4.5cqw] top-[9%] z-0 w-[max(44px,13cqw)]"
        >
        <svg
          v-else
          class="certificate-card__mark certificate-card__mark--normal absolute right-[4.5cqw] top-[9%] z-0 w-[max(44px,13cqw)]"
          viewBox="0 0 120 120"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              :id="`certificate-mark-gradient-${markGradientId}`"
              x1="38"
              y1="6"
              x2="74"
              y2="116"
              gradientUnits="userSpaceOnUse"
            >
              <stop
                offset="0"
                stop-color="var(--certificate-mark-from)"
              />
              <stop
                offset="0.55"
                stop-color="var(--certificate-mark-via)"
              />
              <stop
                offset="1"
                stop-color="var(--certificate-mark-to)"
              />
            </linearGradient>
          </defs>
          <g :fill="`url(#certificate-mark-gradient-${markGradientId})`">
            <circle
              cx="44"
              cy="36"
              r="25"
            />
            <circle
              cx="78"
              cy="32"
              r="21"
            />
            <circle
              cx="97"
              cy="56"
              r="19"
            />
            <circle
              cx="90"
              cy="82"
              r="20"
            />
            <circle
              cx="62"
              cy="92"
              r="21"
            />
            <circle
              cx="34"
              cy="84"
              r="20"
            />
            <circle
              cx="22"
              cy="56"
              r="19"
            />
            <circle
              cx="60"
              cy="60"
              r="32"
            />
          </g>
          <path
            d="M 45 44 L 60 59 L 45 74"
            fill="none"
            stroke="#ffffff"
            stroke-width="9"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <line
            x1="68"
            y1="78"
            x2="88"
            y2="78"
            stroke="#ffffff"
            stroke-width="9"
            stroke-linecap="round"
          />
        </svg>

        <div
          class="relative z-10 flex h-full flex-col px-[4.4cqw] py-[3.4cqw]"
          aria-hidden="true"
        >
          <p class="absolute left-[4.4cqw] top-[3.4cqw] text-[length:var(--certificate-wordmark-size)] font-bold leading-[1.45] tracking-[var(--certificate-wordmark-tracking)] text-[var(--certificate-ink-strong)]">
            CODEX<br>EVENTS
          </p>

          <div class="flex flex-1 flex-col items-center justify-center text-center">
            <p
              v-if="placementTier"
              class="certificate-card__placement mb-[max(5px,1.3cqw)]"
              :class="`certificate-card__placement--${placementTier}`"
              data-testid="certificate-card-placement"
            >
              <AppIcon
                name="i-lucide-trophy"
                class="size-[max(9px,1.5cqw)]"
              />
              {{ placementLabel }}
            </p>
            <p class="text-[max(8px,1.45cqw)] font-semibold tracking-[var(--certificate-title-tracking)] text-[var(--certificate-ink)]">
              CERTIFICATE OF PARTICIPATION
            </p>
            <p
              class="certificate-card__name mt-[max(6px,1.6cqw)] max-w-[68cqw] font-semibold uppercase leading-[1.08] tracking-[0.05em]"
              :style="{ fontSize: participantNameSize }"
            >
              {{ certificate.participantName }}
            </p>
            <p class="mt-[max(8px,2cqw)] rounded-full border border-[var(--certificate-pill-border)] px-[max(10px,2.6cqw)] py-[max(3px,0.85cqw)] text-[max(8px,1.4cqw)] font-semibold uppercase tracking-[var(--certificate-pill-tracking)] text-[var(--certificate-ink)]">
              {{ certificate.eventName }}
            </p>
          </div>

          <div class="certificate-card__footer">
            <div class="flex items-center gap-[max(7px,1.1cqw)]">
              <span class="certificate-card__icon-tile">
                <AppIcon
                  name="i-lucide-box"
                  class="size-[max(11px,1.7cqw)]"
                />
              </span>
              <span class="flex flex-col gap-[max(2px,0.4cqw)]">
                <span class="text-[max(7px,1cqw)] font-semibold tracking-[0.28em] text-[var(--certificate-ink-soft)]">EVENT TYPE</span>
                <span class="whitespace-nowrap text-[max(9px,1.5cqw)] font-semibold text-[var(--certificate-ink-strong)]">{{ typeLabel }}</span>
              </span>
            </div>

            <div class="certificate-card__divider" />
            <div class="flex items-center gap-[max(7px,1.1cqw)]">
              <span class="certificate-card__icon-tile">
                <AppIcon
                  name="i-lucide-calendar-days"
                  class="size-[max(11px,1.7cqw)]"
                />
              </span>
              <span class="flex flex-col gap-[max(2px,0.4cqw)]">
                <span class="text-[max(7px,1cqw)] font-semibold tracking-[0.28em] text-[var(--certificate-ink-soft)]">EVENT DATE</span>
                <span class="whitespace-nowrap text-[max(9px,1.5cqw)] font-semibold text-[var(--certificate-ink-strong)]">{{ certificate.eventDateLabel }}</span>
              </span>
            </div>

            <template v-if="certificate.trackName">
              <div class="certificate-card__divider" />
              <div class="flex min-w-0 items-center gap-[max(7px,1.1cqw)]">
                <span class="certificate-card__icon-tile">
                  <AppIcon
                    name="i-lucide-wrench"
                    class="size-[max(11px,1.7cqw)]"
                  />
                </span>
                <span class="flex min-w-0 flex-col gap-[max(2px,0.4cqw)]">
                  <span class="text-[max(7px,1cqw)] font-semibold tracking-[0.28em] text-[var(--certificate-ink-soft)]">TRACK</span>
                  <span class="truncate whitespace-nowrap text-[max(9px,1.5cqw)] font-semibold text-[var(--certificate-ink-strong)]">{{ certificate.trackName }}</span>
                </span>
              </div>
            </template>

            <div class="certificate-card__divider" />
            <div class="flex items-center gap-[max(7px,1.1cqw)]">
              <span class="certificate-card__icon-tile">
                <AppIcon
                  name="i-lucide-shield-check"
                  class="size-[max(11px,1.7cqw)]"
                />
              </span>
              <span class="flex flex-col gap-[max(2px,0.4cqw)]">
                <span class="text-[max(7px,1cqw)] font-semibold tracking-[0.28em] text-[var(--certificate-ink-soft)]">CERTIFICATE ID</span>
                <span class="whitespace-nowrap text-[max(9px,1.5cqw)] font-semibold text-[var(--certificate-ink-strong)]">{{ certificate.certificateId }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="isCelebrating"
      class="pointer-events-none absolute inset-0 z-20"
      aria-hidden="true"
    >
      <span
        v-for="(spark, index) in celebrationSparks"
        :key="index"
        class="certificate-card__celebration-spark"
        :style="{ 'left': spark.left, 'top': spark.top, 'color': spark.color, 'animationDelay': spark.delay, '--spark-dx': spark.dx, '--spark-dy': spark.dy }"
      />
    </div>

    <div
      class="certificate-card__reflection"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.certificate-card-stage {
  container-type: inline-size;
  --certificate-ink-strong: #ffffff;
  --certificate-ink: rgba(255, 255, 255, 0.9);
  --certificate-ink-soft: rgba(255, 255, 255, 0.85);
  --certificate-pill-border: rgba(255, 255, 255, 0.55);
  --certificate-wordmark-size: max(14px, 2.34cqw);
  --certificate-wordmark-tracking: 0.42em;
  --certificate-title-tracking: 0.4em;
  --certificate-pill-tracking: 0.34em;
}

.certificate-card-perspective {
  perspective: 1400px;
  touch-action: pan-y;
}

.certificate-card {
  position: relative;
  aspect-ratio: 2.35 / 1;
  border-radius: clamp(14px, 2.6cqw, 30px);
  border: 1.5px solid var(--certificate-frame);
  overflow: hidden;
  will-change: transform;
  background:
    radial-gradient(90% 160% at 0% 0%, var(--certificate-glow-left) 0%, rgba(0, 0, 0, 0) 55%),
    radial-gradient(95% 170% at 100% 100%, var(--certificate-glow-right) 0%, rgba(0, 0, 0, 0) 58%),
    linear-gradient(112deg, var(--certificate-from) 0%, var(--certificate-via) 48%, var(--certificate-to) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    inset 0 0 70px rgba(255, 255, 255, 0.07),
    0 0 50px -6px var(--certificate-edge-glow),
    0 38px 90px -22px rgba(0, 0, 0, 0.85);
}

.certificate-card-stage--build {
  --certificate-from: #0a1186;
  --certificate-via: #2f33d8;
  --certificate-to: #7a5cf0;
  --certificate-glow-left: rgba(48, 92, 255, 0.55);
  --certificate-glow-right: rgba(151, 120, 255, 0.5);
  --certificate-frame: rgba(196, 208, 255, 0.7);
  --certificate-edge-glow: rgba(91, 105, 255, 0.55);
  --certificate-dot: rgba(150, 190, 255, 0.55);
}

.certificate-card-stage--hackathon {
  --certificate-from: #560a9b;
  --certificate-via: #a519c2;
  --certificate-to: #ea4581;
  --certificate-glow-left: rgba(190, 70, 255, 0.55);
  --certificate-glow-right: rgba(255, 92, 150, 0.55);
  --certificate-frame: rgba(255, 214, 240, 0.65);
  --certificate-edge-glow: rgba(232, 86, 180, 0.5);
  --certificate-dot: rgba(255, 160, 210, 0.55);
}

.certificate-card-stage--meetup {
  --certificate-from: #013f70;
  --certificate-via: #0782c3;
  --certificate-to: #2cd4c4;
  --certificate-glow-left: rgba(36, 158, 255, 0.55);
  --certificate-glow-right: rgba(80, 240, 220, 0.5);
  --certificate-frame: rgba(188, 242, 248, 0.65);
  --certificate-edge-glow: rgba(45, 205, 220, 0.5);
  --certificate-dot: rgba(140, 235, 230, 0.55);
}

.certificate-card-stage--normal {
  --certificate-ink-strong: #131c3f;
  --certificate-ink: #313b5e;
  --certificate-ink-soft: #5b647c;
  --certificate-pill-border: rgba(19, 28, 63, 0.22);
}

.certificate-card-stage--normal.certificate-card-stage--build {
  --certificate-normal-accent: #4753f0;
  --certificate-normal-accent-deep: #2733c8;
  --certificate-normal-tint: #eef0fe;
  --certificate-normal-tint-strong: rgba(79, 93, 240, 0.10);
  --certificate-normal-glow: rgba(79, 93, 240, 0.28);
  --certificate-mark-from: #a78bfa;
  --certificate-mark-via: #5560f5;
  --certificate-mark-to: #2c3bee;
}

.certificate-card-stage--normal.certificate-card-stage--hackathon {
  --certificate-normal-accent: #b423a8;
  --certificate-normal-accent-deep: #87187d;
  --certificate-normal-tint: #fdeef8;
  --certificate-normal-tint-strong: rgba(200, 38, 150, 0.10);
  --certificate-normal-glow: rgba(200, 38, 150, 0.24);
  --certificate-mark-from: #d18bf5;
  --certificate-mark-via: #c43bd8;
  --certificate-mark-to: #e8447f;
}

.certificate-card-stage--normal.certificate-card-stage--meetup {
  --certificate-normal-accent: #0a9b95;
  --certificate-normal-accent-deep: #077772;
  --certificate-normal-tint: #e9faf7;
  --certificate-normal-tint-strong: rgba(13, 148, 136, 0.10);
  --certificate-normal-glow: rgba(13, 148, 136, 0.24);
  --certificate-mark-from: #5ad7e8;
  --certificate-mark-via: #18a7c4;
  --certificate-mark-to: #0c8f86;
}

.certificate-card-stage--normal .certificate-card {
  border: 1px solid rgba(19, 28, 63, 0.14);
  background:
    radial-gradient(70% 110% at 100% 0%, var(--certificate-normal-tint-strong) 0%, rgba(255, 255, 255, 0) 55%),
    linear-gradient(180deg, #ffffff 0%, #fbfbfe 55%, var(--certificate-normal-tint) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 1px 2px rgba(19, 28, 63, 0.06),
    0 18px 60px -30px var(--certificate-normal-glow),
    0 28px 56px -28px rgba(19, 28, 63, 0.28);
}

.certificate-card-stage--normal .certificate-card__name {
  background-image: linear-gradient(180deg, #1d2750 30%, var(--certificate-normal-accent-deep) 125%);
  filter: none;
}

.certificate-card-stage--normal .certificate-card__mark--normal {
  filter: drop-shadow(0 0.5cqw 1.4cqw var(--certificate-normal-glow));
  opacity: 1;
}

.certificate-card-stage--normal .certificate-card__icon-tile {
  border-color: color-mix(in srgb, var(--certificate-normal-accent) 28%, transparent);
  background: color-mix(in srgb, var(--certificate-normal-accent) 8%, transparent);
  color: var(--certificate-normal-accent-deep);
}

.certificate-card-stage--normal .certificate-card__divider {
  background: rgba(19, 28, 63, 0.14);
}

.certificate-card-stage--normal .certificate-card__placement--gold {
  color: #92400e;
  border-color: rgba(217, 119, 6, 0.45);
  background: rgba(251, 191, 36, 0.16);
  box-shadow: none;
}

.certificate-card-stage--normal .certificate-card__placement--silver {
  color: #475569;
  border-color: rgba(100, 116, 139, 0.42);
  background: rgba(148, 163, 184, 0.16);
  box-shadow: none;
}

.certificate-card-stage--normal .certificate-card__placement--bronze {
  color: #9a3412;
  border-color: rgba(194, 93, 32, 0.45);
  background: rgba(234, 138, 66, 0.16);
  box-shadow: none;
}

.certificate-card-stage--normal .certificate-card__reflection {
  background: radial-gradient(50% 100% at 50% 0%, rgba(19, 28, 63, 0.22) 0%, rgba(0, 0, 0, 0) 75%);
  opacity: 0.55;
}

.certificate-card__grid {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(120% 140% at 50% 50%, rgba(0, 0, 0, 0) 55%, rgba(8, 6, 40, 0.5) 100%),
    linear-gradient(rgba(255, 255, 255, 0.055) 1px, rgba(0, 0, 0, 0) 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.055) 1px, rgba(0, 0, 0, 0) 1px);
  background-size: 100% 100%, 2.4cqw 2.4cqw, 2.4cqw 2.4cqw;
  pointer-events: none;
}

.certificate-card__dots {
  position: absolute;
  background-image: radial-gradient(circle at 0.35cqw 0.35cqw, var(--certificate-dot) 0.22cqw, rgba(0, 0, 0, 0) 0.26cqw);
  background-size: 1.5cqw 1.5cqw;
  pointer-events: none;
}

.certificate-card__dots--top {
  top: 6%;
  left: 3.5%;
  width: 24%;
  height: 42%;
  mask-image: radial-gradient(120% 120% at 0% 0%, #000 30%, rgba(0, 0, 0, 0) 75%);
}

.certificate-card__dots--right {
  right: 2.5%;
  top: 6%;
  width: 26%;
  height: 70%;
  mask-image: radial-gradient(120% 120% at 100% 0%, #000 30%, rgba(0, 0, 0, 0) 75%);
}

.certificate-card__rings {
  position: absolute;
  left: 50%;
  top: 46%;
  width: 46cqw;
  height: 46cqw;
  transform: translate(-50%, -50%);
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  pointer-events: none;
}

.certificate-card__rings::after {
  content: '';
  position: absolute;
  inset: 16%;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.10);
}

.certificate-card__placement {
  display: inline-flex;
  align-items: center;
  gap: max(4px, 0.7cqw);
  border-radius: 9999px;
  border: 1px solid;
  padding: max(3px, 0.55cqw) max(10px, 1.8cqw);
  font-size: max(8px, 1.25cqw);
  font-weight: 600;
  letter-spacing: 0.3em;
}

.certificate-card__placement--gold {
  color: #ffe9a8;
  border-color: rgba(255, 214, 110, 0.75);
  background: rgba(120, 84, 12, 0.4);
  box-shadow: 0 0 1.8cqw rgba(255, 200, 80, 0.45);
}

.certificate-card__placement--silver {
  color: #eef2f8;
  border-color: rgba(226, 232, 240, 0.72);
  background: rgba(82, 92, 108, 0.42);
  box-shadow: 0 0 1.8cqw rgba(214, 224, 238, 0.4);
}

.certificate-card__placement--bronze {
  color: #ffd9b8;
  border-color: rgba(228, 168, 112, 0.72);
  background: rgba(112, 62, 20, 0.45);
  box-shadow: 0 0 1.8cqw rgba(238, 162, 90, 0.4);
}

.certificate-card__sheen {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(112deg, rgba(255, 255, 255, 0) 36%, rgba(255, 255, 255, 0.30) 48%, rgba(255, 255, 255, 0.05) 55%, rgba(255, 255, 255, 0) 66%);
  background-size: 220% 100%;
  mix-blend-mode: screen;
  pointer-events: none;
}

.certificate-card__glare {
  position: absolute;
  inset: 0;
  mix-blend-mode: overlay;
  transition: opacity 400ms ease;
  pointer-events: none;
}

.certificate-card__spark {
  position: absolute;
  color: rgba(255, 255, 255, 0.75);
  font-weight: 300;
  line-height: 1;
  pointer-events: none;
}

.certificate-card__mark {
  filter: drop-shadow(0 0 1.6cqw rgba(170, 150, 255, 0.65));
  opacity: 0.95;
}

.certificate-card__name {
  background-image: linear-gradient(180deg, #ffffff 16%, #dfe6ff 52%, #aebcff 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  filter:
    drop-shadow(0 0.35cqw 0.1cqw rgba(20, 16, 70, 0.45))
    drop-shadow(0 0.9cqw 2cqw rgba(30, 20, 120, 0.5));
}

.certificate-card__icon-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: max(22px, 3.4cqw);
  height: max(22px, 3.4cqw);
  border-radius: max(6px, 0.8cqw);
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.10);
  color: #ffffff;
  flex: none;
}

.certificate-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-evenly;
}

.certificate-card__divider {
  width: 1px;
  height: max(20px, 3.6cqw);
  background: rgba(255, 255, 255, 0.28);
  flex: none;
}

@container (max-width: 480px) {
  .certificate-card {
    aspect-ratio: 1.6 / 1;
    --certificate-wordmark-size: 11px;
    --certificate-wordmark-tracking: 0.3em;
    --certificate-title-tracking: 0.24em;
    --certificate-pill-tracking: 0.2em;
  }

  .certificate-card__footer {
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px 22px;
  }

  .certificate-card__divider {
    display: none;
  }

  .certificate-card__rings {
    top: 50%;
    width: 70cqw;
    height: 70cqw;
  }
}

.certificate-card--celebrating {
  animation: certificate-card-pop 900ms ease-out;
}

@keyframes certificate-card-pop {
  0% {
    scale: 1;
  }

  35% {
    scale: 1.02;
  }

  100% {
    scale: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .certificate-card--celebrating,
  .certificate-card__sheen--celebrating,
  .certificate-card__celebration-spark {
    animation: none;
  }
}

.certificate-card__sheen--celebrating {
  animation: certificate-sheen-sweep 1.7s ease-in-out;
}

@keyframes certificate-sheen-sweep {
  0% {
    background-position: 175% 0%;
  }

  100% {
    background-position: -75% 0%;
  }
}

.certificate-card__celebration-spark {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: currentColor;
  box-shadow: 0 0 12px currentColor;
  opacity: 0;
  animation: certificate-spark-burst 1.5s ease-out forwards;
}

@keyframes certificate-spark-burst {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.4);
  }

  18% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translate(var(--spark-dx), var(--spark-dy)) scale(1);
  }
}

.certificate-card__reflection {
  width: 72%;
  height: clamp(20px, 6cqw, 64px);
  margin: clamp(-14px, -2.4cqw, -28px) auto 0;
  border-radius: 9999px;
  background: radial-gradient(50% 100% at 50% 0%, var(--certificate-edge-glow, rgba(124, 92, 255, 0.5)) 0%, rgba(0, 0, 0, 0) 75%);
  filter: blur(14px);
  opacity: 0.8;
}
</style>
