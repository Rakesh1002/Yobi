import { Anthropic } from '@anthropic-ai/sdk'
import { Logger } from 'winston'
import { AnalysisType, TimeHorizon, SignalStrength } from '@yobi/shared-types'

interface KnowledgeBaseClient {
  searchKnowledge(query: any): Promise<any>
  generateEnhancedAnalysis(context: any): Promise<any>
}

// Simple HTTP client for knowledge base
class SimpleKnowledgeClient implements KnowledgeBaseClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3002/api/knowledge') {
    this.baseUrl = baseUrl
  }

  async searchKnowledge(query: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query)
      })
      return await response.json()
    } catch (error) {
      console.warn('Knowledge search failed, using fallback analysis')
      return { results: [] }
    }
  }

  async generateEnhancedAnalysis(context: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/analysis/enhanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context)
      })
      return await response.json()
    } catch (error) {
      console.warn('Enhanced analysis failed, using standard analysis')
      return null
    }
  }
}

export class ClaudeService {
  private anthropic: Anthropic
  private logger: Logger
  private knowledgeBase: KnowledgeBaseClient

  constructor(logger: Logger) {
    this.logger = logger
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    })
    this.knowledgeBase = new SimpleKnowledgeClient()
  }

  /**
   * Generate enhanced investment analysis using RAG
   */
  async generateInstrumentAnalysis(
    instrumentData: any,
    marketData: any,
    fundamentalData?: any
  ): Promise<any> {
    try {
      // First try enhanced analysis with knowledge base
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const enhancedResult = await this.knowledgeBase.generateEnhancedAnalysis({
            instrumentData,
            marketData, 
            fundamentalData
          })

          if (enhancedResult?.success) {
            this.logger.info('Generated enhanced RAG analysis', { 
              symbol: instrumentData.symbol,
              knowledgeUsed: enhancedResult.knowledgeUsed 
            })
            return this.formatEnhancedAnalysis(enhancedResult.analysis, enhancedResult.knowledgeSources)
          }
        } catch (error) {
          this.logger.warn('RAG analysis failed, falling back to standard', { error })
        }
      }

      // Fallback to standard analysis
      return await this.generateStandardAnalysis(instrumentData, marketData, fundamentalData)

    } catch (error) {
      this.logger.error('Analysis generation failed completely', { error })
      return this.generateFallbackAnalysis(instrumentData)
    }
  }

  /**
   * Generate standard Claude analysis (non-RAG)
   */
  private async generateStandardAnalysis(
    instrumentData: any,
    marketData: any,
    fundamentalData?: any
  ): Promise<any> {
    const prompt = this.buildStandardAnalysisPrompt(instrumentData, marketData, fundamentalData)
    
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const analysisText = (response.content[0] as any)?.text || ''
    return this.parseAnalysisResponse(analysisText, instrumentData)
  }

  /**
   * Format enhanced RAG analysis to standard format
   */
  private formatEnhancedAnalysis(analysis: any, knowledgeSources: any[] = []): any {
    return {
      action: analysis.recommendation?.action || 'HOLD',
      targetPrice: analysis.recommendation?.targetPrice || analysis.valuation?.targetPrice,
      stopLoss: this.calculateStopLoss(analysis.recommendation?.targetPrice, analysis.risks),
      timeHorizon: analysis.recommendation?.timeHorizon || 'MEDIUM_TERM',
      confidence: analysis.recommendation?.confidence || 75,
      rationale: analysis.executiveSummary || analysis.rationale || 'Professional analysis based on CFA frameworks',
      keyPoints: analysis.keyInsights || this.extractKeyPoints(analysis),
      risks: analysis.risks?.keyRiskFactors || ['Market volatility', 'Sector-specific risks'],
      sources: knowledgeSources,
      cfaFrameworks: analysis.cfaFrameworks || [],
      enhancedAnalysis: true
    }
  }

  /**
   * Build analysis prompt for standard (non-RAG) analysis
   */
  private buildStandardAnalysisPrompt(
    instrumentData: any,
    marketData: any,
    fundamentalData?: any
  ): string {
    const currency = instrumentData.exchange === 'NSE' ? 'INR' : 'USD'
    const marketContext = instrumentData.exchange === 'NSE' ? 'Indian equity market' : 'US equity market'
    
    return `
As a senior equity research analyst providing institutional-grade investment analysis for ${instrumentData.name} (${instrumentData.symbol}) on ${instrumentData.exchange}.

## CURRENT MARKET POSITION
- **Symbol**: ${instrumentData.symbol}
- **Exchange**: ${instrumentData.exchange} (${marketContext})
- **Current Price**: ${currency} ${marketData.close?.toLocaleString() || 'N/A'}
- **24h Performance**: ${marketData.changePercent > 0 ? '+' : ''}${marketData.changePercent}%
- **Trading Volume**: ${marketData.volume?.toLocaleString() || 'N/A'} shares
- **Sector**: ${instrumentData.sector || 'Diversified'}

## QUANTITATIVE ANALYSIS SCORES
${fundamentalData ? `
- **Technical Score**: ${fundamentalData.technicalScore}/100 (Price momentum, RSI, MACD analysis)
- **Fundamental Score**: ${fundamentalData.fundamentalScore}/100 (Valuation metrics, financial health)  
- **Momentum Score**: ${fundamentalData.momentumScore}/100 (Market sentiment, volume analysis)
- **Composite Score**: ${Math.round((fundamentalData.technicalScore * 0.4) + (fundamentalData.fundamentalScore * 0.35) + (fundamentalData.momentumScore * 0.25))}/100
` : '- Limited quantitative data available'}

## ANALYSIS REQUIREMENTS
Provide a comprehensive investment analysis structured as a valid JSON object with these exact keys:

- **"recommendation"**: String ("STRONG_BUY", "BUY", "HOLD", "SELL", or "STRONG_SELL")
- **"confidence"**: Number (70-95 based on data quality and market conditions)
- **"targetPrice"**: Number (calculated target based on analysis)
- **"stopLoss"**: Number (appropriate risk management level)
- **"investmentThesis"**: String (3-4 well-structured paragraphs with specific data points, market context, and quantitative backing. Include sector positioning, competitive advantages, and current market conditions impact. Reference trading volume of ${marketData.volume?.toLocaleString()} shares which indicates ${marketData.volume > 1000000 ? 'high institutional interest and liquidity' : marketData.volume > 100000 ? 'moderate liquidity and retail participation' : 'limited liquidity requiring careful position sizing'}.)
- **"keyStrengths"**: Array of strings (4-5 data-backed strengths with specific metrics, percentages, or quantitative evidence. Each should include concrete numbers or market references.)
- **"riskFactors"**: Array of strings (3-4 specific risks with market context, including sector headwinds, regulatory concerns, competitive pressures, or technical risk levels.)

## KEY ANALYSIS PRINCIPLES
1. **Data-Driven**: Every insight must reference specific metrics, scores, or market data
2. **Contextual**: Consider ${marketContext} conditions and sector dynamics  
3. **Quantitative**: Include actual numbers, percentages, and comparative analysis
4. **Professional**: Use institutional-grade terminology and professional assessment standards
5. **Actionable**: Provide concrete price targets and risk management levels

Base calculations on current price of ${currency} ${marketData.close} and available quantitative scores.

Output must be a single, valid JSON object with no additional text or formatting.
`
  }

  /**
   * Parse standard analysis response
   */
  private parseAnalysisResponse(analysisText: string, instrumentData: any): any {
    try {
      const parsedJson = JSON.parse(analysisText)
      return {
        action: parsedJson.recommendation || 'HOLD',
        targetPrice: parsedJson.targetPrice || null,
        stopLoss: parsedJson.stopLoss || null,
        timeHorizon: 'MEDIUM_TERM' as TimeHorizon,
        confidence: parsedJson.confidence || 75,
        rationale: parsedJson.investmentThesis || 'No rationale provided.',
        keyPoints: parsedJson.keyStrengths || [],
        risks: parsedJson.riskFactors || [],
        enhancedAnalysis: false,
        sources: [],
      }
    } catch (error) {
      this.logger.error('Failed to parse Claude JSON response', { error, analysisText })
      return this.generateFallbackAnalysis(instrumentData)
    }
  }

  /**
   * Generate fallback analysis when everything fails
   */
  private generateFallbackAnalysis(instrumentData: any): any {
    return {
      action: 'HOLD',
      targetPrice: null,
      stopLoss: null,
      timeHorizon: 'MEDIUM_TERM' as TimeHorizon,
      confidence: 50,
      rationale: `Basic analysis for ${instrumentData.symbol}. Professional analysis requires additional data and market context.`,
      keyPoints: [
        'Limited analysis due to technical constraints',
        'Consider fundamental analysis before investing',
        'Monitor market conditions and sector trends'
      ],
      risks: [
        'Market volatility',
        'Sector-specific risks',
        'Insufficient analysis data'
      ],
      enhancedAnalysis: false
    }
  }

  // Helper methods
  private calculateStopLoss(targetPrice: number, risks: any): number | null {
    if (!targetPrice) return null
    // Conservative 15% stop loss
    return Math.round(targetPrice * 0.85 * 100) / 100
  }

  private extractKeyPoints(analysis: any): string[] {
    const points: string[] = []
    
    if (analysis.valuation?.method) {
      points.push(`Valuation method: ${analysis.valuation.method}`)
    }
    if (analysis.valuation?.upside) {
      points.push(`Potential upside: ${analysis.valuation.upside}%`)
    }
    if (analysis.technicalAnalysis?.trend) {
      points.push(`Technical trend: ${analysis.technicalAnalysis.trend}`)
    }
    
    return points.length > 0 ? points : [
      'Professional analysis based on multiple factors',
      'Consider risk tolerance and investment horizon'
    ]
  }

  private extractKeyPointsFromText(text: string): string[] {
    // Simple extraction of bullet points or numbered items
    const points = text.match(/(?:•|\d\.)\s*([^.\n]+)/g)
    return points?.slice(0, 4).map(p => p.replace(/(?:•|\d\.)\s*/, '')) || [
      'Detailed analysis available in full report',
      'Consider multiple factors for investment decision'
    ]
  }

  private extractRisksFromText(text: string): string[] {
    const riskKeywords = ['risk', 'volatility', 'concern', 'challenge', 'uncertainty']
    const sentences = text.split(/[.!?]+/)
    
    const riskSentences = sentences.filter(sentence => 
      riskKeywords.some(keyword => 
        sentence.toLowerCase().includes(keyword)
      )
    ).slice(0, 3)

    return riskSentences.length > 0 ? riskSentences : [
      'Market volatility',
      'Sector-specific risks',
      'Economic uncertainty'
    ]
  }

  // Legacy methods for backward compatibility
  async generateRecommendation(
    symbol: string,
    price: number,
    volume: number,
    signal: SignalStrength,
    analysisType: AnalysisType = AnalysisType.FUNDAMENTAL,
    timeHorizon: TimeHorizon = TimeHorizon.MEDIUM_TERM
  ): Promise<any> {
    const instrumentData = { symbol, price, volume }
    const marketData = { close: price, volume, changePercent: 0 }
    
    return this.generateInstrumentAnalysis(instrumentData, marketData)
  }

  async generateMarketCommentary(marketData: any): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Provide brief market commentary based on: ${JSON.stringify(marketData)}`
        }]
      })

             return (response.content[0] as any)?.text || 'Market analysis in progress...'
    } catch (error) {
      return 'Market conditions require monitoring. Consider consulting financial advisors.'
    }
  }

  async assessPortfolioRisk(portfolioData: any): Promise<any> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Assess portfolio risk for: ${JSON.stringify(portfolioData)}`
        }]
      })

      return {
        riskLevel: 'MODERATE',
                 assessment: (response.content[0] as any)?.text || 'Portfolio assessment in progress...',
        recommendations: ['Diversification review', 'Risk monitoring']
      }
    } catch (error) {
      return {
        riskLevel: 'UNKNOWN',
        assessment: 'Risk assessment temporarily unavailable',
        recommendations: ['Consult financial advisor']
      }
    }
  }
} 