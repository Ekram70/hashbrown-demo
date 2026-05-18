import { Component, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecipeService } from './recipe.service';

@Component({
  selector: 'app-recipe-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="widget-card recipe-widget-card">
      <div class="widget-header">
        <div class="widget-badge">🍽️ INTERACTIVE RECIPE</div>
        <h3 class="widget-title">{{ title() }}</h3>
        <div class="widget-meta">
          <span>Prep: <strong>{{ prepTime() }}</strong></span>
          <span class="meta-dot">•</span>
          <span>Cook: <strong>{{ cookTime() }}</strong></span>
          <span class="meta-dot">•</span>
          <span>Servings: <strong>{{ servings() }}</strong></span>
        </div>
      </div>

      <div class="widget-body">
        <div class="ingredients-section">
          <h4 class="body-subtitle">Ingredients Checklist</h4>
          <div class="ingredients-grid">
            @for (ing of ingredients(); track ing) {
              <label class="ingredient-checkbox">
                <input 
                  type="checkbox" 
                  [checked]="recipeService.isIngredientChecked(ing)"
                  (change)="recipeService.toggleIngredient(ing)">
                <span class="checkmark"></span>
                <span class="ing-label">{{ ing }}</span>
              </label>
            }
          </div>
        </div>

        <div class="steps-section">
          <h4 class="body-subtitle">Step-by-Step Directions</h4>
          <ol class="steps-list">
            @for (step of steps(); track step; let idx = $index) {
              <li class="step-item" [class.completed]="recipeService.isStepCompleted(idx)">
                <span class="step-num" (click)="recipeService.toggleStep(idx)">{{ idx + 1 }}</span>
                <p class="step-text">{{ step }}</p>
              </li>
            }
          </ol>
        </div>
      </div>
    </div>
  `
})
export class RecipeCardComponent {
  protected readonly recipeService = inject(RecipeService);

  title = input<string>('');
  prepTime = input<string>('');
  cookTime = input<string>('');
  servings = input<number>(1);
  ingredients = input<string[]>([]);
  steps = input<string[]>([]);
}
