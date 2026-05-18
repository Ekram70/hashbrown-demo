import { Injectable, signal, effect } from '@angular/core';

function getSavedCheckedState(): Record<string, boolean> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('hb_recipe_checked');
      return saved ? JSON.parse(saved) : {};
    }
  } catch (e) {
    console.warn('Failed to read recipe checked state from localStorage:', e);
  }
  return {};
}

function getSavedStepsState(): Record<number, boolean> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('hb_recipe_steps');
      return saved ? JSON.parse(saved) : {};
    }
  } catch (e) {
    console.warn('Failed to read recipe steps state from localStorage:', e);
  }
  return {};
}

@Injectable({
  providedIn: 'root'
})
export class RecipeService {
  // Store checked state of ingredients: ingredientName (lowercase) -> checked
  private readonly checkedState = signal<Record<string, boolean>>(getSavedCheckedState());
  
  // Store completed steps: stepIndex -> completed
  private readonly stepsState = signal<Record<number, boolean>>(getSavedStepsState());

  constructor() {
    // Automatically persist changes to localStorage using reactive effects!
    effect(() => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('hb_recipe_checked', JSON.stringify(this.checkedState()));
        }
      } catch (e) {
        console.warn('Failed to save recipe checked state to localStorage:', e);
      }
    });

    effect(() => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('hb_recipe_steps', JSON.stringify(this.stepsState()));
        }
      } catch (e) {
        console.warn('Failed to save recipe steps state to localStorage:', e);
      }
    });
  }

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
