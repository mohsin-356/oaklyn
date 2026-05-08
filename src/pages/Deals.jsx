import PosCategory from './PosCategory.jsx'
import { StorageKeys } from '../utils/storage.js'

export default function Deals() {
  return <PosCategory storageKey={StorageKeys.deals} title="Deals" />
}
