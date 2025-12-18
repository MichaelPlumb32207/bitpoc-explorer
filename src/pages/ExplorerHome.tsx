// File: src/pages/ExplorerHome.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const API = 'https://mempool.space/testnet4/api';

interface Block {
  id: string;
  height: number;
  timestamp: number;
  tx_count: number;
  size: number;
}

interface MempoolStats {
  best_height?: number;
  count?: number;
  vsize?: number;
  fee_histogram?: [number, number][];  // [fee_rate, vsize]
}

export default function ExplorerHome() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [mempool, setMempool] = useState<MempoolStats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [blocksRes, mempoolRes] = await Promise.all([
          axios.get(`${API}/blocks`),
          axios.get(`${API}/mempool`)
        ]);
        setBlocks(blocksRes.data.slice(0, 15));
        setMempool(mempoolRes.data);
      } catch (err) {
        setError('Failed to load network data. Please refresh.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Helper: Get economy fee (lowest non-zero bucket)
  const economyFee = mempool.fee_histogram?.find(bucket => bucket[1] > 0)?.[0] ?? '...';

  return (
    <div>
      <h2 className="text-4xl font-bold mb-8">Testnet4 Network Overview</h2>

      {error && <div className="text-red-500 mb-6">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Block Height</div>
          <div className="text-3xl font-bold">
            {loading ? '...' : mempool.best_height?.toLocaleString() ?? '...'}
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Mempool Transactions</div>
          <div className="text-3xl font-bold">
            {loading ? '...' : mempool.count?.toLocaleString() ?? '...'}
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Mempool Size (vBytes)</div>
          <div className="text-3xl font-bold">
            {loading ? '...' : mempool.vsize ? (mempool.vsize / 1_000_000).toFixed(1) + 'M' : '...'}
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Economy Fee (sat/vB)</div>
          <div className="text-3xl font-bold text-bitcoin">
            {loading ? '...' : economyFee}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-bitcoin"></div>
        </div>
      ) : (
        <>
          <h3 className="text-2xl font-semibold mb-6">Recent Blocks</h3>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-4 text-left">Height</th>
                  <th className="p-4 text-left">Block Hash</th>
                  <th className="p-4 text-left">Time</th>
                  <th className="p-4 text-left">Txs</th>
                  <th className="p-4 text-left">Size</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map(block => (
                  <tr key={block.id} className="border-t border-gray-700 hover:bg-gray-700 transition">
                    <td className="p-4">
                      <Link to={`/block/${block.height}`} className="text-bitcoin hover:underline">
                        {block.height}
                      </Link>
                    </td>
                    <td className="p-4 font-mono text-sm">{block.id.slice(0, 16)}...</td>
                    <td className="p-4">{new Date(block.timestamp * 1000).toLocaleString()}</td>
                    <td className="p-4">{block.tx_count}</td>
                    <td className="p-4">{(block.size / 1000).toFixed(1)} KB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
