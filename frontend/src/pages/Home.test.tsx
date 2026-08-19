import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Home } from './Home'

describe('Home', () => {
  it('renderiza sem erro', () => {
    const { container } = render(<Home />)
    expect(container).toBeTruthy()
  })
})
