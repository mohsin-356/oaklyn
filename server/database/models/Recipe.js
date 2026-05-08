import mongoose from 'mongoose'

const recipeIngredientSchema = new mongoose.Schema({
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
  ingredientName:  { type: String, required: true },
  quantity:        { type: Number, required: true },
  unit:            { type: String, required: true },
})

const recipeSchema = new mongoose.Schema({
  menuItemId:   { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  menuItemName: { type: String, required: true },
  ingredients:  [recipeIngredientSchema],
}, { timestamps: true })

recipeSchema.index({ menuItemId: 1 })

export default mongoose.model('Recipe', recipeSchema)
