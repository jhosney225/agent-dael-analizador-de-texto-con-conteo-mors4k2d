
```javascript
#!/usr/bin/env node

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";

const client = new Anthropic();

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// Función para calcular estadísticas de texto localmente
function calculateLocalStatistics(text: string) {
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;

  // Contar frecuencia de palabras
  const wordFrequency: Record<string, number> = {};
  words.forEach((word) => {
    const cleanWord = word.replace(/[^a-záéíóúñ]/gi, "");
    if (cleanWord.length > 0) {
      wordFrequency[cleanWord] = (wordFrequency[cleanWord] || 0) + 1;
    }
  });

  // Obtener top 10 palabras más frecuentes
  const topWords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Calcular promedio de caracteres por palabra
  const avgCharsPerWord =
    words.length > 0
      ? (charactersNoSpaces / words.length).toFixed(2)
      : "0.00";

  // Calcular promedio de palabras por oración
  const avgWordsPerSentence =
    sentences.length > 0
      ? (words.length / sentences.length).toFixed(2)
      : "0.00";

  return {
    totalWords: words.length,
    totalSentences: sentences.length,
    totalCharacters: characters,
    totalCharactersNoSpaces: charactersNoSpaces,
    avgCharsPerWord: parseFloat(avgCharsPerWord),
    avgWordsPerSentence: parseFloat(avgWordsPerSentence),
    topWords: topWords,
  };
}

// Función para crear el prompt de análisis
function createAnalysisPrompt(text: string, stats: ReturnType<typeof calculateLocalStatistics>) {
  return `Analiza el siguiente texto y proporciona un análisis detallado junto con las estadísticas calculadas:

TEXTO:
"${text}"

ESTADÍSTICAS CALCULADAS:
- Total de palabras: ${stats.totalWords}
- Total de oraciones: ${stats.totalSentences}
- Total de caracteres: ${stats.totalCharacters}
- Total de caracteres (sin espacios): ${stats.totalCharactersNoSpaces}
- Promedio de caracteres por palabra: ${stats.avgCharsPerWord}
- Promedio de palabras por oración: ${stats.avgWordsPerSentence}
- Top 10 palabras más frecuentes: ${stats.topWords.map((w) => `${w[0]}(${w[1]})`).join(", ")}

Por favor, proporciona:
1. Un resumen del contenido
2. Análisis de la complejidad del texto
3. Observaciones sobre el estilo de escritura
4. Recomendaciones de mejora`;
}

async function analyzeText(
  text: string,
  conversationHistory: ConversationMessage[]
): Promise<string> {
  // Calcular estadísticas locales
  const stats = calculateLocalStatistics(text);

  // Crear prompt para Claude
  const analysisPrompt = createAnalysisPrompt(text, stats);

  // Añadir el mensaje del usuario al historial
  conversationHistory.push({
    role: "user",
    content: analysisPrompt,
  });

  try {
    // Llamar a la API de Claude
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: `Eres un experto en análisis de texto. Tu tarea es analizar textos proporcionados y entregar estadísticas detalladas 
sobre su estructura, complejidad y características lingüísticas. Proporciona análisis profundos pero comprensibles.`,
      messages: conversationHistory,
    });

    // Extraer el contenido de la respuesta
    const assistantMessage =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Añadir la respuesta del asistente al historial
    conversationHistory.push({
      role: "assistant",
      content: assistantMessage,
    });

    return assistantMessage;
  } catch (error) {
    throw new Error(`Error al analizar el texto: ${error}`);
  }
}

async function askFollowUp(
  question: string,
  conversationHistory: ConversationMessage[]
): Promise<string> {
  // Añadir la pregunta de seguimiento al historial
  conversationHistory.push({
    role: "user",
    content: question,
  });

  try {
    // Llamar a la API de Claude con el contexto de la conversación
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: `Eres un experto en análisis de texto. Estás manteniendo una conversación sobre el análisis de un texto específico.
Responde las preguntas de seguimiento basándote en el contexto anterior de la conversación.`,
      messages: conversationHistory,
    });

    // Extraer el contenido de la respuesta
    const assistantMessage =
      response.content[0].type === "text" ? response.content[0].text : "";

    //