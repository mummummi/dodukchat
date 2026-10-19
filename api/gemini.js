export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("오류: GEMINI_API_KEY가 설정되지 않았습니다.");
    return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다. Vercel Settings를 확인하세요.' });
  }

  const { type, contents, systemInstruction, prompt } = req.body;

  try {
    if (type === 'text') {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

      let sysPart = undefined;
      if (systemInstruction) {
        const textVal = typeof systemInstruction === 'string' 
          ? systemInstruction 
          : (systemInstruction.parts?.[0]?.text || systemInstruction.text || "");
        if (textVal) sysPart = { parts: [{ text: textVal }] };
      }

      const payload = {
        contents: contents || [],
        systemInstruction: sysPart,
        generationConfig: { temperature: 0.7 }
      };

      const apiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await apiRes.json();

      if (!apiRes.ok || result.error) {
        console.error("Gemini API 호출 실패:", result.error);
        return res.status(apiRes.status || 500).json({ error: result.error?.message || "Gemini API호출 에러" });
      }

      const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return res.status(200).json({ text: responseText });

    } else if (type === 'image') {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: "1:1" } }
      };

      const apiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await apiRes.json();
      const part = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

      if (part && part.inlineData) {
        const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        return res.status(200).json({ imageUrl });
      } else {
        return res.status(500).json({ error: result.error?.message || '이미지 생성 실패' });
      }
    } else {
      return res.status(400).json({ error: '잘못된 요청 형식입니다.' });
    }
  } catch (err) {
    console.error("백엔드 예외 에러:", err);
    return res.status(500).json({ error: err.message });
  }
}
