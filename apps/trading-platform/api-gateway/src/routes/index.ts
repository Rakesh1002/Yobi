import { Router, type Router as RouterType } from 'express'
import authRoutes from './auth.routes'
import analysisRoutes from './analysis.routes'
import currencyRoutes from './currency.routes'
import documentsRoutes from './documents.routes'
import instrumentsRoutes from './instruments.routes'
import knowledgeRoutes from './knowledge.routes'
import marketRoutes from './market.routes'
import portfolioRoutes from './portfolio.routes'
import rankingsRoutes from './rankings.routes'
import agentRoutes from './agent.routes'

const router: RouterType = Router()

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'api-gateway'
  })
})

// Mount routes
router.use('/auth', authRoutes)
router.use('/analysis', analysisRoutes)
router.use('/currency', currencyRoutes)
router.use('/documents', documentsRoutes)
router.use('/instruments', instrumentsRoutes)
router.use('/knowledge', knowledgeRoutes)
router.use('/market', marketRoutes)
router.use('/portfolio', portfolioRoutes)
router.use('/rankings', rankingsRoutes)
router.use('/agent', agentRoutes)

export default router 