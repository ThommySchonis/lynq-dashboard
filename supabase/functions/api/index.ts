import { Hono } from 'hono'
import { cors } from './middleware/cors.ts'
import { errorHandler } from './middleware/error-handler.ts'
import { healthRoutes } from './routes/health.ts'
import { profileRoutes } from './routes/profile.ts'

const app = new Hono().basePath('/api')

// Global middleware and error handling
app.use('*', cors)
app.onError(errorHandler)

// Routes
app.route('/health', healthRoutes)
app.route('/profile', profileRoutes)

Deno.serve(app.fetch)

export { app }
