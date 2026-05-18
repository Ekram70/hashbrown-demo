import { Component, input, computed, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-markdown',
  standalone: true,
  template: '<div [innerHTML]="htmlContent()" class="app-markdown"></div>',
  encapsulation: ViewEncapsulation.None,
  styles: `
    .app-markdown {
      display: block;
      font-family: inherit;
      line-height: 1.6;
      color: #374151;
    }
    .app-markdown h1,
    .app-markdown h2,
    .app-markdown h3 {
      font-weight: 700;
      margin: 1.25em 0 0.5em;
      color: #111827;
    }
    .app-markdown p {
      margin: 0.75em 0;
    }
    .app-markdown ul,
    .app-markdown ol {
      margin: 0.75em 0;
      padding-left: 1.5em;
    }
    .app-markdown ul {
      list-style-type: disc;
    }
    .app-markdown ol {
      list-style-type: decimal;
    }
    .app-markdown li {
      margin: 0.35em 0;
    }
    .app-markdown code {
      font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
      background-color: #f3f4f6;
      padding: 0.25em 0.4em;
      border-radius: 4px;
      color: #dc2626;
      font-size: 0.875em;
    }
    .app-markdown strong {
      font-weight: 600;
      color: #111827;
    }
  `
})
export class MarkdownComponent {
  data = input<string>('');

  htmlContent = computed(() => {
    let raw = this.data() || '';
    
    // Basic HTML escaping
    raw = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
      
    // Bold: **text**
    raw = raw.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Inline code: `code`
    raw = raw.replace(/`(.*?)`/g, '<code>$1</code>');
    
    const lines = raw.split('\n');
    let inList = false;
    let listType: 'ul' | 'ol' | null = null;
    const resultLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        if (!inList || listType !== 'ul') {
          if (inList) resultLines.push(`</${listType}>`);
          resultLines.push('<ul>');
          inList = true;
          listType = 'ul';
        }
        resultLines.push(`<li>${trimmed.substring(2)}</li>`);
      } 
      else if (/^\d+\.\s/.test(trimmed)) {
        const itemContent = trimmed.replace(/^\d+\.\s/, '');
        if (!inList || listType !== 'ol') {
          if (inList) resultLines.push(`</${listType}>`);
          resultLines.push('<ol>');
          inList = true;
          listType = 'ol';
        }
        resultLines.push(`<li>${itemContent}</li>`);
      } 
      else {
        if (inList) {
          resultLines.push(`</${listType}>`);
          inList = false;
          listType = null;
        }
        if (trimmed) {
          resultLines.push(`<p>${line}</p>`);
        }
      }
    }
    
    if (inList) {
      resultLines.push(`</${listType}>`);
    }

    return resultLines.join('\n');
  });
}
