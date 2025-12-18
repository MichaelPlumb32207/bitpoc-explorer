// File: src/components/Header.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = 'https://mempool.space/testnet4/api';

export default function Header() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const trimmed = query.trim();

    try { const { data } = await axios.get(`${API_BASE}/block/${trimmed}`); if (data?.id) return navigate(`/block/${trimmed}`); } catch {}
    try { const { data } = await axios.get(`${API_BASE}/tx/${trimmed}`); if (data?.txid) return navigate(`/tx/${trimmed}`); } catch {}
    try { const { data } = await axios.get(`${API_BASE}/address/${trimmed}`); if (data?.addrStr) return navigate(`/address/${trimmed}`); } catch {}

    alert('Not found on Testnet4');
  };

  return (
    <header className="bg-gray-800 p-4 flex items-center justify-between border-b border-gray-700">
      <div className="flex items-center space-x-4">
        <span className="text-bitcoin text-3xl">₿</span>
        <h1 className="text-xl font-semibold">Bitcoin Testnet4 Explorer</h1>
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
      <div className="bg-yellow-600 text-black px-4 py-2 rounded font-medium text-sm">
        TESTNET4
      </div>
    </header>
  );
}
