import PosCategory from './PosCategory.jsx'
import { StorageKeys } from '../utils/storage.js'

export default function Extras() {
  return <PosCategory storageKey={StorageKeys.extras} title="Extras" />
}
