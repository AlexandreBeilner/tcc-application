export interface SelectOption {
    value: string
    label: string
}

export interface SelectProps {
    value: string
    onChange: (value: string) => void
    options: SelectOption[]
    'aria-label'?: string
    id?: string
}
