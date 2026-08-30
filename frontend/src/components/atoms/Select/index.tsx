import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { SelectProps } from './types'
import styles from './index.module.css'

export type { SelectProps, SelectOption } from './types'

// Dropdown 100% próprio (não `<select>` nativo) — a lista de opções de um
// `<select>` é renderizada pelo SO/navegador e não aceita CSS do tema
// (constatado ao vivo: mesmo com o controle fechado estilizado, a lista
// aberta continuava com a aparência default do navegador). `role="listbox"`
// + navegação por teclado (setas/Home/End/Enter/Esc) reproduzem o
// comportamento nativo o suficiente pra não perder acessibilidade.
export function Select({ value, onChange, options, id, ...rest }: SelectProps) {
    const [open, setOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(0)
    const rootRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const listRef = useRef<HTMLUListElement>(null)

    const selectedIndex = Math.max(
        0,
        options.findIndex((option) => option.value === value),
    )
    const selectedOption = options[selectedIndex]

    useEffect(() => {
        if (!open) return

        function handlePointerDown(event: PointerEvent) {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener('pointerdown', handlePointerDown)
        return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [open])

    useEffect(() => {
        if (open) {
            setHighlightedIndex(selectedIndex)
            listRef.current?.focus()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    function selectOption(index: number) {
        onChange(options[index].value)
        setOpen(false)
        triggerRef.current?.focus()
    }

    function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
            event.preventDefault()
            setOpen(true)
        }
    }

    function handleListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault()
                setHighlightedIndex((index) => Math.min(options.length - 1, index + 1))
                break
            case 'ArrowUp':
                event.preventDefault()
                setHighlightedIndex((index) => Math.max(0, index - 1))
                break
            case 'Home':
                event.preventDefault()
                setHighlightedIndex(0)
                break
            case 'End':
                event.preventDefault()
                setHighlightedIndex(options.length - 1)
                break
            case 'Enter':
            case ' ':
                event.preventDefault()
                selectOption(highlightedIndex)
                break
            case 'Escape':
                event.preventDefault()
                setOpen(false)
                triggerRef.current?.focus()
                break
            case 'Tab':
                setOpen(false)
                break
        }
    }

    return (
        <div className={styles.wrapper} ref={rootRef}>
            <button
                type="button"
                id={id}
                ref={triggerRef}
                className={styles.trigger}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={rest['aria-label']}
                onClick={() => setOpen((isOpen) => !isOpen)}
                onKeyDown={handleTriggerKeyDown}
            >
                <span>{selectedOption?.label ?? ''}</span>
                <ChevronDown className={styles.chevron} size={16} strokeWidth={2} aria-hidden="true" />
            </button>

            {open && (
                <ul className={styles.listbox} role="listbox" tabIndex={-1} ref={listRef} onKeyDown={handleListKeyDown}>
                    {options.map((option, index) => (
                        <li
                            key={option.value}
                            role="option"
                            aria-selected={option.value === value}
                            className={[styles.option, index === highlightedIndex && styles.optionHighlighted].filter(Boolean).join(' ')}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            onClick={() => selectOption(index)}
                        >
                            <span>{option.label}</span>
                            {option.value === value && <Check className={styles.checkIcon} size={16} strokeWidth={2.5} />}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
