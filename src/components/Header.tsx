// File: src/components/Header.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useNetwork } from '../utils/api';

export default function Header() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { network, toggleNetwork } = useNetwork();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const trimmed = query.trim();
    const base = network === 'testnet4' ? 'testnet4/api' : 'api';

    try { const { data } = await axios.get(`https://mempool.space/${base}/block/${trimmed}`); if (data?.id) return navigate(`/block/${trimmed}`); } catch {}
    try { const { data } = await axios.get(`https://mempool.space/${base}/tx/${trimmed}`); if (data?.txid) return navigate(`/tx/${trimmed}`); } catch {}
    try { const { data } = await axios.get(`https://mempool.space/${base}/address/${trimmed}`); if (data?.address) return navigate(`/address/${trimmed}`); } catch {}

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
      <button
        onClick={toggleNetwork}
        className="px-6 py-3 bg-bitcoin text-black font-bold rounded hover:bg-orange-500 transition"
      >
        {network === 'testnet4' ? 'TESTNET4' : 'MAINNET'}
      </button>
    </header>
  );
}
