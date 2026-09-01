import { View } from 'react-native'
import { Input } from '../../atoms/Input'
import type { SearchBarProps } from './SearchBar.types'

export function SearchBar({ value, onChange, placeholder = 'Buscar…', testID }: SearchBarProps) {
  return (
    <View>
      <Input value={value} onChange={onChange} placeholder={placeholder} type="search" testID={testID} />
    </View>
  )
}
