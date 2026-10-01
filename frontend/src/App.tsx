import { Calculator } from './components/Calculator/Calculator.tsx'
import { apiCalculationService } from './services/apiCalculationService.ts'

function App() {
  return (
    <main className="app">
      <h1>Full-Stack Calculator</h1>
      <Calculator calculate={apiCalculationService} />
    </main>
  )
}

export default App
