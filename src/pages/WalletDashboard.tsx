// File: src/pages/WalletDashboard.tsx
import { useState, useEffect } from 'react';
import { useWallet } from '../utils/Wallet';
import { useNetwork } from '../utils/Api';
import { QRCodeSVG } from 'qrcode.react';
import AddressDetail from './AddressDetail';
import axios from 'axios';
import * as bitcoin from 'bitcoinjs-lib';

export default function WalletDashboard() {
  const { network, apiBase } = useNetwork();
  const {
    mnemonic,
    passphrase,
    setPassphrase,
    receiveAddresses,
    currentReceiveIndex,
    nextReceiveAddress,
    generateWallet,
    importWallet,
    clearWallet,
    getUtxos,
    getKeyPairForIndex,
    network: walletNetwork,
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
  const [feeRate, setFeeRate] = useState(5); // sat/vB
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [sendError, setSendError] = useState('');
  const [utxos, setUtxos] = useState<any[]>([]);
  const [selectedUtxoIds, setSelectedUtxoIds] = useState<Set<string>>(new Set());
  const [estimatedFee, setEstimatedFee] = useState(0);
  const [showMainnetConfirm, setShowMainnetConfirm] = useState(false);

  const isMainnet = network === 'mainnet';

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

  const words = mnemonic ? mnemonic.split(' ') : [];

  // Load UTXOs when Send tab is active
  useEffect(() => {
    if (activeTab === 'send') {
      getUtxos()
        .then(fetched => {
          setUtxos(fetched);
          // Auto-select all confirmed UTXOs by default
          const confirmedIds = fetched
            .filter((u: any) => u.status.confirmed)
            .map((u: any) => `${u.txid}:${u.vout}`);
          setSelectedUtxoIds(new Set(confirmedIds));
        })
        .catch(console.error);
    }
  }, [activeTab, getUtxos]);

  // Estimate fee based on selected UTXOs
  useEffect(() => {
    const selected = utxos.filter(u => selectedUtxoIds.has(`${u.txid}:${u.vout}`));
    const amount = parseInt(amountSats) || 0;
    if (selected.length === 0 || amount <= 0 || !recipient) {
      setEstimatedFee(0);
      return;
    }

    const inputs = selected.length;
    const outputs = 2; // recipient + change (we always include change if possible)
    const vsize = inputs * 68 + outputs * 43 + 11; // rough P2WPKH estimate + overhead
    setEstimatedFee(Math.ceil(feeRate * vsize));
  }, [utxos, selectedUtxoIds, amountSats, recipient, feeRate]);

  const toggleUtxo = (id: string) => {
    const newSet = new Set(selectedUtxoIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
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
      const amount = parseInt(amountSats);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid amount');

      const selected = utxos.filter(u => selectedUtxoIds.has(`${u.txid}:${u.vout}`));
      if (selected.length === 0) throw new Error('No UTXOs selected');

      const totalInput = selected.reduce((sum: number, u: any) => sum + u.value, 0);
      const fee = estimatedFee || Math.ceil(feeRate * 250);
      const change = totalInput - amount - fee;

      if (change < 0) throw new Error('Outputs are spending more than inputs (check amount + fee)');

      const psbt = new bitcoin.Psbt({ network: walletNetwork });

      let inputSum = 0;
      for (const utxo of selected) {
        const index = receiveAddresses.indexOf(utxo.address);
        const keyPair = getKeyPairForIndex(index);

        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: walletNetwork }).output!,
            value: utxo.value,
          },
          sequence: 0xfffffffd, // Enable RBF
        });

        inputSum += utxo.value;
      }

      psbt.addOutput({
        address: recipient,
        value: amount,
      });

      if (change > 546) {
        psbt.addOutput({
          address: currentAddress!,
          value: change,
        });
      }

      // Sign all inputs
      for (let i = 0; i < psbt.inputCount; i++) {
        const utxo = selected[i];
        const index = receiveAddresses.indexOf(utxo.address);
        const keyPair = getKeyPairForIndex(index);
        psbt.signInput(i, keyPair);
      }

      psbt.finalizeAllInputs();
      const txHex = psbt.extractTransaction().toHex();

      const broadcastRes = await axios.post(`${apiBase}/tx`, txHex);
      setTxHash(broadcastRes.data);
    } catch (err: any) {
      setSendError(err.message || 'Transaction failed');
      console.error(err);
    } finally {
      setSending(false);
      setShowMainnetConfirm(false);
    }
  };

  if (!mnemonic) {
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-4xl font-bold mb-8">Wallet</h2>
        <div className="bg-gray-800 p-8 rounded-lg text-center space-y-6">
          <p className="text-xl">No wallet connected</p>
          {isMainnet && (
            <p className="text-red-500 font-bold">
              Warning: You are on Mainnet – use small amounts only
            </p>
          )}
          <div className="space-x-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-bitcoin text-black font-semibold rounded hover:bg-orange-400 transition"
            >
              Create New Wallet
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-6 py-3 bg-gray-700 rounded hover:bg-gray-600 transition"
            >
              Import Existing Wallet
            </button>
          </div>
        </div>

        {/* Modals omitted for brevity - keep your existing ones */}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-8">
        <h2 className="text-4xl font-bold">My Wallet</h2>
        <div className="space-x-4">
          <button
            onClick={() => setShowSeed(true)}
            className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition"
          >
            Backup Seed
          </button>
          <button
            onClick={clearWallet}
            className="px-4 py-2 bg-red-600 rounded hover:bg-red-500 transition"
          >
            Disconnect
          </button>
        </div>
      </div>

      {isMainnet && (
        <div className="bg-red-900 p-4 rounded-lg mb-8 text-center font-bold">
          MAINNET: Use extreme caution – funds are real
        </div>
      )}

      <div className="flex space-x-4 mb-8 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('receive')}
          className={`pb-2 px-4 ${activeTab === 'receive' ? 'text-bitcoin border-b-2 border-bitcoin' : 'text-gray-400'}`}
        >
          Receive
        </button>
        <button
          onClick={() => setActiveTab('send')}
          className={`pb-2 px-4 ${activeTab === 'send' ? 'text-bitcoin border-b-2 border-bitcoin' : 'text-gray-400'}`}
        >
          Send
        </button>
      </div>

      {activeTab === 'receive' && currentAddress && (
        <>
          {/* Existing Receive tab UI - keep your current code */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-gray-800 p-6 rounded-lg">
              <div className="text-gray-400 text-sm mb-2">
                Next Receive Address (index {currentReceiveIndex})
              </div>
              <div className="font-mono text-sm break-all mb-4">{currentAddress}</div>
              <div className="flex justify-center">
                <QRCodeSVG value={currentAddress} size={200} bgColor="#1f2937" fgColor="#fff" />
              </div>
              <button
                onClick={nextReceiveAddress}
                className="mt-4 w-full px-4 py-2 bg-bitcoin text-black font-semibold rounded hover:bg-orange-400 transition"
              >
                Generate Next Receive Address
              </button>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
              <div className="text-gray-400 text-sm mb-2">Passphrase</div>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded mb-4"
                placeholder="Change passphrase (creates new wallet)"
              />
              <p className="text-xs text-gray-400">
                Changing this derives a different address
              </p>
            </div>
          </div>

          <div className="mb-12">
            <h3 className="text-xl font-semibold mb-4">Seed Phrase (hover to reveal one word at a time)</h3>
            <div className="bg-gray-900 p-6 rounded-lg flex flex-wrap gap-3">
              {words.map((word, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-gray-800 rounded font-mono text-sm blur-sm hover:blur-none transition"
                >
                  {i + 1}. {word}
                </span>
              ))}
            </div>
            <div className="mt-4 flex space-x-4">
              <button
                onClick={() => navigator.clipboard.writeText(mnemonic || '')}
                className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                Copy All Words
              </button>
              <button
                onClick={downloadSeed}
                className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                Download TXT
              </button>
            </div>
          </div>

          {receiveAddresses.length > 1 && (
            <div className="mb-12">
              <h3 className="text-xl font-semibold mb-4">Previous Receive Addresses</h3>
              <div className="space-y-4">
                {receiveAddresses.slice(0, -1).reverse().map((addr, i) => (
                  <div key={i} className="bg-gray-800 p-4 rounded-lg font-mono text-sm break-all">
                    Index {currentReceiveIndex - 1 - i}: {addr}
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentAddress && <AddressDetail overrideAddr={currentAddress} isWallet />}
        </>
      )}

      {activeTab === 'send' && (
        <div className="bg-gray-800 p-8 rounded-lg">
          <h3 className="text-2xl font-semibold mb-6">Send tBTC</h3>
          {txHash && (
            <div className="mb-6 p-4 bg-green-900 rounded">
              Transaction broadcast! TXID: <span className="font-mono break-all">{txHash}</span>
            </div>
          )}
          {sendError && (
            <div className="mb-6 p-4 bg-red-900 rounded">{sendError}</div>
          )}

          {/* UTXO Selection */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-lg font-semibold">Select UTXOs to Spend</h4>
              <button onClick={selectAll} className="text-sm text-bitcoin hover:underline">
                Select All
              </button>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
              {utxos.length === 0 ? (
                <p className="text-gray-400">No UTXOs found</p>
              ) : (
                <div className="space-y-2">
                  {utxos.map((u: any) => {
                    const id = `${u.txid}:${u.vout}`;
                    const isSelected = selectedUtxoIds.has(id);
                    const status = u.status.confirmed ? 'Confirmed' : 'Mempool';
                    return (
                      <div
                        key={id}
                        className={`flex items-center justify-between p-3 rounded cursor-pointer transition ${
                          isSelected ? 'bg-gray-700' : 'bg-gray-800 hover:bg-gray-700'
                        }`}
                        onClick={() => toggleUtxo(id)}
                      >
                        <div>
                          <div className="font-mono text-sm">{u.txid.slice(0, 16)}...:{u.vout}</div>
                          <div className="text-xs text-gray-400">
                            {u.address} • {u.value.toLocaleString()} sats • {status}
                          </div>
                        </div>
                        <div className={`w-5 h-5 border-2 rounded ${isSelected ? 'bg-bitcoin border-bitcoin' : 'border-gray-500'}`} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Selected: {utxos.filter(u => selectedUtxoIds.has(`${u.txid}:${u.vout}`)).reduce((s: number, u: any) => s + u.value, 0).toLocaleString()} sats
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block mb-2">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded"
                placeholder="tb1q..."
              />
            </div>
            <div>
              <label className="block mb-2">Amount (sats)</label>
              <input
                type="number"
                value={amountSats}
                onChange={(e) => setAmountSats(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded"
                placeholder="500000"
              />
            </div>
            <div>
              <label className="block mb-2">Fee Rate (sat/vB)</label>
              <input
                type="number"
                value={feeRate}
                onChange={(e) => setFeeRate(Number(e.target.value) || 1)}
                className="w-full px-4 py-2 bg-gray-700 rounded"
                min="1"
              />
              <p className="text-sm text-gray-400 mt-1">Estimated fee: ~{estimatedFee} sats</p>
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

      {/* Mainnet Confirmation Modal */}
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

      {/* Seed Backup Modal - keep your existing one */}
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
