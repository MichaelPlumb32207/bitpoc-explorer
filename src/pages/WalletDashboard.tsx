// File: src/pages/WalletDashboard.tsx
import { useState } from 'react';
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
  const [feeRate, setFeeRate] = useState<'economy' | 'normal' | 'priority'>('normal');
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [sendError, setSendError] = useState('');
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

  // Placeholder send function - will be replaced once Wallet.ts is updated
  const sendTransaction = async () => {
    if (isMainnet) {
      setShowMainnetConfirm(true);
      return;
    }

    setSending(true);
    setSendError('');
    setTxHash('');

    try {
      // Temporary placeholder until Wallet.ts helpers are added
      alert('Send functionality coming soon! Wallet helpers are being implemented.');
    } catch (err: any) {
      setSendError(err.message || 'Transaction failed');
    } finally {
      setSending(false);
    }
  };

  const confirmAndSend = () => {
    setShowMainnetConfirm(false);
    sendTransaction(); // Will trigger the placeholder again on mainnet
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

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-lg max-w-lg w-full">
              <h3 className="text-2xl mb-4">Create New Wallet</h3>
              <div className="mb-4">
                <label className="block mb-2">Word count</label>
                <select
                  value={wordCount}
                  onChange={(e) => setWordCount(Number(e.target.value) as 128 | 256)}
                  className="w-full px-4 py-2 bg-gray-700 rounded"
                >
                  <option value={128}>12 words</option>
                  <option value={256}>24 words (more secure)</option>
                </select>
              </div>
              <div className="mb-6">
                <label className="block mb-2">
                  Optional passphrase (recommended for extra protection)
                </label>
                <input
                  type="password"
                  value={newPassphrase}
                  onChange={(e) => setNewPassphrase(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded"
                  placeholder="Leave empty for no passphrase"
                />
                <p className="text-xs text-gray-400 mt-2">
                  This salts your seed – different passphrase = different wallet
                </p>
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-bitcoin text-black font-semibold rounded hover:bg-orange-400"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-lg max-w-lg w-full">
              <h3 className="text-2xl mb-4">Import Wallet</h3>
              <div className="mb-4">
                <label className="block mb-2">Seed phrase (12 or 24 words)</label>
                <textarea
                  value={importMnemonic}
                  onChange={(e) => setImportMnemonic(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 bg-gray-700 rounded font-mono text-sm"
                  placeholder="word1 word2 word3 ..."
                />
              </div>
              <div className="mb-6">
                <label className="block mb-2">Optional passphrase</label>
                <input
                  type="password"
                  value={importPassphrase}
                  onChange={(e) => setImportPassphrase(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded"
                />
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  className="px-4 py-2 bg-bitcoin text-black font-semibold rounded hover:bg-orange-400"
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        )}
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
              Transaction broadcast! TXID: <span className="font-mono">{txHash}</span>
            </div>
          )}
          {sendError && (
            <div className="mb-6 p-4 bg-red-900 rounded">{sendError}</div>
          )}
          <div className="space-y-6">
            <div>
              <label className="block mb-2">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded"
                placeholder="tb1q... or bc1q..."
              />
            </div>
            <div>
              <label className="block mb-2">Amount (sats)</label>
              <input
                type="number"
                value={amountSats}
                onChange={(e) => setAmountSats(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded"
                placeholder="10000"
              />
            </div>
            <div>
              <label className="block mb-2">Fee Rate</label>
              <select
                value={feeRate}
                onChange={(e) => setFeeRate(e.target.value as 'economy' | 'normal' | 'priority')}
                className="w-full px-4 py-2 bg-gray-700 rounded"
              >
                <option value="economy">Economy (~1 sat/vB)</option>
                <option value="normal">Normal (~5 sat/vB)</option>
                <option value="priority">Priority (~10 sat/vB)</option>
              </select>
            </div>
            <button
              onClick={sendTransaction}
              disabled={sending || !recipient || !amountSats}
              className="w-full py-3 bg-bitcoin text-black font-bold rounded hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {sending ? 'Sending...' : 'Send Transaction'}
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
                onClick={confirmAndSend}
                className="px-6 py-3 bg-red-600 text-white font-bold rounded hover:bg-red-500"
              >
                I Understand – Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seed Backup Modal */}
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
