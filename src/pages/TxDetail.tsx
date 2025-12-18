// File: src/pages/TxDetail.tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const API = 'https://mempool.space/testnet4/api';

interface Vin {
  txid?: string;
  vout?: number;
  prevout?: {
    scriptpubkey_address?: string;
    value: number;
  };
  is_coinbase?: boolean;
}

interface Vout {
  scriptpubkey_address?: string;
  value: number;
}

interface TxData {
  txid: string;
  version: number;
  locktime: number;
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
  vin: Vin[];
  vout: Vout[];
}

const shortAddr = (addr: string | undefined) => addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : 'Non-standard';
const shortTxid = (txid: string | undefined) => txid ? `${txid.slice(0, 10)}...${txid.slice(-10)}` : '-';

const formatBTC = (sats: number) => {
  const btc = (sats / 100000000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  return `${btc} tBTC`;
};

export default function TxDetail() {
  const { txid } = useParams<{ txid: string }>();
  const [tx, setTx] = useState<TxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTx = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await axios.get(`${API}/tx/${txid}`);
        setTx(data);
      } catch (err) {
        setError('Transaction not found or network error. Check the TXID and try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTx();
  }, [txid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-bitcoin"></div>
      </div>
    );
  }

  if (error || !tx) {
    return <div className="text-red-500 text-xl">{error || 'Transaction not found'}</div>;
  }

  const isCoinbase = tx.vin.length > 0 && tx.vin[0].is_coinbase;
  const feeRate = tx.fee && tx.weight > 0 ? (tx.fee / (tx.weight / 4)).toFixed(2) : isCoinbase ? '0' : 'N/A';

  const totalInput = isCoinbase ? 0 : tx.vin.reduce((sum, vin) => sum + (vin.prevout?.value || 0), 0);
  const totalOutput = tx.vout.reduce((sum, vout) => sum + vout.value, 0);

  return (
    <div>
      <h2 className="text-4xl font-bold mb-8">
        Transaction {shortTxid(tx.txid)}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Status</div>
          <div className="text-xl">
            {tx.status.confirmed ? (
              <span className="text-green-500">Confirmed</span>
            ) : (
              <span className="text-yellow-500">In Mempool</span>
            )}
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Fee</div>
          <div className="text-xl text-bitcoin">{tx.fee.toLocaleString()} sats</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Fee Rate</div>
          <div className="text-xl">{feeRate} sat/vB</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Size / Weight</div>
          <div className="text-xl">{tx.size} bytes / {tx.weight} WU</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Total Input</div>
          <div className="text-xl text-bitcoin">{formatBTC(totalInput)}</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Total Output</div>
          <div className="text-xl text-bitcoin">{formatBTC(totalOutput)}</div>
        </div>
        {tx.status.confirmed && tx.status.block_height && (
          <div className="bg-gray-800 p-6 rounded-lg col-span-1 md:col-span-2 lg:col-span-4">
            <div className="text-gray-400 text-sm">Confirmed in Block</div>
            <div className="text-xl">
              <Link to={`/block/${tx.status.block_height}`} className="text-bitcoin hover:underline">
                {tx.status.block_height}
              </Link>
              {' '}· {new Date((tx.status.block_time || 0) * 1000).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      <h3 className="text-2xl font-semibold mb-6">Inputs ({tx.vin.length})</h3>
      <div className="bg-gray-800 rounded-lg overflow-hidden mb-12">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="p-4 text-left">Previous TXID</th>
              <th className="p-4 text-left">Index</th>
              <th className="p-4 text-left">Address</th>
              <th className="p-4 text-left">Value</th>
            </tr>
          </thead>
          <tbody>
            {tx.vin.length === 0 || tx.vin[0]?.is_coinbase ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-400">Coinbase (New coins)</td>
              </tr>
            ) : (
              tx.vin.map((input, i) => (
                <tr key={i} className="border-t border-gray-700 hover:bg-gray-700 transition">
                  <td className="p-4 font-mono text-sm">
                    {input.txid ? (
                      <Link to={`/tx/${input.txid}`} className="text-bitcoin hover:underline">
                        {shortTxid(input.txid)}
                      </Link>
                    ) : '-'}
                  </td>
                  <td className="p-4">{input.vout ?? '-'}</td>
                  <td className="p-4 font-mono text-sm">
                    {input.prevout?.scriptpubkey_address ? (
                      <Link to={`/address/${input.prevout.scriptpubkey_address}`} className="text-bitcoin hover:underline">
                        {shortAddr(input.prevout.scriptpubkey_address)}
                      </Link>
                    ) : 'Non-standard'}
                  </td>
                  <td className="p-4">
                    {input.prevout ? formatBTC(input.prevout.value) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h3 className="text-2xl font-semibold mb-6">Outputs ({tx.vout.length})</h3>
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="p-4 text-left">Index</th>
              <th className="p-4 text-left">Address</th>
              <th className="p-4 text-left">Value</th>
            </tr>
          </thead>
          <tbody>
            {tx.vout.map((output, i) => (
              <tr key={i} className="border-t border-gray-700 hover:bg-gray-700 transition">
                <td className="p-4">{i}</td>
                <td className="p-4 font-mono text-sm break-all">
                  {output.scriptpubkey_address ? (
                    <Link to={`/address/${output.scriptpubkey_address}`} className="text-bitcoin hover:underline">
                      {shortAddr(output.scriptpubkey_address)}
                    </Link>
                  ) : 'Non-standard / OP_RETURN'}
                </td>
                <td className="p-4 text-bitcoin">{formatBTC(output.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
