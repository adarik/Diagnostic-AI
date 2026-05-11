import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.G_API_KEY });

export interface AnalysisResult {
  diagnosis: string;
  differentialDiagnosis: string[];
  reasoning: string;
  recommendations: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

const SYSTEM_INSTRUCTION = `Вы — высококвалифицированный ИИ-помощник для врачей-инфекционистов.
Ваша задача — анализировать клинические фотографии потенциальных инфекций (поражения кожи, сыпь, раны и т. д.) и предоставлять подробную медицинскую оценку.

Рекомендации:
1. Профессиональный тон: используйте точную медицинскую терминологию на русском языке.
2. Структура: укажите основной предполагаемый диагноз, список дифференциальных диагнозов, подробное клиническое обоснование на основе визуальных признаков и рекомендуемые дальнейшие шаги (анализы, меры предосторожности).
3. Визуальный анализ: опишите то, что вы видите (эритема, экссудат, границы, распределение и т. д.).
4. Срочность: классифицируйте срочность случая.
5. Отказ от ответственности: всегда напоминайте пользователю, что это инструмент с поддержкой ИИ, и окончательное клиническое решение остается за специалистом.

Формат вывода (JSON):
{
  "diagnosis": "Основной предполагаемый диагноз",
  "differentialDiagnosis": ["Дифф 1", "Дифф 2", "Дифф 3"],
  "reasoning": "Подробное объяснение визуальных находок и медицинской логики.",
  "recommendations": ["Рекомендуемый лабораторный тест", "Клиническое действие", "Совет пациенту"],
  "urgency": "low | medium | high | critical"
}

Если изображение не относится к медицинской инфекции или имеет слишком низкое качество, четко укажите это в поле диагноза и попросите предоставить более качественное изображение. Все текстовые поля должны быть на русском языке.`;

function parseAnalysisResult(text: string): AnalysisResult {
  // Strip markdown code blocks if the model wraps JSON in them
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  if (!parsed.diagnosis || !Array.isArray(parsed.differentialDiagnosis) || !parsed.reasoning || !Array.isArray(parsed.recommendations) || !parsed.urgency) {
    throw new Error("Неверный формат ответа от ИИ");
  }
  const validUrgencies = ['low', 'medium', 'high', 'critical'];
  if (!validUrgencies.includes(parsed.urgency)) {
    parsed.urgency = 'medium';
  }
  return parsed as AnalysisResult;
}

export async function analyzeInfectionImage(base64Image: string, mimeType: string): Promise<AnalysisResult> {
  const model = "gemini-2.5-pro";

  const imagePart = {
    inlineData: {
      data: base64Image.includes(',') ? base64Image.split(',')[1] : base64Image,
      mimeType: mimeType,
    },
  };

  const textPart = {
    text: "Проанализируйте это клиническое изображение на наличие потенциальных инфекционных заболеваний. Предоставьте свою оценку в указанном формате JSON на русском языке.",
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: [{ parts: [imagePart, textPart] }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
        },
      });

      const text = response.text;
      if (!text) throw new Error("Пустой ответ от ИИ");

      return parseAnalysisResult(text);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  console.error("Error analyzing image:", lastError);
  throw lastError;
}
