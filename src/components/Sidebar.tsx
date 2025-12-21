// File: src/components/Sidebar.tsx
// Updated to add Tools submenu with Raw Broadcast link
// - Tools now expands to show Raw Transaction Broadcast
// - Keeps existing links

import { Link } from 'react-router-dom';
import { useNetwork } from '../utils/Api';
import { useWallet } from '../utils/Wallet';
import { useState } from 'react';

export default function Sidebar() {
  const { network } = useNetwork();
  const { receiveAddresses } = useWallet();
  const [showTools, setShowTools] = useState(false);

  return (
    <aside className="w-64 bg-gray-800 p-6 space-y-8">
      <div className="text-2xl font-bold text-bitcoin">BitPOC</div>
      <nav className="space-y-4">
        <Link to="/" className="block py-2 px-4 rounded hover:bg-gray-700 transition">
          Explorer
        </Link>
        <Link
          to="/wallet"
          className="block py-2 px-4 rounded hover:bg-gray-700 transition text-bitcoin font-medium"
        >
          Wallet {receiveAddresses.length > 0 ? '(Connected)' : ''}
        </Link>
        <div>
          <button
            onClick={() => setShowTools(!showTools)}
            className="w-full text-left py-2 px-4 rounded hover:bg-gray-700 transition"
          >
            Tools {showTools ? '▼' : '▶'}
          </button>
          {showTools && (
            <div className="ml-4 space-y-2 mt-2">
              <Link
                to="/tools/broadcast"
                className="block py-2 px-4 rounded hover:bg-gray-700 transition"
              >
                Raw Transaction Broadcast
              </Link>
            </div>
          )}
        </div>
      </nav>
      <div className="text-xs text-gray-500">
        {network === 'testnet4' ? 'Testnet4 Mode\nNo real value' : 'Mainnet\nReal BTC value'}
      </div>
    </aside>
  );
}
