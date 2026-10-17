export default async function handler(req, res) {
  // Configuración de CORS para evitar bloqueos
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
    return res.status(500).json({ error: 'Falta la API Key en las variables de entorno.' });
  }

  if (!imageBase64 || !prompt) {
    return res.status(400).json({ error: 'Faltan datos de la imagen o el prompt.' });
  }

  // LIMPIEZA CLAVE: Eliminamos el envoltorio para que la IA lea la imagen pura
  const cleanImageBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

  try {
    // LLAMANDO A LA NUEVA VERSIÓN: gemini-3.8-flash
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
        generationConfig: { 
          responseMimeType: "application/json",
          temperature: 0.1 // Temperatura bajísima para que no sea creativo, solo lea
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error devuelto por Gemini:", data);
      
      // SALVAVIDAS: Si el servidor de Google está muy ocupado (Error 503)
      if (response.status === 503) {
        return res.status(200).json({ 
          status: "INCORRECTO", 
          feedback: "¡Uf! Hay muchos alumnos preguntando dudas a la vez. Dame unos segunditos y vuelve a pulsar Comprobar, por favor." 
        });
      }
      
      return res.status(response.status).json({ error: data.error?.message || 'Error en la API de IA' });
    }

    // Extraemos el texto de la respuesta
    let resultText = data.candidates[0].content.parts[0].text;
    
    // LIMPIEZA ANTIMARKDOWN: Borramos los envoltorios ```json y ``` que a veces pone Gemini
    resultText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // Devolvemos el JSON súper limpio al frontend
    return res.status(200).json(JSON.parse(resultText));

  } catch (error) {
    console.error("Error crítico en el servidor:", error);
    return res.status(500).json({ error: 'Error interno en el servidor.' });
  }
}
