// File: src/pages/BlockDetail.tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const API = 'https://mempool.space/testnet4/api';

const MAX_SUMMARY_TXS = 200; // Threshold for detailed From/Amount/To summaries

interface BriefTx {
  txid: string;
  fee: number;
  vout: { scriptpubkey_address: string; value: number }[];
  vin: { prevout?: { scriptpubkey_address: string; value: number }; is_coinbase?: boolean }[];
}

interface BlockData {
  id: string;
  height: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  extras?: {
    totalFees: number;
    pool: { name: string; link: string };
  };
  txids?: string[];
}

const shortAddr = (addr: string | undefined) => addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : 'Non-standard';

const formatBTC = (sats: number) => {
  const btc = (sats / 100000000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  return `${btc} tBTC`;
};

const formatValue = (sats: number) => {
  const rounded = Math.round(sats / 10000) * 10000;
  const btc = (rounded / 100000000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  return `${btc} tBTC (${rounded.toLocaleString()} sats)`;
};

export default function BlockDetail() {
  const { id } = useParams<{ id: string }>();
  const [block, setBlock] = useState<BlockData | null>(null);
  const [txSummaries, setTxSummaries] = useState<(BriefTx | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBlock = async () => {
      try {
        setLoading(true);
        setError(null);
        setTxSummaries([]);

        let blockHash: string;
        if (/^\d+$/.test(id!)) {
          const heightRes = await axios.get(`${API}/blocks/${id}`);
          if (heightRes.data.length === 0) throw new Error('Block not found');
          blockHash = heightRes.data[0].id;
        } else {
          blockHash = id!;
        }

        const { data } = await axios.get(`${API}/block/${blockHash}`);
        if (!data.txids && data.tx_count > 0) {
          const txRes = await axios.get(`${API}/block/${blockHash}/txids`);
          data.txids = txRes.data;
        }
        setBlock(data);

        const tooMany = data.tx_count > MAX_SUMMARY_TXS;

        if (!tooMany && data.txids) {
          const summaries: (BriefTx | null)[] = [];
          for (const txid of data.txids) {
            try {
              const txRes = await axios.get(`${API}/tx/${txid}`);
              summaries.push(txRes.data);
            } catch (txErr) {
              console.warn(`Failed to fetch tx ${txid}`);
              summaries.push(null);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          setTxSummaries(summaries);
        } else {
          setTxSummaries([]); // Use txids only for large blocks
        }
      } catch (err) {
        setError('Block not found or network error. Check the ID and try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBlock();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-bitcoin"></div>
      </div>
    );
  }

  if (error || !block) {
    return <div className="text-red-500 text-xl">{error || 'Block not found'}</div>;
  }

  const coinbaseReward = 5000000000;
  const totalOutputValue = coinbaseReward + (block.extras?.totalFees || 0);
  const tooManyTxs = block.tx_count > MAX_SUMMARY_TXS;

  return (
    <div>
      <h2 className="text-4xl font-bold mb-8">Block {block.height}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Hash</div>
          <div className="font-mono text-sm break-all">{block.id}</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Mined</div>
          <div className="text-xl">{new Date(block.timestamp * 1000).toLocaleString()}</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Transactions</div>
          <div className="text-xl">{block.tx_count.toLocaleString()}</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Size</div>
          <div className="text-xl">{(block.size / 1000).toFixed(1)} KB</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Weight</div>
          <div className="text-xl">{(block.weight / 1000).toFixed(1)} KWU</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Coinbase Reward</div>
          <div className="text-xl">50 tBTC</div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Total Fees</div>
          <div className="text-xl text-bitcoin">
            {block.extras?.totalFees ? block.extras.totalFees.toLocaleString() : '...'} sats
          </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="text-gray-400 text-sm">Total Output Value</div>
          <div className="text-xl text-bitcoin">
            {block.extras?.totalFees !== undefined 
              ? formatValue(totalOutputValue)
              : '50 tBTC (fees unknown)'}
          </div>
        </div>
        {block.extras?.pool && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="text-gray-400 text-sm">Miner</div>
            <div className="text-xl">
              <a href={block.extras.pool.link} target="_blank" rel="noopener noreferrer" className="text-bitcoin hover:underline">
                {block.extras.pool.name}
              </a>
            </div>
          </div>
        )}
      </div>

      <h3 className="text-2xl font-semibold mb-6">Transactions ({block.tx_count})</h3>
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              {tooManyTxs ? (
                <th className="p-4 text-left">TXID</th>
              ) : (
                <>
                  <th className="p-4 text-left">From</th>
                  <th className="p-4 text-left">Amount</th>
                  <th className="p-4 text-left">To</th>
                  <th className="p-4 text-left">TXID</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {tooManyTxs ? (
              block.txids?.map((txid) => (
                <tr key={txid} className="border-t border-gray-700 hover:bg-gray-700 transition">
                  <td className="p-4 font-mono text-sm">
                    <Link to={`/tx/${txid}`} className="text-bitcoin hover:underline">
                      {txid}
                    </Link>
                  </td>
                </tr>
              )) || (
                <tr>
                  <td className="p-4 text-center text-gray-500">No TXIDs available</td>
                </tr>
              )
            ) : txSummaries.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500">Loading transaction summaries...</td>
              </tr>
            ) : (
              txSummaries.map((tx, i) => {
                if (!tx) {
                  return (
                    <tr key={i}>
                      <td colSpan={4} className="p-4 text-center text-gray-500">Failed to load transaction</td>
                    </tr>
                  );
                }

                const isCoinbase = tx.vin[0]?.is_coinbase ?? false;
                const fromAddr = isCoinbase ? 'Coinbase' : shortAddr(tx.vin[0]?.prevout?.scriptpubkey_address);
                const amount = tx.vout.reduce((sum, o) => sum + o.value, 0);
                const outputCount = tx.vout.length;
                const toAddr = outputCount === 1 
                  ? shortAddr(tx.vout[0].scriptpubkey_address)
                  : outputCount > 1 ? `${outputCount} outputs` : 'OP_RETURN';

                return (
                  <tr key={tx.txid} className="border-t border-gray-700 hover:bg-gray-700 transition">
                    <td className="p-4 text-sm">{fromAddr}</td>
                    <td className="p-4 text-bitcoin font-medium">{formatBTC(amount)}</td>
                    <td className="p-4 text-sm">{toAddr}</td>
                    <td className="p-4 font-mono text-sm">
                      <Link to={`/tx/${tx.txid}`} className="text-bitcoin hover:underline">
                        {tx.txid}
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
