// Мини-сервер для кнопки "Задать вопрос": браузер сам распознаёт речь Кати
// в текст (Web Speech API) и сам озвучивает готовый ответ — сюда долетает и
// отсюда уходит только обычный текст. Здесь только один шаг: получить сам
// ответ у Google Gemini. Настоящий ключ Gemini хранится только тут, в
// переменной окружения Netlify (Site configuration → Environment variables →
// GEMINI_API_KEY) и никогда не попадает в браузер.
// Gemini выбран вместо OpenAI потому, что бесплатный ключ на platform Google
// AI Studio не требует ни банковской карты, ни телефона — в отличие от
// OpenAI, для которого нужен биллинг.
var MODEL = "gemini-flash-latest"; // алиас — всегда указывает на текущую стабильную flash-модель
var TUTOR_INSTRUCTIONS = "Ты — дружелюбный репетитор английского для Кати. Она учит английский " +
  "через тренажёр разговорных предложений и задала вопрос голосом, чтобы быстро получить ответ. " +
  "Отвечай коротко и по делу — это голосовой вопрос-ответ, не лекция (обычно 2-4 предложения, " +
  "больше только если вопрос реально это требует). Если вопрос про слово, грамматику или перевод — " +
  "объясняй по-русски, а примеры давай по-английски. Если Катя написала вопрос по-английски или " +
  "просит попрактиковать разговорную речь — отвечай по-английски, простыми словами. Никакого " +
  "форматирования вроде звёздочек или списков — ответ будет прочитан вслух синтезатором речи.";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "method_not_allowed" }) };
  }
  var question;
  try {
    question = (JSON.parse(event.body || "{}").question || "").toString().trim().slice(0, 1000);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "bad_request" }) };
  }
  if (!question) {
    return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Вопрос пустой" }) };
  }
  var apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "GEMINI_API_KEY не настроен в переменных окружения Netlify" })
    };
  }
  try {
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent?key=" + apiKey;
    var resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: TUTOR_INSTRUCTIONS }] },
        contents: [{ role: "user", parts: [{ text: question }] }]
      })
    });
    var data = await resp.json();
    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: (data && data.error && data.error.message) || "Gemini отказал в ответе" })
      };
    }
    var candidate = data && data.candidates && data.candidates[0];
    var answer = candidate && candidate.content && candidate.content.parts && candidate.content.parts.map(function (p) { return p.text || ""; }).join("");
    if (!answer) {
      var blockReason = data && data.promptFeedback && data.promptFeedback.blockReason;
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: blockReason ? "Ответ заблокирован фильтром безопасности (" + blockReason + ")" : "Gemini не вернул текст ответа" })
      };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: answer.trim() })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String((err && err.message) || err) })
    };
  }
};
