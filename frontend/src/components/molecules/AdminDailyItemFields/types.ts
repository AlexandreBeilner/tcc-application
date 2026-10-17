import type { ItemCommon } from '../../../features/admin/dailyAdmin'

export interface AdminDailyItemFieldsProps {
    value: ItemCommon
    onChange: (value: ItemCommon) => void
    disabled?: boolean
}
