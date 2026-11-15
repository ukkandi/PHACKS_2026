import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Home } from './views/Home'
import { Placeholder } from './views/Placeholder'
import { SimView } from './views/sim/SimView'
import { ResidentView } from './views/resident/ResidentView'
import { LedgerView } from './views/ledger/LedgerView'
import { TerminalView } from './views/terminal/TerminalView'
import { WardenView } from './views/warden/WardenView'
import { DemoLauncher } from './views/demo/DemoLauncher'
import { DirectorateView } from './views/ledger/DirectorateView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/resident" element={<ResidentView />} />
        <Route path="/sim" element={<SimView />} />
        <Route path="/demo" element={<DemoLauncher />} />
        <Route path="/terminal" element={<TerminalView />} />
        <Route path="/warden" element={<WardenView />} />
        <Route path="/ledger" element={<LedgerView />} />
        <Route path="/directorate" element={<DirectorateView />} />
        <Route path="*" element={<Placeholder view="404" phase={0} purpose="No such passage." />} />
      </Routes>
    </BrowserRouter>
  )
}
