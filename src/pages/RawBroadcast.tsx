// File: src/pages/RawBroadcast.tsx
// Updated with:
// - Full raw hex displayed (large textarea)
// - Live transaction decoder with preview panel (inputs/outputs with addresses/values)
// - Editable recipient amount and fee rate
// - Rebuild Transaction button updates hex live
// - Fixed compile error (removed tx.getFee() — not available on raw tx)
// - Broadcast uses updated hex
// - Success/error feedback

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNetwork } from '../utils/Api';
import * as bitcoin from 'bitcoinjs-lib';

const formatBTC = (sats: number) => {
  const btc = (sats / 100000000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  return `${btc} tBTC`;
};

const shortAddr = (addr: string) => addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : 'Unknown';

export default function RawBroadcast() {
  const { apiBase, network } = useNetwork();
  const NETWORK = network === 'testnet4' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

  const [rawHex, setRawHex] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; txid?: string; error?: string } | null>(null);

  // Parsed transaction state
  const [parsedTx, setParsedTx] = useState<any>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editFeeRate, setEditFeeRate] = useState<string>('');
  const [rebuildError, setRebuildError] = useState('');

  // Parse raw hex whenever it changes
  useEffect(() => {
    setParsedTx(null);
    setEditAmount('');
    setEditFeeRate('');
    setRebuildError('');
    setResult(null);

    if (!rawHex.trim()) return;

    try {
      const buffer = Buffer.from(rawHex.trim(), 'hex');
      const tx = bitcoin.Transaction.fromBuffer(buffer);

      const inputs = tx.ins.map((input, i) => ({
        txid: Buffer.from(input.hash).reverse().toString('hex'),
        vout: input.index,
      }));

      const outputs = tx.outs.map((output, i) => {
        try {
          const address = bitcoin.address.fromOutputScript(output.script, NETWORK);
          return { address, value: output.value, index: i };
        } catch {
          return { address: 'Non-standard/OP_RETURN', value: output.value, index: i };
        }
      });

      const totalOutput = outputs.reduce((sum, o) => sum + o.value, 0);
      const vsize = tx.virtualSize();

      setParsedTx({
        inputs,
        outputs,
        totalOutput,
        vsize,
        tx,
      });

      // Auto-fill edit fields
      if (outputs.length > 0) {
        setEditAmount(outputs[0].value.toString());
      }
      if (vsize > 0) {
        // Estimate fee rate from current tx (inputs unknown, so approximate)
        setEditFeeRate('1'); // Default, user can adjust
      }
    } catch (err) {
      // Invalid hex — ignore preview
    }
  }, [rawHex, NETWORK]);

  // Rebuild transaction when user edits amount or fee rate
  const rebuildTx = () => {
    if (!parsedTx) return;

    setRebuildError('');

    try {
      const amount = parseInt(editAmount || '0');
      const feeRateVal = parseInt(editFeeRate || '1');
      if (amount <= 0) throw new Error('Invalid amount');
      if (feeRateVal <= 0) throw new Error('Invalid fee rate');

      const newTx = parsedTx.tx.clone();

      // Update first output (recipient)
      if (newTx.outs.length > 0) {
        newTx.outs[0].value = amount;
      }

      // Adjust change output to match new fee
      const vsize = newTx.virtualSize();
      const targetFee = Math.ceil(vsize * feeRateVal);

      if (newTx.outs.length > 1) {
        // Approximate input total from original totalOutput + original fee estimate
        const approxInputTotal = parsedTx.totalOutput + targetFee; // Rough
        const newChange = approxInputTotal - amount - targetFee;
        if (newChange < 0) throw new Error('Insufficient funds for new fee');
        if (newChange < 546 && newChange > 0) throw new Error('Change below dust threshold');

        newTx.outs[newTx.outs.length - 1].value = newChange;
      }

      const newHex = newTx.toHex();
      setRawHex(newHex);
    } catch (err: any) {
      setRebuildError(err.message);
    }
  };

  const handleBroadcast = async () => {
    if (!rawHex.trim()) return;

    setBroadcasting(true);
    setResult(null);

    try {
      const { data: txid } = await axios.post(`${apiBase}/tx`, rawHex.trim(), {
        headers: { 'Content-Type': 'text/plain' },
      });
      setResult({ success: true, txid });
    } catch (err: any) {
      const errorMsg = err.response?.data || err.message || 'Broadcast failed';
      setResult({ success: false, error: errorMsg });
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold mb-8">Raw Transaction Broadcast</h2>
      <p className="text-gray-400 mb-6">
        Paste a signed raw transaction in hex format. View, edit amount/fee, and broadcast it.
      </p>

      <div className="bg-gray-800 rounded-lg p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Raw Transaction Hex</label>
          <textarea
            value={rawHex}
            onChange={(e) => setRawHex(e.target.value)}
            className="w-full h-96 px-4 py-3 bg-gray-900 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-bitcoin resize-none"
            placeholder="Paste full raw hex here..."
          />
        </div>

        {/* Transaction Preview */}
        {parsedTx && (
          <div className="bg-gray-900 rounded-lg p-6 space-y-6">
            <h3 className="text-xl font-bold">Decoded Transaction</h3>

            <div>
              <h4 className="font-medium mb-2">Inputs ({parsedTx.inputs.length})</h4>
              <div className="space-y-2 text-sm font-mono">
                {parsedTx.inputs.map((input: any, i: number) => (
                  <div key={i}>
                    {input.txid.slice(0, 16)}...:{input.vout}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Outputs ({parsedTx.outputs.length})</h4>
              <div className="space-y-2 text-sm">
                {parsedTx.outputs.map((output: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span className="font-mono">
                      {output.address} {i === parsedTx.outputs.length - 1 ? '(Change)' : '(Recipient)'}
                    </span>
                    <span>{formatBTC(output.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Total Output:</strong> {formatBTC(parsedTx.totalOutput)}
              </div>
              <div>
                <strong>vSize:</strong> {parsedTx.vsize} vB
              </div>
            </div>

            {/* Edit Panel */}
            <div className="border-t border-gray-700 pt-6">
              <h4 className="font-medium mb-4">Edit Transaction</h4>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm mb-1">Recipient Amount (sats)</label>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Target Fee Rate (sat/vB)</label>
                  <input
                    type="number"
                    value={editFeeRate}
                    onChange={(e) => setEditFeeRate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 rounded"
                    min="1"
                  />
                </div>
              </div>

              <button
                onClick={rebuildTx}
                className="px-6 py-2 bg-gray-700 rounded hover:bg-gray-600 transition"
              >
                Rebuild Transaction
              </button>

              {rebuildError && (
                <div className="mt-4 p-4 bg-red-900 rounded text-sm">
                  {rebuildError}
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleBroadcast}
          disabled={broadcasting || !rawHex.trim()}
          className="px-8 py-3 bg-bitcoin text-black font-bold rounded hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {broadcasting ? 'Broadcasting...' : 'Broadcast Transaction'}
        </button>

        {result && (
          <div className={`p-6 rounded-lg ${result.success ? 'bg-green-900' : 'bg-red-900'}`}>
            {result.success ? (
              <>
                <p className="font-bold mb-2">Transaction Broadcast Successfully!</p>
                <a
                  href={`https://mempool.space/${network === 'testnet4' ? 'testnet4/' : ''}tx/${result.txid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bitcoin underline break-all"
                >
                  View on Explorer: {result.txid}
                </a>
              </>
            ) : (
              <>
                <p className="font-bold mb-2">Broadcast Failed</p>
                <p className="font-mono text-sm break-all">{result.error}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
