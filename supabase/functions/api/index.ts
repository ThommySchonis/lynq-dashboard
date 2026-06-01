import { Hono } from 'hono'
import { cors } from './middleware/cors.ts'
import { errorHandler } from './middleware/error-handler.ts'
import { healthRoutes } from './routes/health.ts'

const app = new Hono().basePath('/api')

// Global middleware and error handling
app.use('*', cors)
app.onError(errorHandler)

// Routes
app.route('/health', healthRoutes)

Deno.serve(app.fetch)

export { app }
