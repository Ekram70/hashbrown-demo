import { Component, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { uiChatResource, exposeComponent, RenderMessageComponent, createTool } from '@hashbrownai/angular';
import { s } from '@hashbrownai/core';

// Sibling Standalone Components & Services
import { MarkdownComponent } from './markdown';
import { RecipeCardComponent } from './recipe-card';
import { SystemDashboardComponent } from './system-dashboard';
import { RecipeService } from './recipe.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RenderMessageComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  // Inject global reactive recipe state
  protected readonly recipeService = inject(RecipeService);

  // Selected LLM Provider setting (specifically set to 'gemini' as required)
  protected readonly selectedModel = signal<'gemini' | 'openai'>('gemini');

  // Input textbox state
  protected readonly userInput = signal('');

  // Aesthetic suggestions to help users discover features
  protected readonly suggestions = [
    { label: '✨ Crispy Hashbrown Recipe', text: 'Give me a hashbrown recipe' },
    { label: '📊 Express Server Dashboard', text: 'Show server status' },
    { label: '💡 What is GenUI?', text: 'Explain what Generative UI is' }
  ];

  // Instantiates client-side agent tools inside the active injection context of the component!
  private readonly toggleIngredientTool = createTool({
    name: 'toggleRecipeIngredient',
    description: 'Mark an ingredient as checked/completed or unchecked in the active recipe card checklist.',
    schema: s.object('Toggle ingredient input', {
      ingredientName: s.string('The exact or partial name of the ingredient to toggle'),
      checked: s.boolean('True to mark it as checked, false to mark it as unchecked')
    }),
    handler: (input) => {
      this.recipeService.toggleIngredient(input.ingredientName, input.checked);
      return Promise.resolve({ 
        success: true, 
        message: `Successfully set ingredient "${input.ingredientName}" checked to ${input.checked}` 
      });
    }
  });

  private readonly setRecipeStepCompletedTool = createTool({
    name: 'setRecipeStepCompleted',
    description: 'Mark a specific step of the cooking instructions as completed or pending.',
    schema: s.object('Set step status input', {
      stepNumber: s.number('The 1-based step number to update (e.g. 1 for step 1)'),
      completed: s.boolean('True to mark it completed, false to mark it pending')
    }),
    handler: (input) => {
      const zeroBasedIdx = input.stepNumber - 1;
      this.recipeService.toggleStep(zeroBasedIdx, input.completed);
      return Promise.resolve({ 
        success: true, 
        message: `Successfully set step ${input.stepNumber} completion status to ${input.completed}` 
      });
    }
  });

  // Instantiates the Hashbrown UI chat completion manager with native exposed components
  protected readonly chat = uiChatResource({
    model: 'gemini',
    debugName: 'ui-chat',
    system: `
      ### ROLE & TONE
      You are **Hashbrown AI**, an advanced generative assistant helping developers build reactive GenUI.
      Your tone is clear, helpful, respectful, and highly technical yet accessible.

      ### RULES
      1. Never expose raw code details or internal database keys.
      2. For commands you cannot perform, admit it and suggest an alternative.
      3. **Always** wrap ALL general assistant text, explanations, lists, or paragraphs in an <app-markdown data="..." /> tag.
      4. For actionable user requests:
         - When asked for a recipe or food directions, **precede** your text explanation with the appropriate recipe card component call:
           <app-recipe-card title="..." prepTime="..." cookTime="..." servings="..." [ingredients]="..." [steps]="..." />
         - When asked for backend status, server status, health checks, or metrics dashboard, **precede** your explanation with the appropriate system dashboard component call:
           <app-system-dashboard serverStatus="..." cpuUsage="..." memoryUsage="..." uptime="..." activeConnections="..." [endpoints]="..." />
      5. Nest all custom component tags inside a single <ui>...</ui> tag block in your assistant messages.

      ### EXAMPLES

      <user>Hello</user>
      <assistant>
        <ui>
          <app-markdown data="Hello! I am Hashbrown AI. How may I assist you with building reactive Generative UI today?" />
        </ui>
      </assistant>

      <user>Give me a hashbrown recipe</user>
      <assistant>
        <ui>
          <app-markdown data="Certainly! Here is a premium interactive recipe card to cook perfect, crispy golden-brown hashbrowns:" />
          <app-recipe-card 
            title="Ultimate Crispy Hashbrowns" 
            prepTime="10 mins" 
            cookTime="15 mins" 
            [servings]="2"
            [ingredients]='["3 medium Russet potatoes", "2 tbsp unsalted butter, melted", "1 tbsp vegetable oil", "1/2 tsp garlic powder", "Salt and black pepper to taste"]'
            [steps]='["Shred potatoes using a box grater into a bowl of cold water. Rinse until water is clear.", "Squeeze out all moisture completely using a clean kitchen towel. This is crucial for crispiness!", "In a bowl, toss the shredded potatoes with melted butter, garlic powder, salt, and pepper.", "Heat vegetable oil in a large skillet over medium-high heat. Spread potatoes evenly.", "Cook for 6-8 minutes until golden brown, then flip and cook the other side for another 5-6 minutes.", "Serve piping hot with your favorite toppings!"]'
          />
        </ui>
      </assistant>
    `,
    components: [
      exposeComponent(MarkdownComponent, {
        description: 'Show descriptive text, paragraphs, lists, and markdown formatting to the user.',
        input: {
          data: s.streaming.string('The markdown text content.')
        }
      }),
      exposeComponent(RecipeCardComponent, {
        description: 'Show a highly interactive recipe card with checklist boxes for ingredients and step-by-step directions.',
        input: {
          title: s.streaming.string('The name of the recipe'),
          prepTime: s.string('Preparation time required'),
          cookTime: s.string('Cooking time required'),
          servings: s.number('Number of servings'),
          ingredients: s.array('List of ingredient strings', s.string('Ingredient item')),
          steps: s.array('Step-by-step cooking directions', s.string('Cooking step'))
        }
      }),
      exposeComponent(SystemDashboardComponent, {
        description: 'Show a real-time system performance and backend service metrics dashboard.',
        input: {
          serverStatus: s.string('Backend service status (e.g. HEALTHY)'),
          cpuUsage: s.number('CPU allocation percentage'),
          memoryUsage: s.string('Memory usage string (e.g., 128MB / 512MB)'),
          uptime: s.string('Active server uptime duration'),
          activeConnections: s.number('Active ws or http connections'),
          endpoints: s.array(
            'Monitored route latencies list',
            s.object('Endpoint metric', {
              path: s.string('Route path'),
              method: s.string('HTTP method (e.g. POST, GET)'),
              latency: s.string('Request response latency')
            })
          )
        }
      })
    ],
    tools: [
      this.toggleIngredientTool,
      this.setRecipeStepCompletedTool
    ]
  });

  // Check if the chat is actively loading/streaming data
  protected readonly isGenerating = computed(() => {
    return this.chat.isLoading();
  });

  protected setModel(model: 'gemini' | 'openai') {
    this.selectedModel.set(model);
  }

  protected fillInput(text: string) {
    this.userInput.set(text);
  }

  protected submitMessage() {
    const text = this.userInput().trim();
    if (!text || this.isGenerating()) return;

    this.userInput.set('');
    this.chat.sendMessage({ role: 'user', content: text });
  }

  protected retryMessages() {
    this.chat.resendMessages();
  }
}
