import { Router, type Router as RouterType } from 'express'
import axios from 'axios'
import { createLogger } from '../utils/logger'

const router: RouterType = Router()
const logger = createLogger('agent-routes')

const BACKGROUND_AGENT_URL = process.env.BACKGROUND_AGENT_URL || 'http://localhost:3008'

// Helper function to forward requests to background agent
const forwardToAgent = async (endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any) => {
  try {
    const response = await axios({
      method,
      url: `${BACKGROUND_AGENT_URL}${endpoint}`,
      data,
      timeout: 30000
    })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Agent service error: ${error.response?.data?.error || error.message}`)
    }
    throw error
  }
}

/**
 * @route GET /api/agent/status
 * @desc Get background agent status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await forwardToAgent('/agent/status')
    res.json(status)
  } catch (error) {
    logger.error('Failed to get agent status:', error)
    res.status(500).json({ 
      error: 'Failed to get agent status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * @route POST /api/agent/start
 * @desc Start background agent
 */
router.post('/start', async (req, res) => {
  try {
    const result = await forwardToAgent('/agent/start', 'POST')
    res.json(result)
  } catch (error) {
    logger.error('Failed to start agent:', error)
    res.status(500).json({ 
      error: 'Failed to start agent',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * @route POST /api/agent/stop
 * @desc Stop background agent
 */
router.post('/stop', async (req, res) => {
  try {
    const result = await forwardToAgent('/agent/stop', 'POST')
    res.json(result)
  } catch (error) {
    logger.error('Failed to stop agent:', error)
    res.status(500).json({ 
      error: 'Failed to stop agent',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * @route POST /api/agent/search/company/:symbol
 * @desc Search for company information
 */
router.post('/search/company/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params
    const { searchType = 'comprehensive' } = req.body

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' })
    }

    const results = await forwardToAgent(`/search/company/${symbol}`, 'POST', { searchType })
    res.json(results)
  } catch (error) {
    logger.error(`Failed to search for company ${req.params.symbol}:`, error)
    res.status(500).json({ 
      error: 'Company search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * @route POST /api/agent/fetch/documents/:symbol
 * @desc Fetch documents for a company
 */
router.post('/fetch/documents/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params
    const { documentTypes } = req.body

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' })
    }

    const results = await forwardToAgent(`/fetch/documents/${symbol}`, 'POST', { documentTypes })
    res.json(results)
  } catch (error) {
    logger.error(`Failed to fetch documents for ${req.params.symbol}:`, error)
    res.status(500).json({ 
      error: 'Document fetch failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * @route POST /api/agent/insights/generate/:symbol
 * @desc Generate insights for a company
 */
router.post('/insights/generate/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' })
    }

    const insights = await forwardToAgent(`/insights/generate/${symbol}`, 'POST')
    res.json(insights)
  } catch (error) {
    logger.error(`Failed to generate insights for ${req.params.symbol}:`, error)
    res.status(500).json({ 
      error: 'Insights generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * @route POST /api/agent/scheduler/start
 * @desc Start agent scheduler
 */
router.post('/scheduler/start', async (req, res) => {
  try {
    const result = await forwardToAgent('/scheduler/start', 'POST')
    res.json(result)
  } catch (error) {
    logger.error('Failed to start scheduler:', error)
    res.status(500).json({ 
      error: 'Failed to start scheduler',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * @route POST /api/agent/scheduler/stop
 * @desc Stop agent scheduler
 */
router.post('/scheduler/stop', async (req, res) => {
  try {
    const result = await forwardToAgent('/scheduler/stop', 'POST')
    res.json(result)
  } catch (error) {
    logger.error('Failed to stop scheduler:', error)
    res.status(500).json({ 
      error: 'Failed to stop scheduler',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * @route GET /api/agent/health
 * @desc Get agent service health
 */
router.get('/health', async (req, res) => {
  try {
    const health = await forwardToAgent('/health')
    res.json(health)
  } catch (error) {
    logger.error('Agent health check failed:', error)
    res.status(503).json({ 
      error: 'Agent service unavailable',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * @route POST /api/agent/task/add
 * @desc Add a task to the agent queue
 */
router.post('/task/add', async (req, res) => {
  try {
    const { type, symbol, priority = 'MEDIUM', options } = req.body

    if (!type) {
      return res.status(400).json({ error: 'Task type is required' })
    }

    const validTypes = ['COMPANY_ANALYSIS', 'DOCUMENT_DISCOVERY', 'INSIGHT_GENERATION', 'MARKET_SCAN']
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid task type',
        validTypes
      })
    }

    // Forward to background agent's task addition endpoint
    const task = {
      type,
      symbol,
      priority,
      options
    }

    // Since the BackgroundAgent.addTask is internal, we'll create a simple proxy
    // The agent service would need to expose an endpoint for this
    const response = await axios.post(`${BACKGROUND_AGENT_URL}/task/add`, task, {
      timeout: 10000
    })

    res.json(response.data)
  } catch (error) {
    logger.error('Failed to add task:', error)
    res.status(500).json({ 
      error: 'Failed to add task',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * @route GET /api/agent/tasks/queue
 * @desc Get current task queue status
 */
router.get('/tasks/queue', async (req, res) => {
  try {
    // This would need to be implemented in the background agent service
    const queueStatus = await forwardToAgent('/tasks/queue')
    res.json(queueStatus)
  } catch (error) {
    logger.error('Failed to get queue status:', error)
    res.status(500).json({ 
      error: 'Failed to get queue status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * @route GET /api/agent/insights/:symbol
 * @desc Get cached insights for a symbol
 */
router.get('/insights/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' })
    }

    // This would retrieve cached insights from Redis or database
    const insights = await forwardToAgent(`/insights/${symbol}`)
    res.json(insights)
  } catch (error) {
    logger.error(`Failed to get insights for ${req.params.symbol}:`, error)
    res.status(500).json({ 
      error: 'Failed to get insights',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * @route GET /api/agent/documents/:symbol
 * @desc Get cached documents for a symbol
 */
router.get('/documents/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' })
    }

    const documents = await forwardToAgent(`/documents/${symbol}`)
    res.json(documents)
  } catch (error) {
    logger.error(`Failed to get documents for ${req.params.symbol}:`, error)
    res.status(500).json({ 
      error: 'Failed to get documents',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * @route POST /api/agent/config/update
 * @desc Update agent configuration
 */
router.post('/config/update', async (req, res) => {
  try {
    const config = req.body

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Valid configuration object is required' })
    }

    const result = await forwardToAgent('/config/update', 'POST', config)
    res.json(result)
  } catch (error) {
    logger.error('Failed to update configuration:', error)
    res.status(500).json({ 
      error: 'Failed to update configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router 