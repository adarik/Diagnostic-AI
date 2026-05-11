import { AnalysisResult } from './geminiService';

export const OLLAMA_MODELS = [
  { id: 'llava:13b', label: 'LLaVA 13B (рекомендуется)' },
  { id: 'llama3.2-vision', label: 'Llama 3.2 Vision' },
  { id: 'gemma3:12b', label: 'Gemma 3 12B' },
  { id: 'moondream', label: 'Moondream (лёгкая)' },
];

const OLLAMA_BASE_URL = 'http://localhost:11434';

const SYSTEM_PROMPT = `Вы — высококвалифицированный ИИ-помощник для врачей-инфекционистов.
Ваша задача — анализировать клинические фотографии потенциальных инфекций (поражения кожи, сыпь, раны и т. д.) и предоставлять подробную медицинскую оценку.

Рекомендации:
1. Профессиональный тон: используйте точную медицинскую терминологию на русском языке.
2. Структура: укажите основной предполагаемый диагноз, список дифференциальных диагнозов, подробное клиническое обоснование на основе визуальных признаков и рекомендуемые дальнейшие шаги.
3. Визуальный анализ: опишите то, что вы видите (эритема, экссудат, границы, распределение и т. д.).
4. Срочность: классифицируйте срочность случая.

Верни ТОЛЬКО валидный JSON без markdown-блоков:
{
  "diagnosis": "Основной предполагаемый диагноз",
  "differentialDiagnosis": ["Дифф 1", "Дифф 2", "Дифф 3"],
  "reasoning": "Подробное объяснение визуальных находок и медицинской логики.",
  "recommendations": ["Рекомендуемый лабораторный тест", "Клиническое действие", "Совет пациенту"],
  "urgency": "low"
}

Значение urgency должно быть одним из: low, medium, high, critical.
Все текстовые поля должны быть на русском языке.`;

function extractJSON(text: string): string {
  // Try to find a JSON object in the response
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return match[0];
  return text;
}

function parseResult(text: string): AnalysisResult {
  const cleaned = extractJSON(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
  const parsed = JSON.parse(cleaned);

  if (!parsed.diagnosis) parsed.diagnosis = 'Не удалось определить диагноз';
  if (!Array.isArray(parsed.differentialDiagnosis)) parsed.differentialDiagnosis = [];
  if (!parsed.reasoning) parsed.reasoning = 'Анализ недоступен';
  if (!Array.isArray(parsed.recommendations)) parsed.recommendations = [];
  const validUrgencies = ['low', 'medium', 'high', 'critical'];
  if (!validUrgencies.includes(parsed.urgency)) parsed.urgency = 'medium';

  return parsed as AnalysisResult;
}

export async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models ?? []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

export async function analyzeWithOllama(
  base64Image: string,
  modelId: string
): Promise<AnalysisResult> {
  const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  const body = {
    model: modelId,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: 'Проанализируйте это клиническое изображение на наличие потенциальных инфекционных заболеваний. Верните ТОЛЬКО JSON без пояснений.',
        images: [imageData],
      },
    ],
    stream: false,
    options: { temperature: 0.1 },
  };

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`Ollama вернул ошибку ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text: string = data?.message?.content ?? data?.response ?? '';
  if (!text) throw new Error('Пустой ответ от Ollama');

  return parseResult(text);
}
