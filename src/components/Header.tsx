import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useNetwork } from '../utils/Api';

const DEBUG = true; // Flip to false later

export default function Header() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { network, setNetwork, apiBase } = useNetwork();
  const [currentNetwork, setCurrentNetwork] = useState<'mainnet' | 'testnet4' | 'verifying'>('verifying');

  useEffect(() => {
    const verifyNetwork = async () => {
      try {
        const { data: currentHeight } = await axios.get(`${apiBase}/blocks/tip/height`);
        const { data: mainnetHeight } = await axios.get('https://mempool.space/api/blocks/tip/height');

        const isMainnet = currentHeight === mainnetHeight;
        const verifiedNetwork = isMainnet ? 'mainnet' : 'testnet4';
        setCurrentNetwork(verifiedNetwork);

        if (DEBUG) {
          console.log(`Debug: Selected: ${network}, apiBase: ${apiBase}`);
          console.log(`Debug: Verified height: ${currentHeight} (vs mainnet ${mainnetHeight}) → ${verifiedNetwork}`);
        }
      } catch (err) {
        setCurrentNetwork(network);
        if (DEBUG) console.error('Verification failed', err);
      }
    };
    verifyNetwork();
  }, [apiBase, network]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const trimmed = query.trim();

    try { const { data } = await axios.get(`${apiBase}/block/${trimmed}`); if (data?.id) return navigate(`/block/${trimmed}`); } catch {}
    try { const { data } = await axios.get(`${apiBase}/tx/${trimmed}`); if (data?.txid) return navigate(`/tx/${trimmed}`); } catch {}
    try { const { data } = await axios.get(`${apiBase}/address/${trimmed}`); if (data?.address) return navigate(`/address/${trimmed}`); } catch {}

    alert('Not found on current network');
  };

  return (
    <header className="bg-gray-800 p-4 flex items-center justify-between border-b border-gray-700">
      <div className="flex items-center space-x-4">
        <span className="text-bitcoin text-3xl">₿</span>
        <h1 className="text-xl font-semibold">Bitcoin Explorer</h1>
      </div>
      <form onSubmit={handleSearch} className="flex-1 max-w-lg mx-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search block height/hash, txid, or address..."
          className="w-full px-5 py-3 rounded-lg bg-gray-700 focus:outline-none focus:ring-2 focus:ring-bitcoin"
        />
      </form>
      <div className="flex flex-col items-end space-y-2">
        <div className="flex space-x-4">
          <label className="flex items-center text-sm">
            <input type="radio" checked={network === 'mainnet'} onChange={() => setNetwork('mainnet')} className="mr-2" />
            Mainnet
          </label>
          <label className="flex items-center text-sm">
            <input type="radio" checked={network === 'testnet4'} onChange={() => setNetwork('testnet4')} className="mr-2" />
            Testnet4
          </label>
        </div>
        <div className="text-xs text-gray-400">
          Selected: {network.toUpperCase()} | API: {apiBase.slice(-20)}... | Verified: {currentNetwork === 'verifying' ? '...' : currentNetwork.toUpperCase()}
        </div>
      </div>
    </header>
  );
}
