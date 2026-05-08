import PosCategory from './PosCategory.jsx'
import { StorageKeys } from '../utils/storage.js'

export default function Food(){
  return <PosCategory storageKey={StorageKeys.foods} title="Food" />
}
