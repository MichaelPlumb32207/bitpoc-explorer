import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ExplorerHome from './pages/ExplorerHome';
import BlockDetail from './pages/BlockDetail';
import TxDetail from './pages/TxDetail';
import AddressDetail from './pages/AddressDetail';
import { NetworkProvider } from './utils/Api';

function App() {
  return (
    <NetworkProvider>
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
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </NetworkProvider>
  );
}

export default App;
