import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Home } from './views/Home'
import { Placeholder } from './views/Placeholder'
import { SimView } from './views/sim/SimView'
import { ResidentView } from './views/resident/ResidentView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/resident" element={<ResidentView />} />
        <Route path="/sim" element={<SimView />} />
        <Route
          path="/terminal"
          element={<Placeholder view="terminal" phase={4} purpose="Shared level terminal check-in." />}
        />
        <Route
          path="/warden"
          element={<Placeholder view="warden" phase={4} purpose="Warden check-ins and verification." />}
        />
        <Route
          path="/ledger"
          element={<Placeholder view="ledger" phase={3} purpose="Anonymous public ledger of every level." />}
        />
        <Route
          path="/directorate"
          element={<Placeholder view="directorate" phase={3} purpose="Read-only Directorate view." />}
        />
        <Route path="*" element={<Placeholder view="404" phase={0} purpose="No such passage." />} />
      </Routes>
    </BrowserRouter>
  )
}
