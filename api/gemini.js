module.exports = async function handler(req, res) {
  // CORS 정책 모두 허용 (오류 방지)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Vercel에 GEMINI_API_KEY가 없습니다.' });
  }

  const { type, contents, systemInstruction, prompt } = req.body;

  try {
    if (type === 'text') {
      // 구형 gemini-1.5-flash 대신 최신 gemini-2.5-flash 모델 적용
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
        return res.status(apiRes.status || 500).json({ error: result.error?.message || "Google API 오류" });
      }

      const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return res.status(200).json({ text: responseText });

    } else if (type === 'image') {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${apiKey}`;
      const payload = {
        prompt: prompt,
        config: { numberOfImages: 1, outputMimeType: "image/jpeg", aspectRatio: "1:1" }
      };

      const apiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await apiRes.json();
      if (result.generatedImages && result.generatedImages.length > 0) {
        const base64Data = result.generatedImages[0].image.imageBytes;
        return res.status(200).json({ imageUrl: `data:image/jpeg;base64,${base64Data}` });
      } else {
        return res.status(500).json({ error: '이미지 생성 실패' });
      }
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
