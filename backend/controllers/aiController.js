exports.chat = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    // Contoh respons dummy, ganti dengan integrasi AI sebenarnya jika perlu
    const aiResponse = `AI Response untuk: ${message}`;
    res.json({ response: aiResponse });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};