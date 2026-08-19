import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@/styles/index.css'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import { AppStoreProvider } from '@/stores/AppStore'
import { App } from '@/App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AppStoreProvider>
        <App />
      </AppStoreProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
)
