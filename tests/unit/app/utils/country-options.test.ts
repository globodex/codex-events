import { describe, expect, test } from 'vitest'

import { getCountryOptions } from '../../../../app/utils/country-options'

describe('getCountryOptions', () => {
  test('includes common country names while filtering aggregate regions', () => {
    const options = getCountryOptions()

    expect(options).toEqual(expect.arrayContaining([
      { label: 'Austria', value: 'Austria' },
      { label: 'United Kingdom', value: 'United Kingdom' },
      { label: 'United States', value: 'United States' }
    ]))
    expect(options.some(option => option.value === 'European Union')).toBe(false)
    expect(options.some(option => option.value === 'Unknown Region')).toBe(false)
  })
})
