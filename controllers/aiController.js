exports.chat = async (req, res) => {
  console.log('AI_CHAT headers:', {
    auth: req.headers.authorization ? 'present' : 'missing',
    origin: req.headers.origin,
  });
  console.log('AI_CHAT body:', req.body);

  try {
    const { message, systemPrompt, context = {} } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Get business stats from context or database
    const stats = context.stats || await getBusinessStats(req.headers.authorization);
    const extendedStats = context.extendedStats || await getExtendedAnalytics(req.headers.authorization);

    // Enhanced system prompt with dynamic business intelligence
    const prompt = systemPrompt || generateSystemPrompt(stats, extendedStats);

    // Choose the best available model (prioritizing performance)
    const model = selectBestAvailableModel();
    
    // Prepare conversation history with context
    const messages = prepareConversationHistory(prompt, message, context);

    // Adaptive token management
    const maxTokens = calculateOptimalTokenLimit(message);

    // Enhanced AI response with fallback mechanism
    const aiResponse = await getAIResponseWithFallback(model, messages, maxTokens);

    // Post-process the response for business context
    const processedResponse = enhanceResponseForBusiness(aiResponse, stats, extendedStats);

    // Return the enhanced response
    res.json({ 
      response: processedResponse,
      context: {
        lastUpdated: new Date().toISOString(),
        suggestedActions: extractSuggestedActions(processedResponse),
        quickReplies: generateQuickReplies(processedResponse)
      }
    });

  } catch (error) {
    console.error('AI_CHAT_ERROR:', error);
    res.status(500).json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper functions

async function getBusinessStats(authHeader) {
  try {
    const response = await fetch(`${API_URL}/users/admin/stats`, {
      headers: authHeader ? { Authorization: authHeader } : {},
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return null;
  }
}

async function getExtendedAnalytics(authHeader) {
  try {
    const response = await fetch(`${API_URL}/users/admin/analytics`, {
      headers: authHeader ? { Authorization: authHeader } : {},
    });
    const data = await response.json();
    return {
      ...data,
      // Calculate additional metrics
      conversionRate: data.totalOrders / (data.websiteVisitors || 1),
      utilizationRate: data.rentedCars / (data.totalCars || 1),
      repeatRate: data.repeatCustomers / (data.totalCustomers || 1)
    };
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return null;
  }
}

function generateSystemPrompt(stats, extendedStats) {
  const currentDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const popularCar = extendedStats?.popularCars?.[0] || {};
  const peakHour = extendedStats?.peakHours?.[0] || {};

  return `
# PERAN KAMU
Kamu adalah AI Business Intelligence untuk rental mobil, namun kamu juga dapat membantu menjawab pertanyaan umum di luar topik rental mobil jika dibutuhkan.

# INFORMASI SISTEM
Tanggal: ${currentDate}

## DATA BISNIS TERKINI
- Total Pesanan: ${stats?.totalOrders ?? 0}
- Omzet: Rp${(stats?.totalRevenue ?? 0).toLocaleString("id-ID")}
- Rata-rata Pesanan: Rp${(extendedStats?.avgOrderValue ?? 0).toLocaleString("id-ID")}
- Tingkat Konversi: ${extendedStats?.conversionRate ? (extendedStats.conversionRate * 100).toFixed(1) : 0}%
- Pertumbuhan Bulanan: ${extendedStats?.monthlyGrowth ? (extendedStats.monthlyGrowth * 100).toFixed(1) : 0}%
- Total Mobil: ${stats?.totalCars ?? 0}
- Utilisasi: ${extendedStats?.utilizationRate ? (extendedStats.utilizationRate * 100).toFixed(1) : 0}%
- Ketersediaan: ${extendedStats?.availabilityRate ? (extendedStats.availabilityRate * 100).toFixed(1) : 0}%
- Pelanggan Baru: ${extendedStats?.newCustomers ?? 0}
- Pelanggan Berulang: ${extendedStats?.repeatCustomers ?? 0}
- Tingkat Retensi: ${extendedStats?.repeatRate ? (extendedStats.repeatRate * 100).toFixed(1) : 0}%
- Mobil Populer: ${popularCar.model || '-'} (${popularCar.count || 0}x)
- Jam Sibuk: ${peakHour.hour || '-'} (${peakHour.count || 0} pesanan)
- Channel Efektif: ${extendedStats?.topChannels?.join(', ') || '-'}

# PETUNJUK
- Jika pertanyaan berkaitan dengan rental mobil, jawab dengan analisis bisnis, strategi, dan insight data.
- Jika pertanyaan di luar rental mobil, jawab dengan pengetahuan umum terbaikmu.
- Jika tidak tahu jawabannya, katakan dengan jujur.

# FORMAT RESPON
1. **Analisis**: Insight berbasis data (jika relevan)
2. **Jawaban**: Jawab pertanyaan user sejelas mungkin
3. **Rekomendasi**: Jika relevan, berikan saran atau langkah lanjut
`.trim();
}

function selectBestAvailableModel() {
  // Model selection logic with fallback options
  const preferredModels = [
    "mistralai/mixtral-8x7b-instruct:nitro",
    "anthropic/claude-3-opus",
    "anthropic/claude-3-sonnet",
    "openai/gpt-4-turbo-preview",
    "mistralai/mistral-small-3.1-24b-instruct:free"
  ];

  return preferredModels[0]; // Use the best available
}

function prepareConversationHistory(prompt, message, context) {
  const messages = [
    { role: "system", content: prompt },
    { role: "user", content: message }
  ];

  // Add context if available
  if (context.lastMessage) {
    messages.unshift({
      role: "assistant",
      content: context.lastMessage
    });
  }

  return messages;
}

function calculateOptimalTokenLimit(message) {
  // Adaptive token management based on message complexity
  const length = message.length;
  if (length > 500) return 2048;
  if (length > 200) return 1024;
  return 512;
}

async function getAIResponseWithFallback(model, messages, maxTokens) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${(process.env.OPENROUTER_API_KEY || "").trim()}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-rental-app.com",
        "X-Title": "Rental Mobil AI Assistant"
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        top_p: 0.9,
        response_format: { type: "text" }
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Maaf, terjadi kesalahan pada AI.";
  } catch (error) {
    console.error('Primary model failed, falling back:', error);
    // Implement fallback logic here
    return getFallbackResponse(messages);
  }
}

function enhanceResponseForBusiness(response, stats, extendedStats) {
  // Add data references to the response
  let enhanced = response;
  
  if (stats) {
    enhanced += `\n\n📊 Data Referensi:\n`;
    enhanced += `- Total Pesanan: ${stats.totalOrders || 0}\n`;
    enhanced += `- Total Omzet: Rp${(stats.totalRevenue || 0).toLocaleString("id-ID")}\n`;
    if (extendedStats?.conversionRate) {
      enhanced += `- Tingkat Konversi: ${(extendedStats.conversionRate * 100).toFixed(1)}%\n`;
    }
  }

  // Add strategic recommendations footer
  enhanced += `\n💡 Strategi Implementasi:\n`;
  enhanced += `1. Tetapkan target spesifik (contoh: tingkatkan konversi 5% dalam 1 bulan)\n`;
  enhanced += `2. Monitor metrik kunci harian/mingguan\n`;
  enhanced += `3. Lakukan A/B testing untuk optimasi\n`;
  
  return enhanced;
}

function extractSuggestedActions(response) {
  // Simple NLP to extract actions from response
  const actions = [];
  const actionRegex = /(rekomendasi|saran|strategi|action item):? (.+)/gi;
  let match;
  
  while ((match = actionRegex.exec(response)) !== null) {
    actions.push(match[2]);
  }
  
  return actions.length > 0 ? actions : [
    "Analisis tren penjualan 30 hari terakhir",
    "Review performa channel pemasaran",
    "Evaluasi tingkat kepuasan pelanggan"
  ];
}

function generateQuickReplies(response) {
  // Generate context-aware quick replies
  const lowerResponse = response.toLowerCase();
  
  if (lowerResponse.includes('penjualan') || lowerResponse.includes('omzet')) {
    return [
      "Tampilkan analisis tren penjualan",
      "Bandingkan performa bulan ini vs bulan lalu",
      "Rekomendasi untuk meningkatkan konversi",
      "Prediksi omzet bulan depan"
    ];
  }
  
  if (lowerResponse.includes('pelanggan')) {
    return [
      "Segmentasi pelanggan",
      "Tingkat retensi pelanggan",
      "Strategi meningkatkan loyalitas",
      "Analisis churn rate"
    ];
  }
  
  // Default quick replies
  return [
    "Tampilkan dashboard performa",
    "Analisis utilisasi armada",
    "Rekomendasi promosi",
    "Optimasi harga dinamis"
  ];
}

async function getFallbackResponse(messages) {
  // Implement a fallback mechanism when primary AI fails
  try {
    // Try a simpler model
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${(process.env.OPENROUTER_API_KEY || "").trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistralai/mistral-small-3.1-24b-instruct:free",
        messages,
        max_tokens: 512
      })
    });
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Maaf, sedang ada gangguan teknis. Silakan coba lagi nanti.";
  } catch (fallbackError) {
    console.error('Fallback also failed:', fallbackError);
    return "Sistem sedang mengalami gangguan. Silakan coba beberapa saat lagi atau hubungi tim support.";
  }
}