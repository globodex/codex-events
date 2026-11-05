import { Resvg, initWasm as initResvgWasm } from '@resvg/resvg-wasm'
import qrcode from 'qrcode-generator'
import satori, { init as initSatori } from 'satori/standalone'

import { loadCertificateBadge } from '#server/domains/events/certificate-badge'
import { loadCertificateFonts } from '#server/domains/events/certificate-fonts'
import { resvgWasmModule, layoutWasmModule } from '#server/domains/events/certificate-wasm.mjs'
import type {
  EventCertificate,
  EventCertificateEventType
} from '#shared/domains/events/certificates'
import {
  eventCertificateTypeLabels,
  formatEventCertificatePlacement,
  resolveEventCertificatePlacementTier
} from '#shared/domains/events/certificates'

export const certificateImageWidth = 1200
export const certificateImageHeight = 630

interface CertificatePalette {
  backgroundFrom: string
  backgroundVia: string
  backgroundTo: string
  glowLeft: string
  glowRight: string
  accent: string
  frame: string
  dot: string
}

const certificatePalettes: Record<EventCertificateEventType, CertificatePalette> = {
  build: {
    backgroundFrom: '#0a1186',
    backgroundVia: '#2f33d8',
    backgroundTo: '#7a5cf0',
    glowLeft: 'rgba(48, 92, 255, 0.55)',
    glowRight: 'rgba(151, 120, 255, 0.5)',
    accent: '#cfd6ff',
    frame: 'rgba(196, 208, 255, 0.65)',
    dot: 'rgba(150, 190, 255, 0.55)'
  },
  hackathon: {
    backgroundFrom: '#560a9b',
    backgroundVia: '#a519c2',
    backgroundTo: '#ea4581',
    glowLeft: 'rgba(190, 70, 255, 0.55)',
    glowRight: 'rgba(255, 92, 150, 0.55)',
    accent: '#ffd9ee',
    frame: 'rgba(255, 214, 240, 0.6)',
    dot: 'rgba(255, 160, 210, 0.55)'
  },
  meetup: {
    backgroundFrom: '#013f70',
    backgroundVia: '#0782c3',
    backgroundTo: '#2cd4c4',
    glowLeft: 'rgba(36, 158, 255, 0.55)',
    glowRight: 'rgba(80, 240, 220, 0.5)',
    accent: '#c9f5f2',
    frame: 'rgba(188, 242, 248, 0.6)',
    dot: 'rgba(140, 235, 230, 0.55)'
  }
}

interface CertificateImageNode {
  type: 'div' | 'img'
  props: {
    style: Record<string, string | number>
    src?: string
    width?: number
    height?: number
    children?: CertificateImageNode[] | string
  }
}

function box(style: Record<string, string | number>, children?: CertificateImageNode[] | string): CertificateImageNode {
  return {
    type: 'div',
    props: {
      style: { display: 'flex', boxSizing: 'border-box', ...style },
      children
    }
  }
}

function toBase64(data: ArrayBuffer) {
  const bytes = new Uint8Array(data)
  let binary = ''

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }

  return btoa(binary)
}

function ringLayer(centerX: number, centerY: number, radius: number, opacity: number) {
  return box({
    position: 'absolute',
    left: centerX - radius,
    top: centerY - radius,
    width: radius * 2,
    height: radius * 2,
    borderRadius: 9999,
    border: `1px solid rgba(255, 255, 255, ${opacity})`
  })
}

