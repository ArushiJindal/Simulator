
import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


export const handler = async (event) => {
    const { symbol } = JSON.parse(event.body);
    if (!symbol) {
        console.error('Background function invoked without a symbol.');
        return { statusCode: 400 };
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" }); // Using a model that supports grounding
        
        const prompt = `
            You are a seasoned stock market analyst providing trading insights and expert in high speed momentum trading for stock market.
            Analyze the stock with the ticker symbol "${symbol}" on the followling points. Make use of internet search while performing your analysis about "${symbol}".
            I want you to use latest available data of this year by browing its recent informtion.

        
            - **Current Trend:** Is the sentiment bullish, bearish, or neutral based on recent price action?
            - **Potential Catalyst:** What are the most important upcoming event or factor that could significantly move the stock price and acts as a catalyst?
            - **Short Interest:** What is the short interest and likelihood for short squeeze
            - **Outstanding Float:** What is the public float, and whether any dilution happened in past 1 year and any shelf registration for future dilution.
            - **Recent filings or news:** Any recent news or filings I should be aware of which will influence my decision.
            - ** Recent IPO or Reverse Split:** - Give any information on whether the stock went thought recent reverse split or whether its a new IPO.

            Format the response clearly for stock analysis suggestion so that information can be digested rapidly. Do not give financial advice or make up numbers. 
            If you don't know, skip it.
        `;

        const groundingTool = [{
        googleSearch: {},
        }];

        console.log(`Gen AI model thinking.... ${symbol}`);
        
        const aiResult = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: groundingTool
        });
        
        const newInsight = aiResult.response.text();

        const upsertQuery = `
            INSERT INTO trading_insights (symbol, insight, "generatedat")
            VALUES ($1, $2, NOW())
            ON CONFLICT (symbol) DO UPDATE
            SET insight = EXCLUDED.insight, "generatedat" = EXCLUDED.generatedat;
        `;
        await pool.query(upsertQuery, [symbol, newInsight]);
        
        console.log(`Successfully generated insight for ${symbol}`);
        return { statusCode: 200 };

    } catch (error) {
        console.error(`Failed during background insight generation for ${symbol}:`, error);
        return { statusCode: 500 };
    }
};



