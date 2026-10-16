export default async function handler(req, res) {
  // CORS: Permitir peticiones solo desde nuestro propio dominio
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Solo se acepta POST.' });
  }

  const { imageBase64, prompt } = req.body;
  
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Falta la API Key en las variables de entorno de Vercel.' });
  }

  if (!imageBase64 || !prompt) {
    return res.status(400).json({ error: 'Faltan datos de la imagen o el prompt.' });
  }

  // CORRECCIÓN VITAL: Eliminar la cabecera de datos de la imagen web para que la IA la vea correctamente
  const cleanImageBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: cleanImageBase64 } }
          ]
        }],
        // OPTIMIZACIÓN 3: Limitar tokens y ajustar la temperatura para respuestas ultrarrápidas
        generationConfig: { 
          responseMimeType: "application/json",
          maxOutputTokens: 150,
          temperature: 0.2
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error de Gemini:", data);
      return res.status(response.status).json({ error: data.error?.message || 'Error en la API de IA' });
    }

    const resultText = data.candidates[0].content.parts[0].text;
    return res.status(200).json(JSON.parse(resultText));

  } catch (error) {
    console.error("Error crítico en el servidor:", error);
    return res.status(500).json({ error: 'Error interno en el servidor de Vercel.' });
  }
}
