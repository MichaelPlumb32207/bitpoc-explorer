// File: src/pages/AddressDetail.tsx
// Complete fixed version
// - Added shortAddr helper function (fixes TS2304 compile error)
// - All previous features preserved (mempool/chain merge, beautiful table, preview, etc.)

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useNetwork } from '../utils/Api';
import { useWallet } from '../utils/Wallet';

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
  fee?: number;
  status: { confirmed: boolean; block_height?: number; block_time?: number };
  vin: { prevout?: { scriptpubkey_address?: string; value: number } }[];
  vout: { scriptpubkey_address?: string; value: number }[];
}

const shortTxid = (txid: string) => `${txid.slice(0, 10)}...${txid.slice(-10)}`;

const shortAddr = (addr: string | undefined) => addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : 'Unknown';

const formatBTC = (sats: number) => {
  const btc = (sats / 100000000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  return `${btc} tBTC`;
};

export default function AddressDetail({ overrideAddr, isWallet = false }: { overrideAddr?: string; isWallet?: boolean }) {
  const { addr } = useParams<{ addr: string }>();
  const { apiBase } = useNetwork();
  const { receiveAddresses } = useWallet();

  const [addressesData, setAddressesData] = useState<AddressData[]>([]);
  const [allTxs, setAllTxs] = useState<TxSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const addressesToQuery = isWallet && receiveAddresses.length > 0
    ? receiveAddresses
    : overrideAddr
      ? [overrideAddr]
      : addr
        ? [addr]
        : [];

  const copyAddress = async () => {
    if (addressesData.length === 0) return;
    const primary = addressesData[0].address;
    try {
      await navigator.clipboard.writeText(primary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Failed to copy');
    }
  };

  useEffect(() => {
    if (addressesToQuery.length === 0) {
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);
        setAddressesData([]);
        setAllTxs([]);

        const dataPromises = addressesToQuery.map(async (address) => {
          try {
            const { data } = await axios.get(`${apiBase}/address/${address}`);
            return data as AddressData;
          } catch (err: any) {
            if (err.response?.status === 404) {
              return {
                address,
                chain_stats: {
                  funded_txo_count: 0,
                  funded_txo_sum: 0,
                  spent_txo_count: 0,
                  spent_txo_sum: 0,
                  tx_count: 0,
                },
                mempool_stats: {
                  funded_txo_count: 0,
                  funded_txo_sum: 0,
                  spent_txo_count: 0,
                  spent_txo_sum: 0,
                  tx_count: 0,
                },
              } as AddressData;
            }
            console.error(`Failed to fetch data for ${address}`, err);
            return null;
          }
        });

        const resolvedData = (await Promise.all(dataPromises)).filter(Boolean) as AddressData[];
        setAddressesData(resolvedData);

        // Fetch confirmed and mempool txs separately for reliability
        const chainTxPromises = addressesToQuery.map(async (address) => {
          try {
            const { data: txs } = await axios.get(`${apiBase}/address/${address}/txs/chain`);
            return txs as TxSummary[];
          } catch (err) {
            console.error(`Failed to fetch chain txs for ${address}`, err);
            return [];
          }
        });

        const mempoolTxPromises = addressesToQuery.map(async (address) => {
          try {
            const { data: txs } = await axios.get(`${apiBase}/address/${address}/txs/mempool`);
            return txs as TxSummary[];
          } catch (err) {
            console.error(`Failed to fetch mempool txs for ${address}`, err);
            return [];
          }
        });

        const [chainTxArrays, mempoolTxArrays] = await Promise.all([
          Promise.all(chainTxPromises),
          Promise.all(mempoolTxPromises),
        ]);

        const combinedTxs = [...chainTxArrays.flat(), ...mempoolTxArrays.flat()];

        // Sort newest first: mempool first, then confirmed by block_time descending
        combinedTxs.sort((a, b) => {
          if (!a.status.confirmed && b.status.confirmed) return -1;
          if (a.status.confirmed && !b.status.confirmed) return 1;
          if (!a.status.block_time || !b.status.block_time) return 0;
          return b.status.block_time - a.status.block_time;
        });

        setAllTxs(combinedTxs);
      } catch (err) {
        setError('Failed to load address data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [apiBase, addressesToQuery.join(',')]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-bitcoin"></div>
      </div>
    );
  }

  if (error || addressesData.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 text-xl mb-4">{error || 'No data found for this address'}</p>
        {isWallet && <p className="text-gray-400">Try refreshing or generating a new address.</p>}
      </div>
    );
  }

  const totalTxCount = addressesData.reduce((sum, d) => sum + d.chain_stats.tx_count + d.mempool_stats.tx_count, 0);

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-3xl font-bold break-all">
            {addressesData.length === 1 ? addressesData[0].address : `${addressesData.length} Addresses (Wallet)`}
          </h2>
          {addressesData.length === 1 && (
            <button
              onClick={copyAddress}
              className="text-sm text-bitcoin underline mt-2"
            >
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Current Balance</div>
          <div className="text-3xl font-bold text-bitcoin">
            {formatBTC(
              addressesData.reduce(
                (sum, d) => sum + (d.chain_stats.funded_txo_sum - d.chain_stats.spent_txo_sum + d.mempool_stats.funded_txo_sum - d.mempool_stats.spent_txo_sum),
                0
              )
            )}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Incl. mempool: {formatBTC(addressesData.reduce((sum, d) => sum + d.mempool_stats.funded_txo_sum - d.mempool_stats.spent_txo_sum, 0))}
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Transactions</div>
          <div className="text-xl">
            {totalTxCount}
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Total Received</div>
          <div className="text-xl text-bitcoin">
            {formatBTC(addressesData.reduce((sum, d) => sum + d.chain_stats.funded_txo_sum + d.mempool_stats.funded_txo_sum, 0))}
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Total Sent</div>
          <div className="text-xl text-bitcoin">
            {formatBTC(addressesData.reduce((sum, d) => sum + d.chain_stats.spent_txo_sum + d.mempool_stats.spent_txo_sum, 0))}
          </div>
        </div>
      </div>

      <h3 className="text-2xl font-semibold mb-6">Recent Transactions ({allTxs.length})</h3>
      {allTxs.length === 0 ? (
        <div className="bg-gray-800 p-8 rounded-lg text-center text-gray-400">
          No transactions yet
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="p-4 text-left">TXID</th>
                <th className="p-4 text-left">Time</th>
                <th className="p-4 text-left">Type</th>
                <th className="p-4 text-left">Amount</th>
                <th className="p-4 text-left">Fee</th>
                <th className="p-4 text-left">Total</th>
                <th className="p-4 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {allTxs.map((tx) => {
                const received = tx.vout
                  .filter((o) => addressesToQuery.includes(o.scriptpubkey_address || ''))
                  .reduce((sum, o) => sum + o.value, 0);

                const sent = tx.vin
                  .filter((v) => addressesToQuery.includes(v.prevout?.scriptpubkey_address || ''))
                  .reduce((sum, v) => sum + (v.prevout?.value || 0), 0);

                const net = received - sent;
                const isSend = net < 0;
                const fee = tx.fee || 0;
                const total = isSend ? Math.abs(net) + fee : Math.abs(net);

                const destination = isSend
                  ? tx.vout.find(o => !addressesToQuery.includes(o.scriptpubkey_address || ''))?.scriptpubkey_address || 'Multiple/Change'
                  : 'From multiple';

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
                    <td className="p-4">
                      <span className={isSend ? 'text-red-400' : 'text-green-400'}>
                        {isSend ? 'Sent' : 'Received'}
                      </span>
                    </td>
                    <td className="p-4 text-bitcoin font-medium">
                      {net > 0 ? '+' : ''}{formatBTC(Math.abs(net))}
                    </td>
                    <td className="p-4">
                      {isSend ? formatBTC(fee) : '-'}
                    </td>
                    <td className="p-4 text-bitcoin font-medium">
                      {isSend ? '-' : ''}{formatBTC(total)}
                    </td>
                    <td className="p-4">
                      <span className={tx.status.confirmed ? 'text-green-500' : 'text-yellow-500'}>
                        {tx.status.confirmed ? `Confirmed${tx.status.block_height ? ` (#${tx.status.block_height})` : ''}` : 'Mempool'}
                      </span>
                      <div className="text-xs text-gray-400 mt-1" title={destination}>
                        {shortAddr(destination)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
