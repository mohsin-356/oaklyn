import PosCategory from './PosCategory.jsx'
import { StorageKeys } from '../utils/storage.js'

export default function Drinks() {
  return <PosCategory storageKey={StorageKeys.drinks} title="Drinks" />
}
