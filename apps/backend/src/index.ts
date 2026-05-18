import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { HashbrownOpenAI } from '@hashbrownai/openai';
import { HashbrownGoogle } from '@hashbrownai/google';
import { encodeFrame } from '@hashbrownai/core';

// Resolve CWD and absolute paths for ESM compatibility
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

/**
 * Recursively flattens any "anyOf" object schema union types into a flat object schema
 * with optional properties to ensure 100% compatibility with Gemini's schema parser.
 */
function flattenSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(flattenSchema);
  }

  const result: any = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === 'anyOf' && Array.isArray(value)) {
      const mergedProperties: any = {};
      let hasObjects = false;

      for (const option of value) {
        if (option && typeof option === 'object') {
          const processedOption = flattenSchema(option);
          if (processedOption.properties) {
            hasObjects = true;
            Object.assign(mergedProperties, processedOption.properties);
          }
        }
      }

      if (hasObjects) {
        return {
          type: 'object',
          properties: mergedProperties,
          additionalProperties: false
        };
      } else {
        result[key] = value.map(flattenSchema);
      }
    } else {
      result[key] = flattenSchema(value);
    }
  }

  return result;
}

// Primary Chat Completion stream endpoint
app.post('/chat', async (req, res) => {
  try {
    const { model, messages } = req.body;
    const userMessage = messages && messages.length > 0 ? messages[messages.length - 1].content : '';
    
    console.log(`Received chat request for model: ${model || 'default'}`);
    console.log(`User prompt: "${userMessage}"`);

    const openAiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    // Check if we should use actual LLM or fallback simulator
    if (!openAiKey && !geminiKey) {
      console.log('No API keys found. Activating premium Hashbrown simulation stream...');
      return runSimulationStream(res, userMessage, !!req.body.responseFormat);
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (geminiKey && (!model || model.includes('gemini') || model.includes('google'))) {
      console.log('Using HashbrownGoogle adapter...');
      const resolvedModel = model === 'gemini' ? 'gemini-2.5-flash' : (model || 'gemini-2.5-flash');

      const processedRequest = { ...req.body };
      if (processedRequest.responseFormat) {
        console.log('🤖 Flattening responseFormat schema to avoid Gemini anyOf 400 Bad Request...');
        processedRequest.responseFormat = flattenSchema(processedRequest.responseFormat);
      }
      if (processedRequest.tools && Array.isArray(processedRequest.tools)) {
        processedRequest.tools = processedRequest.tools.map((tool: any) => ({
          ...tool,
          parameters: tool.parameters ? flattenSchema(tool.parameters) : undefined
        }));
      }

      try {
        const stream = HashbrownGoogle.stream.text({
          apiKey: geminiKey,
          request: {
            ...processedRequest,
            model: resolvedModel
          },
          transformRequestOptions: (params: any) => {
            console.log('Incoming req.body.tools:', JSON.stringify(req.body.tools, null, 2));
            console.log('Gemini request params config:', JSON.stringify(params.config, null, 2));
            
            if (params.config) {
              // Gemini strictly prohibits having both tools and responseMimeType: 'application/json' active simultaneously.
              // Since responseFormat/JSON schema is required for GenUI rendering, we must prune tools when application/json is active.
              if (params.config.responseMimeType === 'application/json') {
                console.log('🤖 Pruning tools and toolConfig because responseMimeType is application/json (Gemini constraint)...');
                delete params.config.tools;
                delete params.config.toolConfig;
              } else if (
                params.config.tools &&
                params.config.tools.length > 0 &&
                (!params.config.tools[0].functionDeclarations || params.config.tools[0].functionDeclarations.length === 0)
              ) {
                console.log('🤖 Pruning empty tools and toolConfig configurations to avoid 400 Bad Request...');
                delete params.config.tools;
                delete params.config.toolConfig;
              }
            }
            return params;
          }
        });
        
        let hasError = false;
        let isFirst = true;
        for await (const chunk of stream) {
          const chunkStr = Buffer.from(chunk).toString();
          if (isFirst && chunkStr.includes('"type":"error"')) {
            hasError = true;
            console.warn('⚠️ Intercepted Gemini stream error on first chunk, falling back to Simulation mode:', chunkStr);
            break;
          }
          isFirst = false;
          res.write(chunk);
        }
        
        if (hasError) {
          return runSimulationStream(res, userMessage, !!req.body.responseFormat);
        }
      } catch (geminiError: any) {
        console.warn('⚠️ Gemini streaming failed (e.g. rate limit / quota exceeded), falling back to Simulation mode:', geminiError.message || geminiError);
        return runSimulationStream(res, userMessage, !!req.body.responseFormat);
      }
    } else if (openAiKey) {
      console.log('Using HashbrownOpenAI adapter...');
      const resolvedModel = model === 'openai' ? 'gpt-4o-mini' : (model || 'gpt-4o-mini');
      const stream = HashbrownOpenAI.stream.text({
        apiKey: openAiKey,
        request: {
          ...req.body,
          model: resolvedModel
        },
      });
      for await (const chunk of stream) {
        res.write(chunk);
      }
    } else {
      // Fallback if model specified doesn't match available key
      console.log('Requested model unavailable, using simulation stream...');
      return runSimulationStream(res, userMessage, !!req.body.responseFormat);
    }

    res.end();
  } catch (error: any) {
    console.error('Error handling chat stream:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }
});

/**
 * Simulates a real-time typewriter stream of GenUI response tokens.
 * This ensures the monorepo is fully testable and works beautifully out-of-the-box!
 */
/**
 * Simulates a real-time typewriter stream of GenUI response tokens.
 * This ensures the monorepo is fully testable and works beautifully out-of-the-box!
 */
async function runSimulationStream(res: express.Response, prompt: string, hasResponseFormat = false) {
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const lowerPrompt = prompt.toLowerCase();
  let responseText = '';

  if (hasResponseFormat) {
    if (lowerPrompt.includes('recipe') || lowerPrompt.includes('cook') || lowerPrompt.includes('hashbrown')) {
      const recipeData = {
        ui: [
          {
            "0": {
              $tagName: "app-markdown",
              $props: {
                data: "Certainly! Here is a premium interactive recipe card to cook perfect, crispy golden-brown hashbrowns:"
              }
            }
          },
          {
            "1": {
              $tagName: "app-recipe-card",
              $props: {
                title: "Ultimate Crispy Hashbrowns",
                prepTime: "10 mins",
                cookTime: "15 mins",
                servings: 2,
                ingredients: [
                  "3 medium Russet potatoes",
                  "2 tbsp unsalted butter, melted",
                  "1 tbsp vegetable oil",
                  "1/2 tsp garlic powder",
                  "Salt and black pepper to taste"
                ],
                steps: [
                  "Shred potatoes using a box grater into a bowl of cold water. Rinse until water is clear.",
                  "Squeeze out all moisture completely using a clean kitchen towel. This is crucial for crispiness!",
                  "In a bowl, toss the shredded potatoes with melted butter, garlic powder, salt, and pepper.",
                  "Heat vegetable oil in a large skillet over medium-high heat. Spread potatoes evenly.",
                  "Cook for 6-8 minutes until golden brown, then flip and cook the other side for another 5-6 minutes.",
                  "Serve piping hot with your favorite toppings!"
                ]
              }
            }
          }
        ]
      };
      responseText = JSON.stringify(recipeData);
    } else if (lowerPrompt.includes('system') || lowerPrompt.includes('server') || lowerPrompt.includes('status') || lowerPrompt.includes('dashboard')) {
      const systemData = {
        ui: [
          {
            "0": {
              $tagName: "app-markdown",
              $props: {
                data: "Here is the real-time health and performance dashboard for your **Hashbrown Backend**:"
              }
            }
          },
          {
            "2": {
              $tagName: "app-system-dashboard",
              $props: {
                serverStatus: "HEALTHY",
                cpuUsage: 14,
                memoryUsage: "128MB / 512MB",
                uptime: "1h 45m",
                activeConnections: 3,
                endpoints: [
                  {
                    path: "/chat",
                    method: "POST",
                    latency: "45ms"
                  },
                  {
                    path: "/health",
                    method: "GET",
                    latency: "2ms"
                  }
                ]
              }
            }
          }
        ]
      };
      responseText = JSON.stringify(systemData);
    } else {
      const defaultData = {
        ui: [
          {
            "0": {
              $tagName: "app-markdown",
              $props: {
                data: "Hello! Welcome to the **Hashbrown Generative UI Playground**! 🥔✨\n\nI am running in **Simulation Mode** because the Gemini quota was exceeded. Try asking me for a **'recipe'** or **'server status'** to see my custom GenUI components!"
              }
            }
          }
        ]
      };
      responseText = JSON.stringify(defaultData);
    }
  } else {
    // Plain-text simulation fallback
    if (lowerPrompt.includes('recipe') || lowerPrompt.includes('cook') || lowerPrompt.includes('hashbrown')) {
      responseText = `Here is a custom **Hashbrown Delight** recipe card for you!

[WIDGET:RECIPE_CARD:{"title":"Ultimate Crispy Hashbrowns","prepTime":"10 mins","cookTime":"15 mins","servings":2,"difficulty":"Easy","ingredients":["3 medium Russet potatoes","2 tbsp unsalted butter, melted","1 tbsp vegetable oil","1/2 tsp garlic powder","Salt and freshly cracked black pepper to taste"],"steps":["Shred potatoes using a box grater into a bowl of cold water. Rinse until water is clear.","Squeeze out as much moisture as possible using a clean kitchen towel. (Crucial for crispiness!)","In a bowl, toss the shredded potatoes with melted butter, garlic powder, salt, and pepper.","Heat vegetable oil in a large skillet over medium-high heat. Spread potatoes evenly.","Cook for 6-8 minutes until golden brown, then flip and cook the other side for another 5-6 minutes.","Serve piping hot with ketchup or sour cream!"]}]

I hope you enjoy making this! Is there anything else about hashbrowns or Angular + Express you'd like to explore?`;
    } else if (lowerPrompt.includes('system') || lowerPrompt.includes('server') || lowerPrompt.includes('status') || lowerPrompt.includes('dashboard')) {
      responseText = `Here is the real-time health and performance dashboard for your **Hashbrown Backend**:

[WIDGET:SYSTEM_DASHBOARD:{"serverStatus":"HEALTHY","cpuUsage":14,"memoryUsage":"128MB / 512MB","uptime":"1h 45m","activeConnections":3,"endpoints":[{"path":"/chat","method":"POST","latency":"45ms"},{"path":"/health","method":"GET","latency":"2ms"}]}]

Everything is running flawlessly on port 3000! Let me know if you would like me to trigger a mock load test.`;
    } else {
      responseText = `Hello! Welcome to the **Hashbrown Generative UI Playground**! 🥔✨

I am streaming this response to you from your local **Express backend** in real-time. Since no LLM API keys (\`OPENAI_API_KEY\` or \`GEMINI_API_KEY\`) were detected, I am running in **Simulation Mode** to demonstrate the streaming capabilities of the monorepo.

To interact with my custom GenUI widget capabilities, try typing:
* **"recipe"** - to see me generate an interactive Hashbrown recipe card widget.
* **"status"** - to see a dynamic server statistics and system health dashboard widget.

How can I help you build your next generative web application today?`;
    }
  }

  // Type-safe helper to write binary frames
  const sendChunk = (content: string) => {
    const frame = {
      type: 'chunk' as const,
      chunk: {
        choices: [
          {
            index: 0,
            delta: {
              content,
              role: 'assistant'
            },
            finishReason: null
          }
        ]
      }
    };
    res.write(encodeFrame(frame));
  };

  const sendFinish = () => {
    const frame = {
      type: 'finish' as const
    };
    res.write(encodeFrame(frame));
  };

  // Stream text in small chunks to simulate typewriter delay
  const chunkSize = 15;
  for (let i = 0; i < responseText.length; i += chunkSize) {
    const chunk = responseText.slice(i, i + chunkSize);
    sendChunk(chunk);
    const delay = hasResponseFormat ? 3 + Math.random() * 4 : 20 + Math.random() * 25;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  sendFinish();
  res.end();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const isSimulated = !process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY;
  console.log(`\n🚀 Hashbrown Express Backend listening on http://localhost:${PORT}`);
  console.log(`💻 Run health check at http://localhost:${PORT}/health`);
  console.log(`🤖 LLM Connection: ${isSimulated ? 'Simulation Mode (Offline Fallback)' : 'Active (Live LLM Connected)'}\n`);
});
