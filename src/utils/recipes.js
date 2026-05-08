// Recipes storage utilities — MongoDB-backed via db service

import { recipes } from '../services/db.js'

// Shape: { [itemId: string]: Array<{ name: string, unit?: string, qty: number }> }

export async function listAllRecipes(){
  try {
    const docs = await recipes.getAll()
    const map = {}
    for (const doc of docs) {
      const key = doc.menuItemId || doc._id || ''
      map[key] = (doc.ingredients || []).map(ing => ({
        name: ing.ingredientName || ing.name || '',
        unit: ing.unit || '',
        qty: ing.quantity ?? ing.qty ?? 0,
      }))
    }
    return map
  } catch {
    return {}
  }
}

export async function getRecipe(itemId){
  try {
    const all = await listAllRecipes()
    return all[itemId] || []
  } catch {
    return []
  }
}

export async function setRecipe(itemId, ingredients){
  try {
    const normalized = (ingredients||[]).map((ing)=>({
      ingredientName: (ing.name||'').trim(),
      unit: (ing.unit||'').trim(),
      quantity: Number.isFinite(ing.qty) ? ing.qty : parseFloat(ing.qty||0) || 0,
    }))
    // Try to find existing recipe by menuItemId
    const existing = await recipes.getAll({ menuItemId: itemId })
    if (existing && existing.length > 0) {
      await recipes.update(existing[0]._id, { ingredients: normalized })
    } else {
      await recipes.create({ menuItemId: itemId, menuItemName: itemId, ingredients: normalized })
    }
    return ingredients
  } catch {
    return ingredients
  }
}

export async function deleteRecipe(itemId){
  try {
    const existing = await recipes.getAll({ menuItemId: itemId })
    if (existing && existing.length > 0) {
      await recipes.delete(existing[0]._id)
    }
  } catch {}
}

// Replace all recipes at once (expects an object mapping itemId -> array of ingredients)
export async function setAllRecipes(obj){
  try {
    // Delete all existing recipes
    const existing = await recipes.getAll()
    for (const doc of existing) {
      await recipes.delete(doc._id)
    }
    // Create new ones
    const normalized = {}
    if (obj && typeof obj === 'object') {
      for (const [itemId, arr] of Object.entries(obj)) {
        if (!Array.isArray(arr)) continue
        normalized[itemId] = arr.map((ing)=>({
          name: (ing?.name||'').trim(),
          unit: (ing?.unit||'').trim(),
          qty: Number.isFinite(ing?.qty) ? ing.qty : parseFloat(ing?.qty||0) || 0,
        })).filter(r => r.name)
        const ingredients = normalized[itemId].map(ing => ({
          ingredientName: ing.name,
          unit: ing.unit,
          quantity: ing.qty,
        }))
        await recipes.create({ menuItemId: itemId, menuItemName: itemId, ingredients })
      }
    }
    return normalized
  } catch {
    return {}
  }
}

// Export recipes as a JSON string
export async function exportRecipes(){
  const all = await listAllRecipes()
  return JSON.stringify(all, null, 2)
}

// Import recipes from a JSON string; returns boolean success
export async function importRecipes(json){
  try {
    const obj = JSON.parse(json)
    if (!obj || typeof obj !== 'object') return false
    await setAllRecipes(obj)
    return true
  } catch {
    return false
  }
}
