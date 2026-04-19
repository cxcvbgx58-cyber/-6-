
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { RowData } from "../models";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. AI features will be disabled.");
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface AIInsightResponse {
  analysis: string;
  why: string[];
  metrics: {
    price: string;
    cap: string;
    volume: string;
    supply: string;
    rank?: string;
    ath?: string;
    atl?: string;
    news: string;
    protocol: string;
    protocolTitle: string;
  };
  sources: { title: string; uri: string }[];
}

export class AIService {
  static async analyzeAsset(asset: RowData, language: 'ru' | 'en' = 'ru', model: string = 'gemini-3-flash-preview'): Promise<AIInsightResponse> {
    const ticker = asset.pair.replace(/USDT$|BUSD$|BTC$|ETH$/, '');
    
    const prompt = `
      TARGET ASSET: ${asset.pair} (Ticker: ${ticker}).
      
      STEP 1: Use Google Search to find the specific CoinMarketCap page for ${ticker}.
      Primary Target: https://coinmarketcap.com/currencies/[coin-slug]/
      Secondary Target (CMC AI): https://coinmarketcap.com/cmc-ai/[coin-slug]/what-is/
      
      STEP 2: Locate the "In brief" (or "Вкратце") section from CMC AI. This is a blue-tinted block with a lightning bolt icon.
      
      STEP 3: EXTRACT EVERYTHING from that block VERBATIM. 
      - Copy all numbered points.
      - Copy all bold headers.
      - Do not summarize.
      
      STEP 4: EXTRACT ALL MARKET METRICS from the page:
      - Current Price
      - Market Cap (Full and Diluted)
      - 24h Volume (and Volume/Market Cap ratio)
      - Circulating Supply and Max Supply
      - Market Rank
      - All Time High (ATH) and All Time Low (ATL)
      
      STEP 5: TRANSLATE the entire extracted text to ${language === 'ru' ? 'Russian' : 'English'}.
      
      OUTPUT JSON:
      {
        "analysis": "Extraction from CoinMarketCap completed.",
        "why": ["<Verbatim translated point 1>", "<Verbatim translated point 2>", "..."],
        "metrics": {
          "price": "<Verbatim Price>",
          "cap": "<Verbatim Market Cap>",
          "volume": "<Verbatim 24h Volume>",
          "supply": "<Verbatim Circulating Supply>",
          "rank": "<Market Rank>",
          "ath": "<All Time High>",
          "atl": "<All Time Low>",
          "news": "<Full verbatim translated 'In Brief' block text>",
          "protocol": "<Verbatim 'What is' section or detailed description>",
          "protocolTitle": "О протоколе ${ticker}"
        },
        "sources": [
          {"title": "CoinMarketCap ${ticker}", "uri": "https://coinmarketcap.com/currencies/${ticker.toLowerCase()}/"}
        ]
      }
    `;

    try {
      const ai = getAI();
      if (!ai) throw new Error("AI Service unavailable: GEMINI_API_KEY is missing.");

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction: `You are a high-precision data extraction tool for Smarteye.
          
          Your PRIMARY task is to find the CoinMarketCap CMC AI "In brief" (Вкратце) block and copy it WORD-FOR-WORD.
          
          CRITICAL RULES:
          1. DO NOT rephrase. DO NOT summarize.
          2. COPY the numbered list exactly as it appears.
          3. If the block contains 3 points, your "why" array must have 3 strings corresponding to those points.
          4. The "news" field should contain the entire "In Brief" block text as a single string.
          5. Extract ALL available market metrics (Rank, ATH, ATL, Cap, Volume, Supply).
          6. Always translate the final output to ${language === 'ru' ? 'Russian' : 'English'}.`,
          tools: [{ googleSearch: {} }],
        },
      });

      const data = JSON.parse(response.text || "{}");
      
      const groundingSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter(chunk => chunk.web)
        ?.map(chunk => ({
          title: chunk.web?.title || 'Source',
          uri: chunk.web?.uri || ''
        })) || [];

      return {
        analysis: data.analysis || "Extraction from CoinMarketCap completed.",
        why: Array.isArray(data.why) ? data.why : [],
        metrics: {
          price: data.metrics?.price || '',
          cap: data.metrics?.cap || '',
          volume: data.metrics?.volume || '',
          supply: data.metrics?.supply || '',
          rank: data.metrics?.rank || '',
          ath: data.metrics?.ath || '',
          atl: data.metrics?.atl || '',
          news: data.metrics?.news || '',
          protocol: data.metrics?.protocol || '',
          protocolTitle: data.metrics?.protocolTitle || `О протоколе ${ticker}`
        },
        sources: [...(data.sources || []), ...groundingSources].slice(0, 5)
      };
    } catch (error) {
      console.error("Data Extraction Error:", error);
      throw error;
    }
  }

  static async analyzeMarket(densities: RowData[], language: 'ru' | 'en' = 'ru'): Promise<AIInsightResponse> {
    return {
      analysis: "Market scan functionality is currently focused on individual asset data extraction.",
      why: [],
      metrics: {
        price: '', cap: '', volume: '', supply: '', news: '', protocol: '', protocolTitle: ''
      },
      sources: []
    };
  }

  static async askQuestion(question: string, context: RowData[], language: 'ru' | 'en' = 'ru'): Promise<string> {
    const contextStr = context.slice(0, 5).map(d => `${d.pair} ${d.side} @ ${d.price}`).join(', ');
    const prompt = `Context: ${contextStr}\nQuestion: ${question}\nLanguage: ${language === 'ru' ? 'Russian' : 'English'}.`;

    const ai = getAI();
    if (!ai) return "Assistant unavailable: GEMINI_API_KEY is missing.";

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: `You are Smarteye Assistant. Answer based on provided data. Respond in ${language === 'ru' ? 'Russian' : 'English'}.`
        }
      });
      return response.text || "I'm sorry, I couldn't generate an answer.";
    } catch (e) {
      return "Assistant unavailable.";
    }
  }
}
