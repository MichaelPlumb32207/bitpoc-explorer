// File: src/pages/AddressDetail.tsx
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
  status: { confirmed: boolean; block_time?: number };
  vin: { prevout?: { scriptpubkey_address?: string; value: number } }[];
  vout: { scriptpubkey_address?: string; value: number }[];
}

const shortTxid = (txid: string) => `${txid.slice(0, 10)}...${txid.slice(-10)}`;

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

  // Determine which addresses to query
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

        // DEBUG: Log exactly which addresses we're querying
        console.log('Wallet Balance Debug - Querying these addresses:', addressesToQuery);

        // Fetch address stats for each address
        const dataPromises = addressesToQuery.map(async (address) => {
          try {
            const { data } = await axios.get(`${apiBase}/address/${address}`);
            console.log(`Debug - ${address}: funded_sum=${data.chain_stats.funded_txo_sum}, spent_sum=${data.chain_stats.spent_txo_sum}`);
            return data as AddressData;
          } catch (err: any) {
            if (err.response?.status === 404) {
              console.log(`Debug - ${address}: Not found (404) - treating as empty`);
              // Fresh/empty address – return zeroed stats
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
              };
            }
            console.error(`Debug - Failed to fetch ${address}:`, err);
            throw err;
          }
        });

        const results = await Promise.all(dataPromises);
        setAddressesData(results);

        // Fetch recent transactions for all addresses
        const txPromises = addressesToQuery.flatMap((address) => [
          axios.get(`${apiBase}/address/${address}/txs`).catch(() => ({ data: [] })),
          axios.get(`${apiBase}/address/${address}/txs/mempool`).catch(() => ({ data: [] })),
        ]);

        const txResponses = await Promise.all(txPromises);
        const combinedTxs: TxSummary[] = txResponses.flatMap((res) => res.data);

        // Deduplicate and sort by time (newest first), limit to 20
        const uniqueTxs = Array.from(
          new Map(combinedTxs.map((tx) => [tx.txid, tx])).values()
        )
          .sort((a, b) => (b.status.block_time || 0) - (a.status.block_time || 0))
          .slice(0, 20);

        setAllTxs(uniqueTxs);
      } catch (err: any) {
        setError('Failed to load address data. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [addressesToQuery.join(','), apiBase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-bitcoin"></div>
      </div>
    );
  }

  if (error || addressesData.length === 0) {
    return <div className="text-red-500 text-xl">{error || 'No address data'}</div>;
  }

  // Aggregate balances across all addresses when in wallet mode
  const totalBalance = addressesData.reduce(
    (sum, data) => sum + (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum),
    0
  );

  const primaryAddress = addressesData[0].address;
  const displayAddress = isWallet ? 'All Wallet Addresses' : primaryAddress;

  return (
    <div>
      {/* DEBUG SECTION - Remove this entire div when debugging is complete */}
      {isWallet && (
        <div className="bg-yellow-900 p-4 rounded-lg mb-8 text-sm">
          <strong>DEBUG: Wallet is querying {addressesToQuery.length} address(es):</strong>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {addressesToQuery.map((a, i) => (
              <li key={i}>
                [{i}] {a} → Balance: {formatBTC(
                  addressesData.find(d => d.address === a)?.chain_stats.funded_txo_sum || 0 -
                  (addressesData.find(d => d.address === a)?.chain_stats.spent_txo_sum || 0)
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            <strong>Total calculated balance: {formatBTC(totalBalance)}</strong>
          </p>
        </div>
      )}
      {/* END DEBUG SECTION */}

      <div className="flex items-center mb-8">
        <h2 className="text-4xl font-bold">
          {isWallet ? 'My Wallet Balance' : `Address ${displayAddress.slice(0, 12)}...${displayAddress.slice(-10)}`}
        </h2>
        {!isWallet && (
          <button
            onClick={copyAddress}
            className="ml-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center space-x-2 transition"
            title="Copy full address"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-gray-800 p-6 rounded-lg col-span-1 md:col-span-2 lg:col-span-4">
          <div className="text-gray-400 text-sm">Current Balance {isWallet ? '(All Addresses)' : ''}</div>
          <div className="text-4xl font-bold text-bitcoin">{formatBTC(totalBalance)}</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Transactions</div>
          <div className="text-xl">
            {addressesData.reduce((sum, d) => sum + d.chain_stats.tx_count, 0)}
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Total Received</div>
          <div className="text-xl text-bitcoin">
            {formatBTC(addressesData.reduce((sum, d) => sum + d.chain_stats.funded_txo_sum, 0))}
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Total Sent</div>
          <div className="text-xl text-bitcoin">
            {formatBTC(addressesData.reduce((sum, d) => sum + d.chain_stats.spent_txo_sum, 0))}
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
                <th className="p-4 text-left">Value</th>
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
      )}
    </div>
  );
}
