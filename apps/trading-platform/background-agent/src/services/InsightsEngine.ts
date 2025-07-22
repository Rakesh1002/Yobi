import Anthropic from '@anthropic-ai/sdk'
import { createLogger } from '../utils/logger'

const logger = createLogger('insights-engine')

export interface InsightData {
  symbol: string
  insights: Insight[]
  confidence: number
  dataQuality: DataQuality
  executiveSummary: string
  sources: SourceInfo[]
  generatedAt: Date
}

export interface Insight {
  type: 'FINANCIAL' | 'STRATEGIC' | 'RISK' | 'OPPORTUNITY' | 'MARKET_SENTIMENT'
  title: string
  description: string
  confidence: number
  impact: 'HIGH' | 'MEDIUM' | 'LOW'
  timeframe: 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM'
  actionable: boolean
  recommendation?: string
}

export interface DataQuality {
  completeness: number
  recency: number
  reliability: number
  coverage: string[]
  gaps: string[]
}

export interface SourceInfo {
  type: 'SEARCH' | 'DOCUMENT' | 'MARKET_DATA'
  count: number
  latestDate?: Date
  quality: number
}

export class InsightsEngine {
  private anthropic: Anthropic | null = null
  private isEnabled: boolean = false

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    
    if (!apiKey) {
      logger.warn('ANTHROPIC_API_KEY not provided - insights generation will be disabled')
      logger.warn('To enable AI insights, set ANTHROPIC_API_KEY in your environment')
      this.isEnabled = false
    } else {
      try {
        this.anthropic = new Anthropic({
          apiKey: apiKey
        })
        this.isEnabled = true
        logger.info('InsightsEngine initialized successfully with Anthropic API')
      } catch (error) {
        logger.error('Failed to initialize Anthropic client:', error)
        this.isEnabled = false
      }
    }
  }

  /**
   * Generate comprehensive investment insights
   */
  async generateInsights(
    symbol: string,
    documents: any[] = [],
    searchResults: any[] = [],
    marketData: any = null
  ): Promise<InsightData> {
    if (!this.isEnabled) {
      logger.warn(`Insights generation disabled for ${symbol} - missing API key`)
      return this.createFallbackInsights(symbol, documents, searchResults)
    }

    try {
      logger.info(`Generating insights for ${symbol}`)

      // Assess data quality
      const dataQuality = this.assessDataQuality(documents, searchResults, marketData)
      
      // Prepare context for AI
      const context = this.prepareContext(symbol, documents, searchResults, marketData)
      
      // Generate AI insights
      const insights = await this.generateAIInsights(context, symbol)
      
      // Create source information
      const sources = this.createSourceInfo(documents, searchResults, marketData)
      
      // Calculate overall confidence
      const confidence = this.calculateConfidence(dataQuality, insights)
      
      // Generate executive summary
      const executiveSummary = await this.generateExecutiveSummary(symbol, insights, confidence)

      return {
        symbol,
        insights,
        confidence,
        dataQuality,
        executiveSummary,
        sources,
        generatedAt: new Date()
      }
    } catch (error) {
      logger.error(`Failed to generate insights for ${symbol}:`, error)
      return this.createFallbackInsights(symbol, documents, searchResults)
    }
  }

  /**
   * Create fallback insights when AI is unavailable
   */
  private createFallbackInsights(symbol: string, documents: any[], searchResults: any[]): InsightData {
    const insights: Insight[] = [
      {
        type: 'FINANCIAL',
        title: 'Data Collection Completed',
        description: `Successfully collected ${documents.length} documents and ${searchResults.length} search results for ${symbol}`,
        confidence: 0.8,
        impact: 'MEDIUM',
        timeframe: 'SHORT_TERM',
        actionable: false,
        recommendation: 'Configure ANTHROPIC_API_KEY to enable AI-powered insights'
      }
    ]

    const dataQuality: DataQuality = {
      completeness: documents.length > 0 ? 0.7 : 0.3,
      recency: searchResults.length > 0 ? 0.8 : 0.2,
      reliability: 0.6,
      coverage: ['search_results', 'documents'],
      gaps: ['ai_analysis']
    }

    return {
      symbol,
      insights,
      confidence: 0.5,
      dataQuality,
      executiveSummary: `Data collection completed for ${symbol}. ${documents.length} documents and ${searchResults.length} search results gathered. Enable AI analysis by configuring ANTHROPIC_API_KEY.`,
      sources: this.createSourceInfo(documents, searchResults, null),
      generatedAt: new Date()
    }
  }

  /**
   * Generate AI-powered insights using Claude
   */
  private async generateAIInsights(context: string, symbol: string): Promise<Insight[]> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized')
    }

    const prompt = `
    As a financial analyst, analyze the following information about ${symbol} and provide investment insights.

    Context:
    ${context}

    Please provide insights in the following categories:
    1. FINANCIAL - Financial performance and metrics analysis
    2. STRATEGIC - Business strategy and competitive positioning
    3. RISK - Risk factors and potential concerns
    4. OPPORTUNITY - Growth opportunities and catalysts
    5. MARKET_SENTIMENT - Market perception and sentiment

    For each insight, include:
    - Clear title and description
    - Confidence level (0-1)
    - Impact level (HIGH/MEDIUM/LOW)
    - Time frame (SHORT_TERM/MEDIUM_TERM/LONG_TERM)
    - Whether it's actionable
    - Specific recommendation if applicable

    Format as structured analysis focusing on actionable investment insights.
    `

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })

      const content = response.content[0]
      if (!content || content.type !== 'text') {
        throw new Error('Unexpected response format from Claude')
      }

      return this.parseAIResponse((content as any).text)
    } catch (error) {
      logger.error('Failed to generate AI insights:', error)
      throw error
    }
  }

  /**
   * Parse AI response into structured insights
   */
  private parseAIResponse(response: string): Insight[] {
    const insights: Insight[] = []
    
    try {
      // Simple parsing - in production, you might want more sophisticated parsing
      const sections = response.split('\n\n')
      
      sections.forEach(section => {
        if (section.trim()) {
          insights.push({
            type: this.determineInsightType(section),
            title: this.extractTitle(section),
            description: this.extractDescription(section),
            confidence: this.extractConfidence(section),
            impact: this.extractImpact(section),
            timeframe: this.extractTimeframe(section),
            actionable: this.isActionable(section),
            recommendation: this.extractRecommendation(section)
          })
        }
      })
    } catch (error) {
      logger.error('Failed to parse AI response:', error)
      // Return a basic insight if parsing fails
      insights.push({
        type: 'FINANCIAL',
        title: 'AI Analysis Completed',
        description: 'Financial analysis completed with available data',
        confidence: 0.7,
        impact: 'MEDIUM',
        timeframe: 'MEDIUM_TERM',
        actionable: true,
        recommendation: 'Review detailed analysis for specific insights'
      })
    }

    return insights.length > 0 ? insights : [{
      type: 'FINANCIAL',
      title: 'Analysis Unavailable',
      description: 'Unable to generate insights at this time',
      confidence: 0.3,
      impact: 'LOW',
      timeframe: 'SHORT_TERM',
      actionable: false
    }]
  }

  /**
   * Generate executive summary
   */
  private async generateExecutiveSummary(symbol: string, insights: Insight[], confidence: number): Promise<string> {
    if (!this.anthropic) {
      return `Analysis summary for ${symbol}: ${insights.length} insights generated with ${Math.round(confidence * 100)}% confidence.`
    }

    try {
      const insightsSummary = insights.map(i => `${i.type}: ${i.title} (${i.impact} impact)`).join('; ')
      
      const prompt = `
      Create a concise executive summary for ${symbol} based on these insights:
      ${insightsSummary}
      
      Overall confidence: ${Math.round(confidence * 100)}%
      
      Provide a 2-3 sentence executive summary suitable for investment decision-making.
      `

      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })

      const content = response.content[0]
      if (content && content.type === 'text') {
        return (content as any).text.trim()
      }
    } catch (error) {
      logger.error('Failed to generate executive summary:', error)
    }

    return `Investment analysis for ${symbol} completed with ${insights.length} key insights identified. Overall confidence level: ${Math.round(confidence * 100)}%.`
  }

  /**
   * Helper methods for parsing AI responses
   */
  private determineInsightType(section: string): Insight['type'] {
    const text = section.toLowerCase()
    if (text.includes('financial') || text.includes('revenue') || text.includes('earnings')) return 'FINANCIAL'
    if (text.includes('strategic') || text.includes('strategy') || text.includes('competitive')) return 'STRATEGIC'
    if (text.includes('risk') || text.includes('concern') || text.includes('threat')) return 'RISK'
    if (text.includes('opportunity') || text.includes('growth') || text.includes('catalyst')) return 'OPPORTUNITY'
    if (text.includes('sentiment') || text.includes('market') || text.includes('perception')) return 'MARKET_SENTIMENT'
    return 'FINANCIAL'
  }

  private extractTitle(section: string): string {
    const lines = section.split('\n')
    return lines[0]?.trim() || 'Investment Insight'
  }

  private extractDescription(section: string): string {
    const lines = section.split('\n')
    return lines.slice(1).join(' ').trim() || 'Analysis insight generated'
  }

  private extractConfidence(section: string): number {
    const match = section.match(/confidence[:\s]+(\d+(?:\.\d+)?)/i)
    return match && match[1] ? Math.min(1, Math.max(0, parseFloat(match[1]))) : 0.7
  }

  private extractImpact(section: string): Insight['impact'] {
    const text = section.toLowerCase()
    if (text.includes('high impact') || text.includes('significant')) return 'HIGH'
    if (text.includes('low impact') || text.includes('minor')) return 'LOW'
    return 'MEDIUM'
  }

  private extractTimeframe(section: string): Insight['timeframe'] {
    const text = section.toLowerCase()
    if (text.includes('short') || text.includes('immediate') || text.includes('near-term')) return 'SHORT_TERM'
    if (text.includes('long') || text.includes('long-term')) return 'LONG_TERM'
    return 'MEDIUM_TERM'
  }

  private isActionable(section: string): boolean {
    const text = section.toLowerCase()
    return text.includes('recommend') || text.includes('should') || text.includes('action')
  }

  private extractRecommendation(section: string): string | undefined {
    const lines = section.split('\n')
    const recLine = lines.find(line => line.toLowerCase().includes('recommend'))
    return recLine?.trim()
  }

  /**
   * Assess data quality
   */
  private assessDataQuality(documents: any[], searchResults: any[], marketData: any): DataQuality {
    const completeness = Math.min(1, (documents.length * 0.3 + searchResults.length * 0.1) / 2)
    const recency = searchResults.length > 0 ? 0.8 : 0.5
    const reliability = documents.length > 0 ? 0.9 : 0.6
    
    const coverage = []
    if (documents.length > 0) coverage.push('documents')
    if (searchResults.length > 0) coverage.push('web_search')
    if (marketData) coverage.push('market_data')
    
    const gaps = []
    if (documents.length === 0) gaps.push('official_filings')
    if (searchResults.length === 0) gaps.push('current_news')
    if (!marketData) gaps.push('real_time_data')

    return {
      completeness,
      recency,
      reliability,
      coverage,
      gaps
    }
  }

  /**
   * Prepare context for AI analysis
   */
  private prepareContext(symbol: string, documents: any[], searchResults: any[], marketData: any): string {
    let context = `Company: ${symbol}\n\n`
    
    if (searchResults.length > 0) {
      context += `Recent News and Information:\n`
      searchResults.slice(0, 10).forEach((result: any) => {
        context += `- ${result.title}: ${result.snippet}\n`
      })
      context += '\n'
    }
    
    if (documents.length > 0) {
      context += `Official Documents (${documents.length} found):\n`
      documents.slice(0, 5).forEach((doc: any) => {
        context += `- ${doc.title} (${doc.type})\n`
      })
      context += '\n'
    }
    
    if (marketData) {
      context += `Market Data: Recent activity detected\n\n`
    }

    return context
  }

  /**
   * Create source information
   */
  private createSourceInfo(documents: any[], searchResults: any[], marketData: any): SourceInfo[] {
    const sources: SourceInfo[] = []
    
    if (searchResults.length > 0) {
      sources.push({
        type: 'SEARCH',
        count: searchResults.length,
        latestDate: new Date(),
        quality: 0.8
      })
    }
    
    if (documents.length > 0) {
      sources.push({
        type: 'DOCUMENT',
        count: documents.length,
        quality: 0.9
      })
    }
    
    if (marketData) {
      sources.push({
        type: 'MARKET_DATA',
        count: 1,
        latestDate: marketData.lastUpdate,
        quality: 0.95
      })
    }

    return sources
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(dataQuality: DataQuality, insights: Insight[]): number {
    const dataConfidence = (dataQuality.completeness + dataQuality.recency + dataQuality.reliability) / 3
    const insightConfidence = insights.length > 0 
      ? insights.reduce((sum, insight) => sum + insight.confidence, 0) / insights.length 
      : 0.5
    
    return (dataConfidence + insightConfidence) / 2
  }

  /**
   * Check if insights engine is enabled
   */
  isInsightsEnabled(): boolean {
    return this.isEnabled
  }
} 