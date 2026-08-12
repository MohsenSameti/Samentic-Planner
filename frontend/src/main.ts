import { createApp } from 'vue'
import App from './App.vue'
import { initPerformanceMonitoring } from './utils/performance'
import './style.css'

// Start the perf monitor immediately — it gets its start time
// before `createApp().mount()` so the page-load measurement
// captures Vue's compile/render work as well as the data fetch.
initPerformanceMonitoring()

createApp(App).mount('#app')
