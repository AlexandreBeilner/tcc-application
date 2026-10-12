export interface EmailCategoryOptionProps {
    title: string
    description: string
    checked: boolean
    disabled?: boolean
    onChange: (checked: boolean) => void
}
