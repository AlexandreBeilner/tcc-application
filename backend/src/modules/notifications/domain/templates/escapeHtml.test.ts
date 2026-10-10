import { describe, expect, it } from 'vitest'
import { escapeHtml } from './escapeHtml'

describe('escapeHtml', () => {
  it('escapa os cinco caracteres perigosos', () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;',
    )
  })

  it('não mexe em texto comum com acento', () => {
    expect(escapeHtml('Olá, João! Renda fixa: 12,5%')).toBe('Olá, João! Renda fixa: 12,5%')
  })
})
