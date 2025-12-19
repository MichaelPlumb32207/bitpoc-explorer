// File: src/pages/AddressDetail.tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useNetwork } from '../utils/Api';

interface AddressData {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

interface TxSummary {
  txid: string;
  status: { confirmed: boolean; block_time?: number };
  vin: { prevout?: { scriptpubkey_address?: string; value: number } }[];
  vout: { scriptpubkey_address?: string; value: number }[];
}

const shortTxid = (txid: string) => `${txid.slice(0, 10)}...${txid.slice(-10)}`;

const formatBTC = (sats: number) => {
  const btc = (sats / 100000000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  return `${btc} tBTC`;
};

export default function AddressDetail() {
  const { addr } = useParams<{ addr: string }>();
  const { apiBase, network } = useNetwork();
  const [address, setAddress] = useState<AddressData | null>(null);
  const [txs, setTxs] = useState<TxSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Failed to copy');
    }
  };

  useEffect(() => {
    console.log(`Fetching address data for ${network} using apiBase: ${apiBase}`);
    const fetchAddress = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data } = await axios.get(`${apiBase}/address/${addr}`);
        setAddress(data);

        const txRes = await axios.get(`${apiBase}/address/${addr}/txs`);
        setTxs(txRes.data.slice(0, 20));
      } catch (err) {
        setError('Address not found or network error. Check the address and try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAddress();
  }, [addr, apiBase, network]); // network added for refetch on toggle

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-bitcoin"></div>
      </div>
    );
  }

  if (error || !address) {
    return <div className="text-red-500 text-xl">{error || 'Address not found'}</div>;
  }

  const balance = address.chain_stats.funded_txo_sum - address.chain_stats.spent_txo_sum;

  return (
    <div>
      <div className="flex items-center mb-8">
        <h2 className="text-4xl font-bold">
          Address {address.address.slice(0, 12)}...{address.address.slice(-10)}
        </h2>
        <button
          onClick={copyAddress}
          className="ml-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center space-x-2 transition"
          title="Copy full address"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-gray-800 p-6 rounded-lg col-span-1 md:col-span-2 lg:col-span-4">
          <div className="text-gray-400 text-sm">Current Balance</div>
          <div className="text-4xl font-bold text-bitcoin">{formatBTC(balance)}</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Transactions</div>
          <div className="text-xl">{address.chain_stats.tx_count}</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Total Received</div>
          <div className="text-xl text-bitcoin">{formatBTC(address.chain_stats.funded_txo_sum)}</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Total Sent</div>
          <div className="text-xl text-bitcoin">{formatBTC(address.chain_stats.spent_txo_sum)}</div>
        </div>
      </div>

      <h3 className="text-2xl font-semibold mb-6">Recent Transactions ({txs.length})</h3>
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="p-4 text-left">TXID</th>
              <th className="p-4 text-left">Time</th>
              <th className="p-4 text-left">Value</th>
              <th className="p-4 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((tx) => {
              const received = tx.vout
                .filter(o => o.scriptpubkey_address === address.address)
                .reduce((sum, o) => sum + o.value, 0);

              const sent = tx.vin
                .filter(v => v.prevout?.scriptpubkey_address === address.address)
                .reduce((sum, v) => sum + (v.prevout?.value || 0), 0);

              const net = received - sent;

              return (
                <tr key={tx.txid} className="border-t border-gray-700 hover:bg-gray-700 transition">
                  <td className="p-4 font-mono text-sm">
                    <Link to={`/tx/${tx.txid}`} className="text-bitcoin hover:underline">
                      {shortTxid(tx.txid)}
                    </Link>
                  </td>
                  <td className="p-4">
                    {tx.status.block_time ? new Date(tx.status.block_time * 1000).toLocaleString() : 'Mempool'}
                  </td>
                  <td className="p-4 text-bitcoin font-medium">
                    {net > 0 ? '+' : ''}{formatBTC(net)}
                  </td>
                  <td className="p-4">
                    {tx.status.confirmed ? (
                      <span className="text-green-500">Confirmed</span>
                    ) : (
                      <span className="text-yellow-500">Mempool</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
