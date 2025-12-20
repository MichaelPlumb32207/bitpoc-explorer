// File: src/utils/Wallet.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
import ecc from '@bitcoinerlab/secp256k1';
import axios from 'axios';
import { useNetwork } from './Api'; // For dynamic apiBase

// Initialize BIP32 with the ECC library (pure JS, no WASM)
const bip32 = BIP32Factory(ecc);

const GAP_LIMIT = 20; // Standard BIP44 gap limit for scanning
const LOOKAHEAD = 1;  // Number of unused addresses to keep visible (the next one)

interface UTXO {
  txid: string;
  vout: number;
  value: number;
  address: string;
  status: { confirmed: boolean };
}

interface WalletContextType {
  mnemonic: string | null;
  passphrase: string;
  setPassphrase: (p: string) => void;
  receiveAddresses: string[];        // All derived addresses (including lookahead)
  visibleReceiveAddresses: string[]; // Only addresses to display (used + lookahead)
  currentReceiveIndex: number;
  nextReceiveAddress: () => void;
  generateWallet: (wordCount: 128 | 256) => void;
  importWallet: (mnemonic: string) => Promise<boolean>;
  clearWallet: () => void;
  getUtxos: () => Promise<UTXO[]>;
  getKeyPairForIndex: (index: number) => any;
  network: any;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const NETWORK = bitcoin.networks.testnet;

const STORAGE_KEY = 'bitpoc-wallet';

interface StoredWallet {
  mnemonic: string;
  passphrase: string;
  currentReceiveIndex: number;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { apiBase } = useNetwork();

  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [passphrase, setPassphraseState] = useState('');
  const [allAddresses, setAllAddresses] = useState<string[]>([]);      // All derived up to current index
  const [visibleAddresses, setVisibleAddresses] = useState<string[]>([]); // Used + lookahead
  const [currentReceiveIndex, setCurrentReceiveIndex] = useState(0);
  const [root, setRoot] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Load wallet from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredWallet = JSON.parse(stored);
        setMnemonic(parsed.mnemonic);
        setPassphraseState(parsed.passphrase || '');
        setCurrentReceiveIndex(parsed.currentReceiveIndex || 0);
      }
    } catch (e) {
      console.error('Failed to load wallet from storage', e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Derive root when mnemonic/passphrase changes
  useEffect(() => {
    if (!mnemonic) {
      setRoot(null);
      return;
    }
    try {
      const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase);
      const newRoot = bip32.fromSeed(seed, NETWORK);
      setRoot(newRoot);
    } catch (err) {
      console.error('Failed to derive root', err);
      setRoot(null);
    }
  }, [mnemonic, passphrase]);

  // Scan for used addresses with gap limit when root is ready
  useEffect(() => {
    if (!root || isScanning) return;

    const scanForActivity = async () => {
      setIsScanning(true);
      let maxUsedIndex = -1;
      let consecutiveUnused = 0;
      let index = 0;

      while (consecutiveUnused < GAP_LIMIT) {
        const path = `m/84'/1'/0'/0/${index}`;
        const child = root.derivePath(path);
        const { address } = bitcoin.payments.p2wpkh({
          pubkey: child.publicKey,
          network: NETWORK,
        });

        if (!address) {
          index++;
          continue;
        }

        try {
          const { data } = await axios.get(`${apiBase}/address/${address}`);
          const hasActivity = data.chain_stats.tx_count > 0 || data.chain_stats.funded_txo_sum > 0;

          if (hasActivity) {
            maxUsedIndex = index;
            consecutiveUnused = 0;
          } else {
            consecutiveUnused++;
          }
        } catch (err) {
          consecutiveUnused++;
        }

        index++;
      }

      const newIndex = maxUsedIndex >= 0 ? maxUsedIndex + GAP_LIMIT + LOOKAHEAD - 1 : GAP_LIMIT + LOOKAHEAD - 1;
      setCurrentReceiveIndex(newIndex);
      setIsScanning(false);
    };

    scanForActivity();
  }, [root, apiBase]);

  // Derive all addresses up to current index
  useEffect(() => {
    if (!root) {
      setAllAddresses([]);
      setVisibleAddresses([]);
      return;
    }

    const derived: string[] = [];
    for (let i = 0; i <= currentReceiveIndex; i++) {
      const path = `m/84'/1'/0'/0/${i}`;
      const child = root.derivePath(path);
      const { address } = bitcoin.payments.p2wpkh({
        pubkey: child.publicKey,
        network: NETWORK,
      });
      if (address) {
        derived.push(address);
      }
    }
    setAllAddresses(derived);

    // Determine visible addresses: all used + LOOKAHEAD unused at the end
    const visible: string[] = [];
    let unusedStreak = 0;
    for (let i = derived.length - 1; i >= 0; i--) {
      // We can't know "used" here without another API call, so we show all up to the last LOOKAHEAD
      visible.unshift(derived[i]);
      unusedStreak++;
      if (unusedStreak >= LOOKAHEAD) break;
    }
    // If there are used addresses earlier, include them (simple: show last 10 + lookahead)
    // For better UX, we show only the last few + lookahead
    const start = Math.max(0, derived.length - 10 - LOOKAHEAD);
    setVisibleAddresses(derived.slice(start));
  }, [root, currentReceiveIndex]);

  // Persist wallet state
  useEffect(() => {
    if (mnemonic) {
      const toStore: StoredWallet = {
        mnemonic,
        passphrase,
        currentReceiveIndex,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    }
  }, [mnemonic, passphrase, currentReceiveIndex]);

  const setPassphrase = (p: string) => {
    setPassphraseState(p);
    setCurrentReceiveIndex(0);
  };

  const generateWallet = (wordCount: 128 | 256) => {
    const strength = wordCount === 128 ? 128 : 256;
    const newMnemonic = bip39.generateMnemonic(strength);
    setMnemonic(newMnemonic);
    setCurrentReceiveIndex(0);
  };

  const importWallet = async (importedMnemonic: string): Promise<boolean> => {
    if (!bip39.validateMnemonic(importedMnemonic)) {
      return false;
    }
    setMnemonic(importedMnemonic.trim());
    setCurrentReceiveIndex(0);
    return true;
  };

  const nextReceiveAddress = () => {
    setCurrentReceiveIndex((prev) => prev + 1);
  };

  const clearWallet = () => {
    setMnemonic(null);
    setPassphraseState('');
    setAllAddresses([]);
    setVisibleAddresses([]);
    setCurrentReceiveIndex(0);
    setRoot(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const getUtxos = async (): Promise<UTXO[]> => {
    if (!allAddresses.length) return [];

    const utxos: UTXO[] = [];
    for (const address of allAddresses) {
      try {
        const { data } = await axios.get(`${apiBase}/address/${address}/utxo`);
        data.forEach((u: any) => {
          utxos.push({
            txid: u.txid,
            vout: u.vout,
            value: u.value,
            address,
            status: u.status,
          });
        });
      } catch (err) {
        console.error(`Failed to fetch UTXOs for ${address}`, err);
      }
    }
    return utxos;
  };

  const getKeyPairForIndex = (index: number) => {
    if (!root) return null;
    const path = `m/84'/1'/0'/0/${index}`;
    return root.derivePath(path);
  };

  return (
    <WalletContext.Provider
      value={{
        mnemonic,
        passphrase,
        setPassphrase,
        receiveAddresses: allAddresses,
        visibleReceiveAddresses: visibleAddresses,
        currentReceiveIndex,
        nextReceiveAddress,
        generateWallet,
        importWallet,
        clearWallet,
        getUtxos,
        getKeyPairForIndex,
        network: NETWORK,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
