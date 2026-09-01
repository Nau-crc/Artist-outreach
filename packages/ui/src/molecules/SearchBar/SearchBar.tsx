import { Input } from '../../atoms/Input'
import type { SearchBarProps } from './SearchBar.types'

export function SearchBar({ value, onChange, placeholder = 'Buscar…', testID }: SearchBarProps) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted select-none"
      >
        ⌕
      </span>
      <div className="pl-6">
        <Input value={value} onChange={onChange} placeholder={placeholder} type="search" testID={testID} />
      </div>
    </div>
  )
}
