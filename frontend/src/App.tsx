import { Calculator } from './components/Calculator/Calculator.tsx'
import { apiCalculationService } from './services/apiCalculationService.ts'

function App() {
  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">Full-Stack Calculator</h1>
        <p className="app__subtitle">React frontend · Go API</p>
      </header>
      <Calculator calculate={apiCalculationService} />
    </main>
  )
}

export default App
