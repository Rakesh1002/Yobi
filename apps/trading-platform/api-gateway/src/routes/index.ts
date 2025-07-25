import { Router } from 'express'
import authRoutes from './auth.routes'
import rankingsRoutes from './rankings.routes'
import instrumentsRoutes from './instruments.routes'
import currencyRoutes from './currency.routes'
import analysisRoutes from './analysis.routes'
import portfolioRoutes from './portfolio.routes'
import knowledgeRoutes from './knowledge.routes'
import documentsRoutes from './documents.routes'
import marketRoutes from './market.routes'
import agentRoutes from './agent.routes'
import alertsRoutes from './alerts.routes'

const router: Router = Router()

// Mount all route modules
router.use('/auth', authRoutes)
router.use('/rankings', rankingsRoutes)
router.use('/instruments', instrumentsRoutes)
router.use('/currency', currencyRoutes)
router.use('/analysis', analysisRoutes)
router.use('/portfolio', portfolioRoutes)
router.use('/knowledge', knowledgeRoutes)
router.use('/documents', documentsRoutes)
router.use('/market', marketRoutes)
router.use('/agent', agentRoutes)
router.use('/alerts', alertsRoutes)

export default router 