// Мини-сервер: выдаёт временный (ephemeral) токен для голосового чата с GPT.
// Настоящий ключ OpenAI хранится только здесь, в переменной окружения Netlify
// (Site configuration → Environment variables → OPENAI_API_KEY) и никогда не
// попадает в браузер — оттуда используется только временный токен с коротким
// сроком жизни (его получает и сразу использует конкретная вкладка Кати).
var MODEL = "gpt-realtime-2.1";
var TUTOR_INSTRUCTIONS = "Ты — дружелюбный голосовой репетитор английского для Кати. " +
  "Она учит английский через тренажёр разговорных предложений и открыла голосовой чат, " +
  "чтобы быстро задать вопрос. Общайся живо и коротко — это голосовой чат, длинные " +
  "лекции не нужны. Если Катя спрашивает про слово, грамматику или перевод — объясняй " +
  "по-русски, а примеры давай по-английски. Если она хочет попрактиковать разговорную " +
  "речь — говори с ней по-английски, мягко и между делом поправляй ошибки. Подстраивай " +
  "сложность своей речи под то, как говорит она сама.";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "method_not_allowed" }) };
  }
  var apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "OPENAI_API_KEY не настроен в переменных окружения Netlify" })
    };
  }
  try {
    var resp = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: MODEL,
          instructions: TUTOR_INSTRUCTIONS,
          audio: {
            output: { voice: "marin" },
            input: { turn_detection: { type: "server_vad" } }
          }
        }
      })
    });
    var data = await resp.json();
    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: (data && data.error && data.error.message) || "OpenAI отказал в выдаче токена" })
      };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: data.value, expires_at: data.expires_at, model: MODEL })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String((err && err.message) || err) })
    };
  }
};
