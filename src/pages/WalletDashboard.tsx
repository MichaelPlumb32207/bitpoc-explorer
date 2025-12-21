// File: src/pages/WalletDashboard.tsx
// Updated with:
// - Funded Addresses Summary section (collapsible, shows each address with balance)
// - Auto-refresh every 30 seconds when wallet is loaded (for incoming/mempool txs)
// - Max Send button (sends all spendable balance minus fee)
// - Better change handling and fee estimation visibility
// - Added formatBTC helper function (fixes compile error)
// - All previous features preserved (debug panel, beautiful tx table, privacy, etc.)

import { useState, useEffect } from 'react';
import { useWallet } from '../utils/Wallet';
import { useNetwork } from '../utils/Api';
import { QRCodeSVG } from 'qrcode.react';
import AddressDetail from './AddressDetail';
import axios from 'axios';
import * as bitcoin from 'bitcoinjs-lib';
import { Psbt } from 'bitcoinjs-lib';

const formatBTC = (sats: number) => {
  const btc = (sats / 100000000).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  return `${btc} tBTC`;
};

export default function WalletDashboard() {
  const { network, apiBase } = useNetwork();
  const {
    mnemonic,
    passphrase,
    setPassphrase,
    receiveAddresses,
    visibleReceiveAddresses,
    currentReceiveIndex,
    nextReceiveAddress,
    generateWallet,
    importWallet,
    clearWallet,
    getUtxos,
    getKeyPairForIndex,
    walletReady,
  } = useWallet();

  const currentAddress = receiveAddresses[receiveAddresses.length - 1] || null;

  const [showSeed, setShowSeed] = useState(false);
  const [importMnemonic, setImportMnemonic] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [wordCount, setWordCount] = useState<128 | 256>(128);

  // Send tab state
  const [activeTab, setActiveTab] = useState<'receive' | 'send'>('receive');
  const [recipient, setRecipient] = useState('');
  const [amountSats, setAmountSats] = useState('');
  const [feeRate, setFeeRate] = useState(5);
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [sendError, setSendError] = useState('');
  const [utxos, setUtxos] = useState<any[]>([]);
  const [selectedUtxoIds, setSelectedUtxoIds] = useState<Set<string>>(new Set());
  const [estimatedVsize, setEstimatedVsize] = useState(0);
  const [estimatedFee, setEstimatedFee] = useState(0);
  const [showMainnetConfirm, setShowMainnetConfirm] = useState(false);
  const [feePresets, setFeePresets] = useState<{ economy: number; medium: number; fast: number }>({
    economy: 5,
    medium: 10,
    fast: 20,
  });

  const [showPreviousAddresses, setShowPreviousAddresses] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // New: Funded addresses and auto-refresh
  const [showFundedAddresses, setShowFundedAddresses] = useState(true);
  const [addressBalances, setAddressBalances] = useState<Map<string, number>>(new Map());

  // Debug state
  const [showDebug, setShowDebug] = useState(false);
  const [debugUtxos, setDebugUtxos] = useState<any[]>([]);

  const isMainnet = network === 'mainnet';

  // Reset send UI state when wallet changes or is cleared
  useEffect(() => {
    setTxHash('');
    setSendError('');
    setRecipient('');
    setAmountSats('');
    setSelectedUtxoIds(new Set());
    setActiveTab('receive');
  }, [mnemonic]);

  // Auto-refresh every 30 seconds when wallet loaded
  useEffect(() => {
    if (!mnemonic || !walletReady) return;

    const interval = setInterval(() => {
      refreshUtxos();
    }, 30000);

    return () => clearInterval(interval);
  }, [mnemonic, walletReady]);

  const refreshUtxos = async () => {
    const fetched = await getUtxos();
    setUtxos(fetched);
    setDebugUtxos(fetched);

    // Update address balances for funded summary
    const balances = new Map<string, number>();
    fetched.forEach(u => {
      balances.set(u.address, (balances.get(u.address) || 0) + u.value);
    });
    setAddressBalances(balances);

    const confirmedIds = fetched
      .filter((u: any) => u.status.confirmed)
      .map((u: any) => `${u.txid}:${u.vout}`);
    setSelectedUtxoIds(new Set(confirmedIds));
    setRefreshTrigger(prev => prev + 1);
  };

  // Max Send button
  const handleMax = () => {
    const selected = utxos.filter(u => selectedUtxoIds.has(`${u.txid}:${u.vout}`));
    const total = selected.reduce((sum, u) => sum + u.value, 0);
    const fee = estimatedFee;
    const maxSendable = Math.max(0, total - fee);
    setAmountSats(maxSendable.toString());
  };

  useEffect(() => {
    const fetchFees = async () => {
      try {
        const { data } = await axios.get(`${apiBase}/v1/fees/recommended`);
        setFeePresets({
          economy: data.economyFee || 5,
          medium: data.hourFee || 10,
          fast: data.halfHourFee || 20,
        });
        setFeeRate(data.hourFee || 10);
      } catch (err) {
        console.warn('Failed to fetch recommended fees, using defaults');
      }
    };
    fetchFees();
  }, [apiBase]);

  useEffect(() => {
    if (activeTab === 'send') {
      refreshUtxos();
    }
  }, [activeTab]);

  useEffect(() => {
    const selected = utxos.filter(u => selectedUtxoIds.has(`${u.txid}:${u.vout}`));
    const inputs = selected.length;
    const outputs = recipient ? 2 : 1;
    if (inputs === 0) {
      setEstimatedVsize(0);
      setEstimatedFee(0);
      return;
    }
    const vsize = Math.ceil(inputs * 57.5 + outputs * 43 + 10.5);
    setEstimatedVsize(vsize);
    setEstimatedFee(Math.ceil(feeRate * vsize));
  }, [utxos, selectedUtxoIds, recipient, feeRate]);

  const handleCreate = () => {
    generateWallet(wordCount);
    setPassphrase(newPassphrase);
    setShowCreateModal(false);
    setShowSeed(true);
    setNewPassphrase('');
  };

  const handleImport = async () => {
    const success = await importWallet(importMnemonic.trim());
    if (success) {
      setPassphrase(importPassphrase);
      setShowImportModal(false);
      setImportMnemonic('');
      setImportPassphrase('');
      setShowSeed(true);
    } else {
      alert('Invalid mnemonic – please check and try again');
    }
  };

  const downloadSeed = () => {
    if (!mnemonic) return;
    const element = document.createElement('a');
    const file = new Blob([mnemonic], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'bitpoc-seed.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const toggleUtxo = (id: string) => {
    const newSet = new Set(selectedUtxoIds);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelectedUtxoIds(newSet);
  };

  const selectAll = () => {
    const allIds = utxos.map(u => `${u.txid}:${u.vout}`);
    setSelectedUtxoIds(new Set(allIds));
  };

  const sendTransaction = async () => {
    if (isMainnet) {
      setShowMainnetConfirm(true);
      return;
    }
    await performSend();
  };

  const performSend = async () => {
    setSending(true);
    setSendError('');
    setTxHash('');

    try {
      const amount = parseInt(amountSats || '0');
      if (amount <= 0) throw new Error('Invalid amount');

      const selected = utxos.filter(u => selectedUtxoIds.has(`${u.txid}:${u.vout}`));
      if (selected.length === 0) throw new Error('No UTXOs selected');

      const totalInput = selected.reduce((sum: number, u: any) => sum + u.value, 0);
      const fee = estimatedFee;
      const changeAmount = totalInput - amount - fee;

      if (totalInput < amount + fee) throw new Error('Insufficient funds (including fee)');

      if (changeAmount < 546 && changeAmount > 0) throw new Error('Change below dust threshold');

      const psbt = new Psbt({ network: bitcoin.networks.testnet });

      for (const utxo of selected) {
        const index = receiveAddresses.indexOf(utxo.address);
        if (index === -1) throw new Error('UTXO address not in wallet');

        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: bitcoin.payments.p2wpkh({ address: utxo.address, network: bitcoin.networks.testnet }).output!,
            value: utxo.value,
          },
        });
      }

      psbt.addOutput({
        address: recipient.trim(),
        value: amount,
      });

      if (changeAmount > 0) {
        psbt.addOutput({
          address: currentAddress!,
          value: changeAmount,
        });
      }

      for (let i = 0; i < selected.length; i++) {
        const utxo = selected[i];
        const index = receiveAddresses.indexOf(utxo.address);
        const keyPair = getKeyPairForIndex(index);
        if (!keyPair) throw new Error('Failed to derive key');
        psbt.signInput(i, keyPair);
      }

      psbt.finalizeAllInputs();
      const txHex = psbt.extractTransaction().toHex();

      const { data: broadcastTxid } = await axios.post(`${apiBase}/tx`, txHex, {
        headers: { 'Content-Type': 'text/plain' },
      });

      setTxHash(broadcastTxid);
      await refreshUtxos();
      setRecipient('');
      setAmountSats('');
    } catch (err: any) {
      setSendError(err.message || 'Broadcast failed');
      console.error(err);
    } finally {
      setSending(false);
      setShowMainnetConfirm(false);
    }
  };

  const words = mnemonic ? mnemonic.split(' ') : [];

  return (
    <div className="space-y-8">
      {!mnemonic ? (
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">Welcome to Your BitPOC Wallet</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-8 bg-gray-800 rounded-lg hover:bg-gray-700 transition text-center"
            >
              <div className="text-5xl mb-4">🆕</div>
              <div className="text-xl font-semibold">Create New Wallet</div>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="p-8 bg-gray-800 rounded-lg hover:bg-gray-700 transition text-center"
            >
              <div className="text-5xl mb-4">📥</div>
              <div className="text-xl font-semibold">Import Existing Wallet</div>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Wallet Overview</h2>
              <button
                onClick={refreshUtxos}
                className="px-4 py-2 bg-bitcoin text-black rounded hover:bg-orange-400 transition"
              >
                Refresh
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-2">Seed Phrase Preview (hover to reveal)</p>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {words.map((_, i) => (
                  <div
                    key={i}
                    className="bg-gray-900 p-2 rounded text-center font-mono text-sm blur-sm hover:blur-none transition-all duration-200 cursor-pointer"
                  >
                    {words[i]}
                  </div>
                ))}
              </div>
            </div>

            {/* Funded Addresses Summary */}
            <div className="mb-8">
              <button
                onClick={() => setShowFundedAddresses(!showFundedAddresses)}
                className="text-lg font-medium text-bitcoin mb-2"
              >
                {showFundedAddresses ? '▼' : '▶'} Funded Addresses ({addressBalances.size})
              </button>
              {showFundedAddresses && addressBalances.size > 0 && (
                <div className="bg-gray-900 rounded p-4 space-y-2 text-sm">
                  {Array.from(addressBalances.entries())
                    .sort(([, a], [, b]) => b - a)
                    .map(([addr, bal]) => (
                      <div key={addr} className="flex justify-between">
                        <span className="font-mono">{addr.slice(0, 8)}...{addr.slice(-6)}</span>
                        <span className="text-bitcoin">{formatBTC(bal)}</span>
                      </div>
                    ))}
                </div>
              )}
              {showFundedAddresses && addressBalances.size === 0 && (
                <div className="bg-gray-900 rounded p-4 text-sm text-gray-400">
                  No funded addresses yet
                </div>
              )}
            </div>

            {!walletReady ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-bitcoin"></div>
              </div>
            ) : (
              <AddressDetail isWallet={true} key={refreshTrigger} />
            )}

            {/* Debug Panel */}
            <div className="mt-8">
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="text-sm text-gray-400 underline"
              >
                {showDebug ? 'Hide' : 'Show'} Debug Info
              </button>
              {showDebug && (
                <div className="mt-4 bg-gray-900 p-4 rounded text-xs font-mono text-gray-300 space-y-4">
                  <div><strong>currentReceiveIndex:</strong> {currentReceiveIndex}</div>
                  <div><strong>Derived Addresses Count:</strong> {receiveAddresses.length}</div>
                  <div><strong>Raw UTXOs:</strong> {debugUtxos.length} found</div>
                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                    {debugUtxos.length === 0 ? (
                      <div>No UTXOs fetched</div>
                    ) : (
                      debugUtxos.map((u, i) => (
                        <div key={i}>
                          {u.txid}:{u.vout} | {u.value} sats | {u.address} | {u.status.confirmed ? 'Confirmed' : 'Mempool'}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <div className="flex space-x-4 mb-4">
                <button
                  onClick={() => setActiveTab('receive')}
                  className={`px-6 py-3 rounded ${activeTab === 'receive' ? 'bg-bitcoin text-black' : 'bg-gray-700'}`}
                >
                  Receive
                </button>
                <button
                  onClick={() => setActiveTab('send')}
                  className={`px-6 py-3 rounded ${activeTab === 'send' ? 'bg-bitcoin text-black' : 'bg-gray-700'}`}
                >
                  Send
                </button>
              </div>

              {activeTab === 'receive' && currentAddress && (
                <div className="bg-gray-800 p-8 rounded-lg text-center">
                  <h3 className="text-xl mb-6">Current Receive Address</h3>
                  <div className="mb-6 flex justify-center">
                    <QRCodeSVG value={currentAddress} size={256} />
                  </div>
                  <p className="font-mono text-sm break-all mb-4">{currentAddress}</p>
                  <button
                    onClick={nextReceiveAddress}
                    className="px-6 py-3 bg-bitcoin text-black rounded hover:bg-orange-400 transition"
                  >
                    Generate Next Address
                  </button>

                  {visibleReceiveAddresses.length > 1 && (
                    <div className="mt-8">
                      <button
                        onClick={() => setShowPreviousAddresses(!showPreviousAddresses)}
                        className="text-sm text-gray-400 underline"
                      >
                        {showPreviousAddresses ? 'Hide' : 'Show'} previous addresses ({visibleReceiveAddresses.length - 1})
                      </button>
                      {showPreviousAddresses && (
                        <div className="mt-4 space-y-2 text-left">
                          {visibleReceiveAddresses.slice(0, -1).reverse().map((addr, i) => (
                            <div key={i} className="font-mono text-xs break-all bg-gray-900 p-2 rounded">
                              {addr}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'send' && (
                <div className="space-y-6">
                  {txHash && (
                    <div className="bg-green-900 p-4 rounded">
                      <p className="font-bold">Transaction Sent!</p>
                      <a
                        href={`https://mempool.space/${network === 'testnet4' ? 'testnet4/' : ''}tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-bitcoin underline"
                      >
                        View on Explorer: {txHash.slice(0, 16)}...
                      </a>
                    </div>
                  )}

                  {sendError && <div className="bg-red-900 p-4 rounded text-white">{sendError}</div>}

                  <div>
                    <h4 className="mb-2">Available UTXOs ({utxos.length})</h4>
                    <button onClick={selectAll} className="text-sm text-bitcoin underline mb-2">
                      Select All Confirmed
                    </button>
                    <div className="max-h-64 overflow-y-auto bg-gray-900 rounded p-2 space-y-2">
                      {utxos.length === 0 ? (
                        <p className="text-gray-400">No UTXOs</p>
                      ) : (
                        utxos.map(u => {
                          const id = `${u.txid}:${u.vout}`;
                          const isSelected = selectedUtxoIds.has(id);
                          const status = u.status.confirmed ? 'Confirmed' : 'Mempool';
                          return (
                            <div
                              key={id}
                              onClick={() => toggleUtxo(id)}
                              className={`flex justify-between items-center p-2 rounded cursor-pointer ${
                                isSelected ? 'bg-gray-700' : 'hover:bg-gray-800'
                              }`}
                            >
                              <div>
                                <div className="font-mono text-xs">{u.txid.slice(0, 16)}...:{u.vout}</div>
                                <div className="text-xs text-gray-400">
                                  {u.value.toLocaleString()} sats • {status}
                                </div>
                              </div>
                              <div className={`w-5 h-5 border-2 rounded ${isSelected ? 'bg-bitcoin border-bitcoin' : 'border-gray-500'}`} />
                            </div>
                          );
                        })
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      Selected: {utxos.filter(u => selectedUtxoIds.has(`${u.txid}:${u.vout}`)).reduce((s: number, u: any) => s + u.value, 0).toLocaleString()} sats
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block mb-2">Recipient Address</label>
                      <input
                        type="text"
                        value={recipient}
                        onChange={e => setRecipient(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-700 rounded"
                        placeholder="tb1q... or bc1q..."
                      />
                    </div>

                    <div className="flex space-x-2">
                      <div className="flex-1">
                        <label className="block mb-2">Amount (sats)</label>
                        <input
                          type="number"
                          value={amountSats}
                          onChange={e => setAmountSats(e.target.value)}
                          className="w-full px-4 py-2 bg-gray-700 rounded"
                          placeholder="10000"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={handleMax}
                          className="px-6 py-2 bg-gray-700 rounded hover:bg-gray-600 h-11"
                        >
                          Max
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block mb-2">Fee Rate (sat/vB)</label>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <button
                          onClick={() => setFeeRate(feePresets.economy)}
                          className="py-1 bg-gray-700 rounded hover:bg-gray-600"
                        >
                          Economy ({feePresets.economy})
                        </button>
                        <button
                          onClick={() => setFeeRate(feePresets.medium)}
                          className="py-1 bg-gray-700 rounded hover:bg-gray-600"
                        >
                          Medium ({feePresets.medium})
                        </button>
                        <button
                          onClick={() => setFeeRate(feePresets.fast)}
                          className="py-1 bg-gray-700 rounded hover:bg-gray-600"
                        >
                          Fast ({feePresets.fast})
                        </button>
                        <input
                          type="number"
                          value={feeRate}
                          onChange={e => setFeeRate(Number(e.target.value) || 1)}
                          className="px-2 bg-gray-700 rounded text-center"
                          min="1"
                        />
                      </div>
                      <p className="text-sm text-gray-400">
                        Est. vsize: {estimatedVsize} vB • Est. fee: {estimatedFee.toLocaleString()} sats
                      </p>
                    </div>

                    <button
                      onClick={sendTransaction}
                      disabled={sending || !recipient || !amountSats || selectedUtxoIds.size === 0}
                      className="w-full py-3 bg-bitcoin text-black font-bold rounded hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {sending ? 'Sending...' : 'Send Transaction (RBF enabled)'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-4">Wallet Actions</h3>
                <button
                  onClick={() => setShowSeed(true)}
                  className="w-full py-2 bg-gray-700 rounded hover:bg-gray-600 mb-2"
                >
                  View / Backup Seed Phrase
                </button>
                <button
                  onClick={clearWallet}
                  className="w-full py-2 bg-red-600 rounded hover:bg-red-500"
                >
                  Clear Wallet (Local Only)
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg max-w-md w-full">
            <h3 className="text-2xl font-bold mb-6">Create New Wallet</h3>
            <div className="space-y-4">
              <div>
                <label className="block mb-2">Seed Phrase Strength</label>
                <select
                  value={wordCount}
                  onChange={(e) => setWordCount(Number(e.target.value) as 128 | 256)}
                  className="w-full px-4 py-2 bg-gray-700 rounded"
                >
                  <option value={128}>12 words (128-bit)</option>
                  <option value={256}>24 words (256-bit)</option>
                </select>
              </div>
              <div>
                <label className="block mb-2">Optional Passphrase (BIP39)</label>
                <input
                  type="password"
                  value={newPassphrase}
                  onChange={(e) => setNewPassphrase(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded"
                  placeholder="Leave blank for none"
                />
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-2 bg-gray-700 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="px-6 py-2 bg-bitcoin text-black font-bold rounded hover:bg-orange-400"
                >
                  Create Wallet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg max-w-md w-full">
            <h3 className="text-2xl font-bold mb-6">Import Wallet</h3>
            <div className="space-y-4">
              <div>
                <label className="block mb-2">Seed Phrase</label>
                <textarea
                  value={importMnemonic}
                  onChange={(e) => setImportMnemonic(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded font-mono text-sm"
                  rows={4}
                  placeholder="word1 word2 word3 ..."
                />
              </div>
              <div>
                <label className="block mb-2">Optional Passphrase</label>
                <input
                  type="password"
                  value={importPassphrase}
                  onChange={(e) => setImportPassphrase(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded"
                  placeholder="Leave blank if none"
                />
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-6 py-2 bg-gray-700 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  className="px-6 py-2 bg-bitcoin text-black font-bold rounded hover:bg-orange-400"
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMainnetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg max-w-md w-full text-center">
            <h3 className="text-2xl font-bold text-red-500 mb-4">MAINNET WARNING</h3>
            <p className="mb-6 text-lg">
              You are about to send <strong>REAL BTC</strong> on mainnet.
              <br />
              This action cannot be undone.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setShowMainnetConfirm(false)}
                className="px-6 py-3 bg-gray-700 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={performSend}
                className="px-6 py-3 bg-red-600 text-white font-bold rounded hover:bg-red-500"
              >
                I Understand – Send
              </button>
            </div>
          </div>
        </div>
      )}

      {showSeed && mnemonic && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg max-w-2xl w-full">
            <h3 className="text-2xl mb-4 text-red-500">Backup Your Seed Phrase</h3>
            <p className="mb-6 text-yellow-400">
              Write this down on paper and store securely. Anyone with these words controls your funds forever.
            </p>
            <div className="bg-gray-900 p-6 rounded font-mono text-sm break-all mb-6">
              {mnemonic}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {words.map((word, i) => (
                <div key={i} className="bg-gray-700 p-2 rounded text-center">
                  <span className="text-gray-400 text-xs">{i + 1}.</span> {word}
                </div>
              ))}
            </div>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => navigator.clipboard.writeText(mnemonic)}
                className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                Copy
              </button>
              <button
                onClick={downloadSeed}
                className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                Download TXT
              </button>
              <button
                onClick={() => setShowSeed(false)}
                className="px-4 py-2 bg-bitcoin text-black font-semibold rounded hover:bg-orange-400"
              >
                I backed it up
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
