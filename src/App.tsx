import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ExplorerHome from './pages/ExplorerHome';
import BlockDetail from './pages/BlockDetail';
import TxDetail from './pages/TxDetail';
import AddressDetail from './pages/AddressDetail';
import WalletDashboard from './pages/WalletDashboard'; // New
import { NetworkProvider } from './utils/Api';
import { WalletProvider } from './utils/Wallet';

function App() {
  return (
    <NetworkProvider>
      <WalletProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-gray-900 text-white flex flex-col">
            <Header />
            <div className="flex flex-1">
              <Sidebar />
              <main className="flex-1 p-8 overflow-auto">
                <Routes>
                  <Route path="/" element={<ExplorerHome />} />
                  <Route path="/block/:id" element={<BlockDetail />} />
                  <Route path="/tx/:txid" element={<TxDetail />} />
                  <Route path="/address/:addr" element={<AddressDetail />} />
                  <Route path="/wallet" element={<WalletDashboard />} /> {/* New route */}
                </Routes>
              </main>
            </div>
          </div>
        </BrowserRouter>
      </WalletProvider>
    </NetworkProvider>
  );
}

export default App;
