import { describe, expect, test } from 'vitest'

import { lumaGuestListCsvLimits, parseLumaGuestListCsv } from '../../../../../server/domains/applications/luma-guest-list'

// The columns of a real Luma guest export, in its order. Most of them must be ignored.
const header = '﻿guest_id,name,first_name,last_name,email,phone_number,created_at,approval_status,checked_in_at,What is your LinkedIn profile?'

describe('TASK-499 uploaded Luma guest CSV', () => {
  test('keeps only the normalized email and approval status of each guest, one guest per email', () => {
    const guests = parseLumaGuestListCsv([
      header,
      'gst-1,"Lovelace, Ada",Ada,Lovelace, Ada@Example.com ,+431234,2026-11-20,approved,,"https://linkedin.com/in/ada, the first"',
      'gst-2,Grace Hopper,Grace,Hopper,grace@example.com,,2026-11-21,Pending Approval,,',
      'gst-3,Alan Turing,Alan,Turing,alan@example.com,,2026-11-22,declined,,',
      'gst-4,Ada Again,Ada,Again,ada@example.com,,2026-11-23,declined,,',
      'gst-5,No Status,No,Status,nostatus@example.com,,2026-11-24,,,'
    ].join('\n'))

    expect(guests).toEqual([
      { email: 'ada@example.com', approvalStatus: 'declined' },
      { email: 'grace@example.com', approvalStatus: 'pending_approval' },
      { email: 'alan@example.com', approvalStatus: 'declined' },
      { email: 'nostatus@example.com', approvalStatus: '' }
    ])
  })

  test('refuses a file without the email or approval_status column', () => {
    for (const columns of ['guest_id,email,first_name', 'guest_id,approval_status,first_name']) {
      expect(() => parseLumaGuestListCsv(`${columns}\ngst-1,approved,Ada`))
        .toThrow('The Luma CSV must include the email and approval_status columns.')
    }
  })

  test('refuses the whole file when one guest has no valid email', () => {
    expect(() => parseLumaGuestListCsv([
      'email,approval_status',
      'ada@example.com,approved',
      'not-an-email,approved'
    ].join('\n'))).toThrow('Every guest in the Luma CSV needs a valid email address.')
  })

  test('refuses a file that is not a CSV or has more guests than allowed', () => {
    expect(() => parseLumaGuestListCsv('email,approval_status\n"ada@example.com,approved'))
      .toThrow('The uploaded file is not a valid Luma CSV.')

    const rows = Array.from({ length: lumaGuestListCsvLimits.maxGuests + 1 }, (_, index) => `guest${index}@example.com,approved`)
    expect(() => parseLumaGuestListCsv(['email,approval_status', ...rows].join('\n')))
      .toThrow('The Luma CSV can contain at most 10,000 guests.')
  })
})
