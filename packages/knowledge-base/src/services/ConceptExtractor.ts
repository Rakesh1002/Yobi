import { FinancialConcept, ConceptCategory } from '../types'
import { Logger } from 'winston'
import { Anthropic } from '@anthropic-ai/sdk'

export class ConceptExtractor {
  private logger: Logger
  private anthropic?: Anthropic
  private conceptPatterns!: Map<ConceptCategory, RegExp[]>

  constructor(logger: Logger, anthropicApiKey?: string) {
    this.logger = logger
    
    if (anthropicApiKey || process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: anthropicApiKey || process.env.ANTHROPIC_API_KEY
      })
    }

    this.initializeConceptPatterns()
  }

  /**
   * Extract financial concepts from text content
   */
  async extractConcepts(content: string, suggestedTopics: string[] = []): Promise<FinancialConcept[]> {
    try {
      // First, extract concepts using pattern matching
      const patternConcepts = this.extractConceptsByPatterns(content)
      
      // If Claude is available, enhance with AI extraction
      let aiConcepts: FinancialConcept[] = []
      if (this.anthropic && content.length > 200) {
        try {
          aiConcepts = await this.extractConceptsWithAI(content, suggestedTopics)
        } catch (error) {
          this.logger.warn('AI concept extraction failed, falling back to patterns only', { error })
        }
      }

      // Merge and deduplicate concepts
      const allConcepts = this.mergeConcepts(patternConcepts, aiConcepts)
      
      this.logger.debug('Extracted concepts', {
        patternCount: patternConcepts.length,
        aiCount: aiConcepts.length,
        totalUnique: allConcepts.length,
        contentLength: content.length
      })

      return allConcepts

    } catch (error) {
      this.logger.error('Concept extraction failed', { error })
      return []
    }
  }

  /**
   * Extract concepts using predefined patterns
   */
  private extractConceptsByPatterns(content: string): FinancialConcept[] {
    const concepts: FinancialConcept[] = []
    const contentLower = content.toLowerCase()

    // Check each category's patterns
    for (const [category, patterns] of this.conceptPatterns.entries()) {
      for (const pattern of patterns) {
        const matches = content.match(pattern)
        if (matches) {
          for (const match of matches) {
            const concept = this.createConceptFromPattern(match, category, content)
            if (concept) {
              concepts.push(concept)
            }
          }
        }
      }
    }

    return this.deduplicateConcepts(concepts)
  }

  /**
   * Extract concepts using Claude AI
   */
  private async extractConceptsWithAI(content: string, suggestedTopics: string[]): Promise<FinancialConcept[]> {
    if (!this.anthropic) {
      return []
    }

    try {
      const prompt = this.buildConceptExtractionPrompt(content, suggestedTopics)
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })

      const responseText = (response.content[0] as any)?.text || ''
      return this.parseAIConceptResponse(responseText)

    } catch (error) {
      this.logger.error('AI concept extraction failed', { error })
      return []
    }
  }

  /**
   * Initialize pattern-based concept recognition
   */
  private initializeConceptPatterns(): void {
    this.conceptPatterns = new Map()

    // Valuation patterns
    this.conceptPatterns.set(ConceptCategory.VALUATION, [
      /\b(DCF|discounted cash flow)\b/gi,
      /\b(P\/E|price.to.earnings|price.earnings)\b/gi,
      /\b(P\/B|price.to.book|price.book)\b/gi,
      /\b(EV\/EBITDA|enterprise value)\b/gi,
      /\b(intrinsic value|fair value)\b/gi,
      /\b(dividend discount model|DDM)\b/gi,
      /\b(residual income|economic value added|EVA)\b/gi,
      /\b(terminal value|perpetuity)\b/gi
    ])

    // Ratio Analysis patterns
    this.conceptPatterns.set(ConceptCategory.RATIO_ANALYSIS, [
      /\b(current ratio|quick ratio|cash ratio)\b/gi,
      /\b(debt.to.equity|debt.equity|D\/E)\b/gi,
      /\b(return on equity|ROE)\b/gi,
      /\b(return on assets|ROA)\b/gi,
      /\b(gross margin|operating margin|net margin)\b/gi,
      /\b(asset turnover|inventory turnover)\b/gi,
      /\b(interest coverage|times interest earned)\b/gi,
      /\b(working capital|acid test)\b/gi
    ])

    // Risk Metrics patterns
    this.conceptPatterns.set(ConceptCategory.RISK_METRICS, [
      /\b(beta|systematic risk)\b/gi,
      /\b(standard deviation|volatility)\b/gi,
      /\b(VaR|value at risk)\b/gi,
      /\b(CVaR|conditional value at risk)\b/gi,
      /\b(sharpe ratio|information ratio)\b/gi,
      /\b(treynor ratio|jensen's alpha)\b/gi,
      /\b(downside deviation|maximum drawdown)\b/gi,
      /\b(tracking error|active risk)\b/gi
    ])

    // Portfolio Theory patterns
    this.conceptPatterns.set(ConceptCategory.PORTFOLIO_THEORY, [
      /\b(CAPM|capital asset pricing model)\b/gi,
      /\b(efficient frontier|modern portfolio theory|MPT)\b/gi,
      /\b(diversification|correlation)\b/gi,
      /\b(asset allocation|strategic allocation)\b/gi,
      /\b(factor model|multifactor)\b/gi,
      /\b(alpha|beta|security market line)\b/gi,
      /\b(mean variance|utility function)\b/gi,
      /\b(risk parity|equal weighting)\b/gi
    ])

    // Fixed Income patterns
    this.conceptPatterns.set(ConceptCategory.FIXED_INCOME_ANALYSIS, [
      /\b(duration|modified duration|effective duration)\b/gi,
      /\b(convexity|negative convexity)\b/gi,
      /\b(yield to maturity|YTM|current yield)\b/gi,
      /\b(credit spread|option adjusted spread|OAS)\b/gi,
      /\b(yield curve|term structure)\b/gi,
      /\b(default risk|credit risk)\b/gi,
      /\b(callable bond|putable bond)\b/gi,
      /\b(immunization|matching)\b/gi
    ])

    // Economics patterns
    this.conceptPatterns.set(ConceptCategory.ECONOMICS, [
      /\b(GDP|gross domestic product)\b/gi,
      /\b(inflation|deflation|CPI)\b/gi,
      /\b(monetary policy|fiscal policy)\b/gi,
      /\b(business cycle|recession|expansion)\b/gi,
      /\b(supply.demand|elasticity)\b/gi,
      /\b(exchange rate|currency)\b/gi,
      /\b(central bank|federal reserve|fed)\b/gi,
      /\b(unemployment|labor market)\b/gi
    ])

    // Statistics patterns
    this.conceptPatterns.set(ConceptCategory.STATISTICS, [
      /\b(normal distribution|t.distribution)\b/gi,
      /\b(confidence interval|hypothesis test)\b/gi,
      /\b(regression|correlation|R.squared)\b/gi,
      /\b(mean|median|standard deviation)\b/gi,
      /\b(skewness|kurtosis|outlier)\b/gi,
      /\b(monte carlo|simulation)\b/gi,
      /\b(p.value|significance|alpha)\b/gi,
      /\b(central limit theorem|sampling)\b/gi
    ])
  }

  /**
   * Create concept from pattern match
   */
  private createConceptFromPattern(
    match: string, 
    category: ConceptCategory, 
    context: string
  ): FinancialConcept | null {
    const name = match.trim()
    
    // Skip very short matches
    if (name.length < 3) return null

    return {
      name: this.normalizeName(name),
      definition: this.generateDefinition(name, category),
      category,
      relatedConcepts: this.findRelatedConcepts(name, context),
      formulas: this.extractRelatedFormulas(name, context),
      applications: this.getApplications(name, category)
    }
  }

  /**
   * Build prompt for AI concept extraction
   */
  private buildConceptExtractionPrompt(content: string, suggestedTopics: string[]): string {
    const truncatedContent = content.length > 3000 ? content.substring(0, 3000) + '...' : content
    
    return `
Analyze the following financial text and extract key financial concepts. For each concept, provide:
1. Name (standardized)
2. Brief definition 
3. Category (VALUATION, RATIO_ANALYSIS, RISK_METRICS, PORTFOLIO_THEORY, DERIVATIVES_PRICING, FIXED_INCOME_ANALYSIS, EQUITY_ANALYSIS, ECONOMICS, STATISTICS)
4. Related concepts
5. Any formulas mentioned
6. Practical applications

Suggested topics: ${suggestedTopics.join(', ')}

Text:
${truncatedContent}

Respond in JSON format:
{
  "concepts": [
    {
      "name": "concept name",
      "definition": "brief definition",
      "category": "CATEGORY",
      "relatedConcepts": ["related1", "related2"],
      "formulas": ["formula1", "formula2"],
      "applications": ["application1", "application2"]
    }
  ]
}
`
  }

  /**
   * Parse AI response into concept objects
   */
  private parseAIConceptResponse(responseText: string): FinancialConcept[] {
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        this.logger.warn('No JSON found in AI response')
        return []
      }

      const parsed = JSON.parse(jsonMatch[0])
      const concepts: FinancialConcept[] = []

      if (parsed.concepts && Array.isArray(parsed.concepts)) {
        for (const conceptData of parsed.concepts) {
          if (this.isValidConceptData(conceptData)) {
            concepts.push({
              name: conceptData.name,
              definition: conceptData.definition,
              category: conceptData.category as ConceptCategory,
              relatedConcepts: conceptData.relatedConcepts || [],
              formulas: conceptData.formulas || [],
              applications: conceptData.applications || []
            })
          }
        }
      }

      return concepts

    } catch (error) {
      this.logger.error('Failed to parse AI concept response', { error, responseText })
      return []
    }
  }

  /**
   * Validate concept data from AI
   */
  private isValidConceptData(data: any): boolean {
    return (
      data &&
      typeof data.name === 'string' &&
      typeof data.definition === 'string' &&
      typeof data.category === 'string' &&
      Object.values(ConceptCategory).includes(data.category)
    )
  }

  /**
   * Merge and deduplicate concepts from different sources
   */
  private mergeConcepts(
    patternConcepts: FinancialConcept[],
    aiConcepts: FinancialConcept[]
  ): FinancialConcept[] {
    const conceptMap = new Map<string, FinancialConcept>()

    // Add pattern concepts first
    for (const concept of patternConcepts) {
      const key = this.getConceptKey(concept.name)
      conceptMap.set(key, concept)
    }

    // Add AI concepts, merging with existing if similar
    for (const concept of aiConcepts) {
      const key = this.getConceptKey(concept.name)
      const existing = conceptMap.get(key)

      if (existing) {
        // Merge concepts, preferring AI definitions but keeping pattern formulas
        conceptMap.set(key, {
          ...existing,
          definition: concept.definition || existing.definition,
          relatedConcepts: [...new Set([...existing.relatedConcepts, ...concept.relatedConcepts])],
          formulas: [...new Set([...existing.formulas || [], ...concept.formulas || []])],
          applications: [...new Set([...existing.applications, ...concept.applications])]
        })
      } else {
        conceptMap.set(key, concept)
      }
    }

    return Array.from(conceptMap.values())
  }

  /**
   * Remove duplicate concepts
   */
  private deduplicateConcepts(concepts: FinancialConcept[]): FinancialConcept[] {
    const seen = new Set<string>()
    return concepts.filter(concept => {
      const key = this.getConceptKey(concept.name)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  /**
   * Generate concept key for deduplication
   */
  private getConceptKey(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  /**
   * Normalize concept name
   */
  private normalizeName(name: string): string {
    return name.trim()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  /**
   * Generate basic definition for pattern-matched concepts
   */
  private generateDefinition(name: string, category: ConceptCategory): string {
    const nameLower = name.toLowerCase()
    
    // Basic definitions for common concepts
    const definitions: Record<string, string> = {
      'dcf': 'Discounted Cash Flow - A valuation method that estimates the value of an investment based on expected future cash flows.',
      'p/e': 'Price-to-Earnings ratio - A valuation ratio comparing a company\'s current share price to its per-share earnings.',
      'beta': 'A measure of systematic risk, indicating how much a security\'s price moves relative to the market.',
      'wacc': 'Weighted Average Cost of Capital - The average rate a company expects to pay to finance its assets.',
      'roe': 'Return on Equity - A measure of financial performance calculated as net income divided by shareholder equity.',
      'duration': 'A measure of the price sensitivity of a bond to changes in interest rates.',
      'var': 'Value at Risk - A statistical measure of the potential loss on an investment over a specific time period.'
    }
    
    const key = nameLower.replace(/[^a-z]/g, '')
    return definitions[key] || `Financial concept in ${category.toLowerCase().replace(/_/g, ' ')}`
  }

  /**
   * Find related concepts in context
   */
  private findRelatedConcepts(name: string, context: string): string[] {
    const related: string[] = []
    
    // Look for other financial terms in the same context
    const contextLower = context.toLowerCase()
    const patterns = Array.from(this.conceptPatterns.values()).flat()
    
    for (const pattern of patterns) {
      const matches = context.match(pattern)
      if (matches) {
        related.push(...matches.filter(match => 
          match.toLowerCase() !== name.toLowerCase() && match.length > 2
        ))
      }
    }
    
    return [...new Set(related)].slice(0, 5) // Limit to 5 related concepts
  }

  /**
   * Extract formulas related to a concept
   */
  private extractRelatedFormulas(name: string, context: string): string[] {
    const formulas: string[] = []
    
    // Look for formula patterns near the concept
    const formulaPatterns = [
      /[A-Z]\s*=\s*[^.]{10,100}/g,
      /\([^)]*[+\-*/÷×][^)]*\)/g,
      /\$[^$]+\$/g
    ]
    
    for (const pattern of formulaPatterns) {
      const matches = context.match(pattern)
      if (matches) {
        formulas.push(...matches)
      }
    }
    
    return formulas.slice(0, 3) // Limit to 3 formulas
  }

  /**
   * Get applications for a concept category
   */
  private getApplications(name: string, category: ConceptCategory): string[] {
    const applications: Record<ConceptCategory, string[]> = {
      [ConceptCategory.VALUATION]: ['Stock analysis', 'Investment decisions', 'Corporate finance'],
      [ConceptCategory.RATIO_ANALYSIS]: ['Financial statement analysis', 'Credit analysis', 'Performance evaluation'],
      [ConceptCategory.RISK_METRICS]: ['Risk management', 'Portfolio optimization', 'Regulatory compliance'],
      [ConceptCategory.PORTFOLIO_THEORY]: ['Asset allocation', 'Portfolio construction', 'Performance attribution'],
      [ConceptCategory.DERIVATIVES_PRICING]: ['Options pricing', 'Hedging strategies', 'Risk management'],
      [ConceptCategory.FIXED_INCOME_ANALYSIS]: ['Bond valuation', 'Interest rate risk', 'Credit analysis'],
      [ConceptCategory.EQUITY_ANALYSIS]: ['Stock valuation', 'Sector analysis', 'Investment research'],
      [ConceptCategory.ECONOMICS]: ['Market analysis', 'Policy evaluation', 'Forecasting'],
      [ConceptCategory.STATISTICS]: ['Data analysis', 'Model validation', 'Hypothesis testing']
    }
    
    return applications[category] || ['Financial analysis']
  }
} 