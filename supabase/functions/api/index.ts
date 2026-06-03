import { Hono } from 'hono'
import { cors } from './middleware/cors.ts'
import { errorHandler } from './middleware/error-handler.ts'
import { healthRoutes } from './routes/health.ts'
import { profileRoutes } from './routes/profile.ts'
import { onboardingRoutes } from './routes/onboarding.ts'
import { settingsRoutes } from './routes/settings.ts'
import { workspaceRoutes } from './routes/workspaces.ts'
import { inboxRoutes } from './routes/inbox.ts'
import { authRoutes } from './routes/auth.ts'
import { emailDnsRoutes } from './routes/email-dns.ts'
import { marketplaceRoutes } from './routes/marketplace.ts'
import { examRoutes } from './routes/exams.ts'
import { lynqAdminRoutes } from './routes/lynq-admin.ts'
import { adminRoutes } from './routes/admin.ts'
import { inviteRoutes } from './routes/invites.ts'
import { inboxConversationRoutes } from './routes/inbox-conversations.ts'
import { shopifyRoutes } from './routes/shopify.ts'
import { billingRoutes } from './routes/billing.ts'
import { academyRoutes } from './routes/academy.ts'
import { analyticsExtraRoutes } from './routes/analytics-extra.ts'
import { macroRoutes } from './routes/macros.ts'
import { storeRoutes } from './routes/stores.ts'
import { parcelPanelRoutes, parcelPanelShipmentsRoutes } from './routes/parcel-panel.ts'
import { workspaceActionRoutes } from './routes/workspace-actions.ts'
import { cronRoutes } from './routes/cron.ts'
import { accountRoutes } from './routes/account.ts'

const app = new Hono().basePath('/api')

// Global middleware and error handling
app.use('*', cors)
app.onError(errorHandler)

// Routes
app.route('/health', healthRoutes)
app.route('/profile', profileRoutes)
app.route('/onboarding', onboardingRoutes)
app.route('/settings', settingsRoutes)
app.route('/workspaces', workspaceRoutes)
app.route('/inbox', inboxRoutes)
app.route('/auth', authRoutes)
app.route('/email/dns', emailDnsRoutes)
app.route('/marketplace', marketplaceRoutes)
app.route('/exams', examRoutes)
app.route('/lynq-admin', lynqAdminRoutes)
app.route('/admin', adminRoutes)
app.route('/invites', inviteRoutes)
app.route('/inbox/conversations', inboxConversationRoutes)
app.route('/shopify', shopifyRoutes)
app.route('/billing', billingRoutes)
app.route('/academy', academyRoutes)
app.route('/analytics', analyticsExtraRoutes)
app.route('/macros', macroRoutes)
app.route('/stores', storeRoutes)
app.route('/parcel-panel', parcelPanelRoutes)
app.route('/parcelpanel', parcelPanelShipmentsRoutes)
app.route('/workspaces/current', workspaceActionRoutes)
app.route('/cron', cronRoutes)
app.route('/account', accountRoutes)

Deno.serve(app.fetch)

export { app }
