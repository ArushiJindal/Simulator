
import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const handler = async (event) => {
    const { symbol } = event.queryStringParameters;
    if (!symbol) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Stock symbol is required.' }) };
    }

    try {
        // 1. Check for a cached insight in the database
        const dbResult = await pool.query('SELECT insight, generatedAt FROM trading_insights WHERE symbol = $1', [symbol]);

        if (dbResult.rows.length > 0) {
            const cachedData = dbResult.rows[0];
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            
            // 2. If the insight is recent (less than 2 days old), return it
            if (new Date(cachedData.generatedat) > twoDaysAgo) {
                console.log(`Cache HIT for trading insight: ${symbol}`);
                return { statusCode: 200, body: JSON.stringify({ insight: cachedData.insight }) };
            }
        }

        // 3. If no recent insight exists, generate a new one
        console.log(`Cache MISS for trading insight: ${symbol}. Generating new insight.`);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        const prompt = `
            You are a seasoned stock market analyst providing trading insights and expert in high speed momentum trading for stock market.
            Analyze the stock with the ticker symbol "${symbol}" on the followling points. Make use of internet search while performing your analysis about "${symbol}".
            I want you to use latest available data of this year by browing its recent informtion.

        
            - **Current Trend:** Is the sentiment bullish, bearish, or neutral based on recent price action?
            - **Key Support & Resistance Levels:** Identify important price levels to watch on a daily 1 day candlestick chart. Also mention resistance at 200MA
            - **Potential Catalyst:** What is one upcoming event or factor that could significantly move the stock price?
            - **Short Interest:** What is the short interest and likelihood for short squeeze
            - **Outstanding Float:** What is the public float, and whether any dilution happened in past 1 year and any shelf registration for future dilution.
            - **History:** Whether it made big moves recently in past 1 year and had jackknive moves making the stock risky. I am looking for nasty letdowns.
            - **Recent filings or news:** Any recent news or filings I should be aware of which will influence my decision.
            - ** Recent IPO or Reverse Split:** - Give any information on whether the stock went thought recent reverse split or whether its a new IPO.

            Format the response clearly for stock analysis suggestion so that information can be digested rapidly. Do not give financial advice or make up numbers. 
            If you don't know, skip it.
        `;

        const tools = [{
          googleSearchRetrieval: {}
        }];
        
        const aiResult = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: tools,
        });
        
        const newInsight = aiResult.response.text();

        // 4. Save the new insight to the database, replacing any old one
        const upsertQuery = `
            INSERT INTO trading_insights (symbol, insight, generatedAt)
            VALUES ($1, $2, NOW())
            ON CONFLICT (symbol) DO UPDATE
            SET insight = EXCLUDED.insight, generatedAt = EXCLUDED.generatedAt;
        `;
        await pool.query(upsertQuery, [symbol, newInsight]);
        
        return { statusCode: 200, body: JSON.stringify({ insight: newInsight }) };

    } catch (error) {
        console.error('Error in getTradingInsights function:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate trading insights.' }) };
    }
};