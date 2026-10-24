import { createPinia } from 'pinia'
import { ViteSSG } from 'vite-ssg'
import App from './app'
import { createAppI18n, routes } from './locale'
import './theme/tokens.css'
import './theme/pins.css'
import './theme/fonts.css'
import './theme/typography.css'
import './theme/base.css'

// vite-ssg: при сборке — предрендер `/` и `/ru/` (FR11); в браузере — монтирование поверх статического HTML.
// Гидрации нет (hydration: false по умолчанию): клиент рисует с настоящим состоянием (тема, режим,
// брейкпоинт из localStorage/matchMedia), а не повторяет серверный снимок.
export const createApp = ViteSSG(App, { routes }, ({ app }) => {
  app.use(createPinia()).use(createAppI18n())
})
