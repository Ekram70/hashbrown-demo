import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { chatResource } from '@hashbrownai/angular';

interface WidgetPayload {
  type: 'RECIPE_CARD' | 'SYSTEM_DASHBOARD';
  data: any;
}

interface ParsedMessage {
  role: 'user' | 'assistant' | 'system';
  textContent: string;
  widgets: WidgetPayload[];
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  // Selected LLM Provider setting
  protected readonly selectedModel = signal<'gemini' | 'openai'>('gemini');

  // Input textbox state
  protected readonly userInput = signal('');

  // Aesthetic suggestions to help users discover features
  protected readonly suggestions = [
    { label: '✨ Crispy Hashbrown Recipe', text: 'Give me a hashbrown recipe' },
    { label: '📊 Express Server Dashboard', text: 'Show server status' },
    { label: '💡 What is GenUI?', text: 'Explain what Generative UI is' }
  ];

  // Instantiates the Hashbrown chat completion manager
  protected readonly chat = chatResource({
    model: computed(() => this.selectedModel()),
    system: 'You are Hashbrown AI, an advanced generative assistant helping developers build reactive GenUI.'
  });

  // Parses raw chat text reactively to pull out custom JSON-encoded widgets
  protected readonly parsedMessages = computed<ParsedMessage[]>(() => {
    const rawMessages = this.chat.value() || [];
    return rawMessages.map((msg: any) => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      const parsed = this.parseWidgets(content);
      return {
        role: msg.role as 'user' | 'assistant' | 'system',
        textContent: parsed.textContent,
        widgets: parsed.widgets
      };
    });
  });

  // Checks if the chat is actively fetching/streaming data
  protected readonly isGenerating = computed(() => {
    return this.chat.status() === 'loading';
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

  /**
   * Real-time parser for custom widgets embedded in the streamed text.
   * Matches [WIDGET:WIDGET_TYPE:{...json data...}] syntax.
   */
  private parseWidgets(content: string): { textContent: string; widgets: WidgetPayload[] } {
    const widgets: WidgetPayload[] = [];
    let textContent = content;

    const widgetRegex = /\[WIDGET:([A-Z_]+):({.*?})\]/g;
    let match;

    while ((match = widgetRegex.exec(content)) !== null) {
      const widgetType = match[1] as 'RECIPE_CARD' | 'SYSTEM_DASHBOARD';
      const jsonString = match[2];

      try {
        const data = JSON.parse(jsonString);
        widgets.push({ type: widgetType, data });
        // Cleanse the raw widget code out of the display text content
        textContent = textContent.replace(match[0], '');
      } catch (e) {
        // Suppress JSON parse errors during active streaming until fully buffered
      }
    }

    return {
      textContent: textContent.trim(),
      widgets
    };
  }
}
