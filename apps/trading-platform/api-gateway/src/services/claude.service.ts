import { Anthropic } from '@anthropic-ai/sdk'
import { Logger } from 'winston'
import { AnalysisType, TimeHorizon, SignalStrength } from '@yobi/shared-types'

interface KnowledgeBaseClient {
  searchKnowledge(query: any): Promise<any>
  generateEnhancedAnalysis(context: any): Promise<any>
}

// Simple HTTP client for knowledge base
class SimpleKnowledgeClient implements KnowledgeBaseClient {
  private baseUrl: string

  constructor(baseUrl: string = 'http://localhost:3005') {
    this.baseUrl = baseUrl
  }

  async searchKnowledge(query: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/knowledge/search`, {
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
            return this.formatEnhancedAnalysis(enhancedResult.analysis)
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
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
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
  private formatEnhancedAnalysis(analysis: any): any {
    return {
      action: analysis.recommendation?.action || 'HOLD',
      targetPrice: analysis.recommendation?.targetPrice || analysis.valuation?.targetPrice,
      stopLoss: this.calculateStopLoss(analysis.recommendation?.targetPrice, analysis.risks),
      timeHorizon: analysis.recommendation?.timeHorizon || 'MEDIUM_TERM',
      confidence: analysis.recommendation?.confidence || 75,
      rationale: analysis.executiveSummary || 'Professional analysis based on CFA frameworks',
      keyPoints: analysis.keyInsights || this.extractKeyPoints(analysis),
      risks: analysis.risks?.keyRiskFactors || ['Market volatility', 'Sector-specific risks'],
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
    return `
As a financial analyst, provide an investment analysis for ${instrumentData.symbol}:

## Instrument Details
- Symbol: ${instrumentData.symbol}
- Name: ${instrumentData.name}
- Exchange: ${instrumentData.exchange}
- Sector: ${instrumentData.sector}

## Market Data
- Current Price: ${marketData.close}
- Change: ${marketData.changePercent}%
- Volume: ${marketData.volume}

## Fundamental Data
${fundamentalData ? `
- P/E Ratio: ${fundamentalData.peRatio}
- P/B Ratio: ${fundamentalData.pbRatio}
- ROE: ${fundamentalData.roe}%
- Debt/Equity: ${fundamentalData.debtToEquity}
` : 'Limited fundamental data available'}

Please provide:
1. Investment recommendation (STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL)
2. Target price with rationale
3. Key investment thesis points
4. Main risks to consider
5. Confidence level (1-100)

Format as structured analysis with clear reasoning.
`
  }

  /**
   * Parse standard analysis response
   */
  private parseAnalysisResponse(analysisText: string, instrumentData: any): any {
    // Try to extract structured information from text
    const actionMatch = analysisText.match(/(STRONG_BUY|BUY|HOLD|SELL|STRONG_SELL)/i)
    const priceMatch = analysisText.match(/target.*?(\d+(?:\.\d+)?)/i)
    const confidenceMatch = analysisText.match(/confidence.*?(\d+)/i)

    return {
      action: actionMatch?.[1]?.toUpperCase() || 'HOLD',
      targetPrice: priceMatch?.[1] ? parseFloat(priceMatch[1]) : null,
      stopLoss: null,
      timeHorizon: 'MEDIUM_TERM' as TimeHorizon,
      confidence: confidenceMatch?.[1] ? parseInt(confidenceMatch[1]) : 75,
      rationale: analysisText.length > 200 
        ? analysisText.substring(0, 200) + '...'
        : analysisText,
      keyPoints: this.extractKeyPointsFromText(analysisText),
      risks: this.extractRisksFromText(analysisText),
      enhancedAnalysis: false
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