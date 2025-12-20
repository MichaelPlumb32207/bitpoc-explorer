// File: src/components/Sidebar.tsx
import { Link } from 'react-router-dom';
import { useNetwork } from '../utils/Api';
import { useWallet } from '../utils/Wallet';

export default function Sidebar() {
  const { network } = useNetwork();
  const { receiveAddresses } = useWallet();

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
        <div className="py-2 px-4 text-gray-500 cursor-not-allowed" title="Coming Soon">
          Tools
        </div>
      </nav>
      <div className="text-xs text-gray-500">
        {network === 'testnet4' ? 'Testnet4 Mode\nNo real value' : 'Mainnet\nReal BTC value'}
      </div>
    </aside>
  );
}