function buildVerificationQrCodeDataUrl(verifyUrl: string) {
  const qr = qrcode(0, 'M')
  qr.addData(verifyUrl)
  qr.make()

  const moduleCount = qr.getModuleCount()
  let modulePath = ''

  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (qr.isDark(row, column)) {
        modulePath += `M${column} ${row}h1v1h-1z`
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${moduleCount}" height="${moduleCount}" viewBox="0 0 ${moduleCount} ${moduleCount}" shape-rendering="crispEdges"><path d="${modulePath}" fill="#0a0d14"/></svg>`

  return `data:image/svg+xml;base64,${btoa(svg)}`
}

function verificationQrCodeTile(verifyUrl: string, size: number): CertificateImageNode {
  const quietZone = 10
  const codeSize = size - quietZone * 2

  return box({
    marginLeft: 'auto',
    flexShrink: 0,
    padding: quietZone,
    backgroundColor: '#ffffff',
    borderRadius: 14
  }, [
    {
      type: 'img',
      props: {
        src: buildVerificationQrCodeDataUrl(verifyUrl),
        width: codeSize,
        height: codeSize,
        style: { width: codeSize, height: codeSize }
      }
    }
  ])
}

let rendererReadyPromise: Promise<void> | null = null

function ensureCertificateRendererReady() {
  rendererReadyPromise ??= (async () => {
    await initSatori(layoutWasmModule)
    await initResvgWasm(resvgWasmModule)
  })()

  return rendererReadyPromise
}

function clampLine(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value
}

function resolveNameFontSize(name: string) {
  if (name.length <= 14) {
    return 92
  }

  if (name.length <= 22) {
    return 72
  }

  if (name.length <= 32) {
    return 56
  }

  return 44
}

function dotsLayer(style: Record<string, string | number>, dotColor: string) {
  return box({
    position: 'absolute',
    backgroundImage: `radial-gradient(circle at 4px 4px, ${dotColor} 2.4px, rgba(0, 0, 0, 0) 2.6px)`,
    backgroundSize: '18px 18px',
    ...style
  })
}

function footerCell(label: string, value: string, accent: string, withDivider: boolean) {
  return box({
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    gap: 7,
    paddingRight: 44,
    marginRight: 44,
    ...(withDivider
      ? {
          borderRight: '1px solid rgba(255, 255, 255, 0.28)'
        }
      : {})
  }, [
    box({ fontSize: 15, fontWeight: 600, letterSpacing: 4, color: 'rgba(255, 255, 255, 0.62)' }, label),
    box({ fontSize: 22, fontWeight: 600, color: accent }, value)
  ])
}

const placementPillStyles = {
  gold: {
    color: '#ffe9a8',
    border: '1.5px solid rgba(255, 214, 110, 0.8)',
    backgroundColor: 'rgba(120, 84, 12, 0.45)'
  },
  silver: {
    color: '#eef2f8',
    border: '1.5px solid rgba(226, 232, 240, 0.75)',
    backgroundColor: 'rgba(82, 92, 108, 0.45)'
  },
  bronze: {
    color: '#ffd9b8',
    border: '1.5px solid rgba(228, 168, 112, 0.75)',
    backgroundColor: 'rgba(112, 62, 20, 0.5)'
  }
} as const

function buildCertificateImageTree(certificate: EventCertificate, verifyUrl: string, badgeDataUrl: string) {
  const palette = certificatePalettes[certificate.eventType]
  const placementTier = certificate.placement ? resolveEventCertificatePlacementTier(certificate.placement) : null
  const participantName = clampLine(certificate.participantName, 42).toUpperCase()
  const eventName = clampLine(certificate.eventName, 44).toUpperCase()

  return box({
    width: certificateImageWidth,
    height: certificateImageHeight,
    backgroundColor: '#06070d',
    backgroundImage: `linear-gradient(112deg, ${palette.backgroundFrom} 0%, ${palette.backgroundVia} 48%, ${palette.backgroundTo} 100%)`,
    fontFamily: 'Inter',
    color: '#ffffff'
  }, [
    box({
      position: 'absolute',
      top: -260,
      left: -200,
      width: 560,
      height: 560,
      borderRadius: 9999,
      backgroundImage: `radial-gradient(circle at center, ${palette.glowLeft} 0%, rgba(0, 0, 0, 0) 65%)`
    }),
    box({
      position: 'absolute',
      bottom: -300,
      right: -200,
      width: 600,
      height: 600,
      borderRadius: 9999,
      backgroundImage: `radial-gradient(circle at center, ${palette.glowRight} 0%, rgba(0, 0, 0, 0) 66%)`
    }),
    box({
      position: 'absolute',
      top: -340,
      left: 250,
      width: 230,
      height: 1300,
      backgroundImage: 'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.22) 50%, rgba(255, 255, 255, 0) 100%)',
      transform: 'rotate(36deg)'
    }),
    dotsLayer({ top: 44, left: 44, width: 270, height: 180, opacity: 0.85 }, palette.dot),
    dotsLayer({ bottom: 44, right: 44, width: 300, height: 200, opacity: 0.7 }, palette.dot),
    ringLayer(certificateImageWidth / 2, 270, 159, 0.07),
    ringLayer(certificateImageWidth / 2, 270, 222, 0.05),
    {
      type: 'img',
      props: {
        src: badgeDataUrl,
        width: 108,
        height: 108,
        style: {
          position: 'absolute',
          top: 96,
          left: 142,
          width: 108,
          height: 108,
          opacity: 0.95
        }
      }
    } satisfies CertificateImageNode,
    box({
      position: 'absolute',
      top: 22,
      left: 22,
      width: certificateImageWidth - 44,
      height: certificateImageHeight - 44,
      border: `2px solid ${palette.frame}`,
      borderRadius: 30
    }),
    box({
      flexDirection: 'column',
      width: certificateImageWidth,
      height: certificateImageHeight,
      padding: '58px 76px'
    }, [
      box({ alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
        box({ fontSize: 21, fontWeight: 600, letterSpacing: 7 }, 'CODEX EVENTS'),
        box({
          border: `1.5px solid ${palette.frame}`,
          borderRadius: 9999,
          padding: '8px 24px',
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: 5,
          color: palette.accent
        }, eventCertificateTypeLabels[certificate.eventType].toUpperCase())
      ]),
      box({
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 'auto',
        marginBottom: 'auto',
        width: '100%'
      }, [
        ...(certificate.placement && placementTier
          ? [box({
              marginBottom: 20,
              borderRadius: 9999,
              padding: '8px 26px',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 5,
              ...placementPillStyles[placementTier]
            }, formatEventCertificatePlacement(certificate.placement).toUpperCase())]
          : []),
        box({ fontSize: 19, fontWeight: 600, letterSpacing: 8, color: 'rgba(255, 255, 255, 0.85)' }, 'CERTIFICATE OF PARTICIPATION'),
        box({
          marginTop: 22,
          fontSize: resolveNameFontSize(participantName),
          fontWeight: 600,
          letterSpacing: 3,
          textAlign: 'center',
          backgroundImage: 'linear-gradient(180deg, #ffffff 18%, #dfe6ff 55%, #b9c4ff 100%)',
          backgroundClip: 'text',
          color: 'transparent'
        }, participantName),
        box({
          marginTop: 26,
          border: '1.5px solid rgba(255, 255, 255, 0.55)',
          borderRadius: 9999,
          padding: '11px 34px',
          fontSize: 19,
          fontWeight: 600,
          letterSpacing: 6,
          color: 'rgba(255, 255, 255, 0.92)'
        }, eventName)
      ]),
      box({ alignItems: 'flex-end', width: '100%' }, [
        footerCell('EVENT DATE', certificate.eventDateLabel, '#ffffff', true),
        ...(certificate.trackName
          ? [footerCell('TRACK', clampLine(certificate.trackName, 20), '#ffffff', true)]
          : []),
        footerCell('CERTIFICATE ID', certificate.certificateId, palette.accent, false),
        verificationQrCodeTile(verifyUrl, 104)
      ])
    ])
  ])
}

export async function renderEventCertificatePng(certificate: EventCertificate, verifyUrl: string) {
  await ensureCertificateRendererReady()
  const [fonts, badgeBytes] = await Promise.all([loadCertificateFonts(), loadCertificateBadge()])
  const badgeDataUrl = `data:image/png;base64,${toBase64(badgeBytes)}`

  const svg = await satori(buildCertificateImageTree(certificate, verifyUrl, badgeDataUrl), {
    width: certificateImageWidth,
    height: certificateImageHeight,
    fonts: [
      { name: 'Inter', data: fonts.regular, weight: 400, style: 'normal' },
      { name: 'Inter', data: fonts.semiBold, weight: 600, style: 'normal' }
    ]
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'original' }
  })

  return resvg.render().asPng()
}
