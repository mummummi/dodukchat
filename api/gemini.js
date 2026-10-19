export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  const { type, contents, systemInstruction, prompt } = req.body;

  try {
    if (type === 'text') {
      // 가장 안정적인 gemini-1.5-flash 표준 엔드포인트 사용
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
        console.error("Gemini API Error Detail:", result.error);
        return res.status(apiRes.status || 500).json({ error: result.error?.message || "API 호출 오류" });
      }

      const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return res.status(200).json({ text: responseText });

    } else if (type === 'image') {
      // 이미지 생성 전용 엔드포인트
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${apiKey}`;

      const payload = {
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: "1:1"
        }
      };

      const apiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await apiRes.json();

      if (result.generatedImages && result.generatedImages.length > 0) {
        const base64Data = result.generatedImages[0].image.imageBytes;
        const imageUrl = `data:image/jpeg;base64,${base64Data}`;
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
