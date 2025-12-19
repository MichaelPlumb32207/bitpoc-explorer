// File: src/components/Sidebar.tsx
import { Link } from 'react-router-dom';
import { useNetwork } from '../utils/Api';

export default function Sidebar() {
  const { network } = useNetwork();

  return (
    <aside className="w-64 bg-gray-800 p-6 space-y-8">
      <div className="text-2xl font-bold text-bitcoin">BitPOC</div>
      <nav className="space-y-4">
        <Link to="/" className="block py-2 px-4 rounded hover:bg-gray-700 transition">
          Explorer
        </Link>
        <div className="py-2 px-4 text-gray-500 cursor-not-allowed" title="Coming Soon">
          Wallet
        </div>
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
