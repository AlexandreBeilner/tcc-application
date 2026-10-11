import { Link } from 'react-router-dom'
import { BrandLogo } from '../../atoms/BrandLogo'
import { FriendsBell } from '../../molecules/FriendsBell'
import { MarketClockChip } from '../../molecules/MarketClockChip'
import { NewsBell } from '../../molecules/NewsBell'
import { AvatarMenu } from '../AvatarMenu'
import { MARKET_CALENDAR_PANEL_ID } from '../MarketCalendarPanel'
import styles from './index.module.css'

// Barra superior persistente (inventário 0.2): logo, ícone de amigos com
// badge (`FriendsBell`, 6.9.4), ícone de notícias com badge, avatar com
// menu suspenso. "Amigos" continua também no `AvatarMenu` — o pedido do
// autor foi "não só" dentro do menu, não a remoção do item de lá.
// Chip do relógio do mercado (S.12) entre o logo e as ações: único ponto de
// abertura do Calendário (`calendarOpen` vive no `AppShell`).
interface TopBarProps {
    calendarOpen: boolean
    onToggleCalendar: () => void
}

export function TopBar({ calendarOpen, onToggleCalendar }: TopBarProps) {
    return (
        <header className={styles.topBar}>
            <Link to="/" className={styles.logo}>
                <BrandLogo className={styles.logoImage} />
            </Link>
            <MarketClockChip open={calendarOpen} onToggle={onToggleCalendar} panelId={MARKET_CALENDAR_PANEL_ID} />
            <div className={styles.actions}>
                <FriendsBell />
                <NewsBell />
                <AvatarMenu />
            </div>
        </header>
    )
}
