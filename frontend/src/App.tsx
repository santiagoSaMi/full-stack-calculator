// TEMPORARY: swap for the API-backed service when the backend integration lands.
import { temporaryCalculationService } from './calculator/temporaryCalculationService.ts'
import { Calculator } from './components/Calculator/Calculator.tsx'

function App() {
  return (
    <main className="app">
      <h1>Full-Stack Calculator</h1>
      <Calculator calculate={temporaryCalculationService} />
    </main>
  )
}

export default App
