import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RecipeService {
  // Store checked state of ingredients: ingredientName (lowercase) -> checked
  private readonly checkedState = signal<Record<string, boolean>>({});
  
  // Store completed steps: stepIndex -> completed
  private readonly stepsState = signal<Record<number, boolean>>({});

  isIngredientChecked(name: string): boolean {
    const key = name.toLowerCase().trim();
    // Allow partial matching for convenience (e.g. "potatoes" matches "3 medium Russet potatoes")
    const state = this.checkedState();
    if (state[key] !== undefined) return state[key];
    
    // Check if key is a substring of any checked ingredient
    for (const [ingName, isChecked] of Object.entries(state)) {
      if (ingName.includes(key) || key.includes(ingName)) {
        return isChecked;
      }
    }
    return false;
  }

  toggleIngredient(name: string, forceState?: boolean) {
    const key = name.toLowerCase().trim();
    const current = this.checkedState();
    
    // Find matching key for partial matching toggle
    let targetKey = key;
    for (const ingName of Object.keys(current)) {
      if (ingName.includes(key) || key.includes(ingName)) {
        targetKey = ingName;
        break;
      }
    }

    const target = forceState !== undefined ? forceState : !current[targetKey];
    this.checkedState.set({
      ...current,
      [targetKey]: target
    });
  }

  isStepCompleted(idx: number): boolean {
    return !!this.stepsState()[idx];
  }

  toggleStep(idx: number, forceState?: boolean) {
    const current = this.stepsState();
    const target = forceState !== undefined ? forceState : !current[idx];
    this.stepsState.set({
      ...current,
      [idx]: target
    });
  }

  clear() {
    this.checkedState.set({});
    this.stepsState.set({});
  }
}
