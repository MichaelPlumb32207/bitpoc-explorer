// File: src/utils/Wallet.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
import ecc from '@bitcoinerlab/secp256k1';
import axios from 'axios';
import { useNetwork } from './Api'; // Add this import

// Initialize BIP32 with the ECC library
const bip32 = BIP32Factory(ecc);

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
  receiveAddresses: string[];
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
  const { apiBase } = useNetwork(); // Get dynamic API base

  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [passphrase, setPassphraseState] = useState('');
  const [receiveAddresses, setReceiveAddresses] = useState<string[]>([]);
  const [currentReceiveIndex, setCurrentReceiveIndex] = useState(0);
  const [root, setRoot] = useState<any>(null);

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

  // Derive root and addresses
  useEffect(() => {
    if (!mnemonic) {
      setReceiveAddresses([]);
      setRoot(null);
      return;
    }

    try {
      const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase);
      const newRoot = bip32.fromSeed(seed, NETWORK);
      setRoot(newRoot);

      const newAddresses: string[] = [];
      for (let i = 0; i <= currentReceiveIndex; i++) {
        const path = `m/84'/1'/0'/0/${i}`;
        const child = newRoot.derivePath(path);
        const { address } = bitcoin.payments.p2wpkh({
          pubkey: child.publicKey,
          network: NETWORK,
        });
        if (address) {
          newAddresses.push(address);
        }
      }
      setReceiveAddresses(newAddresses);
    } catch (err: any) {
      console.error('Error deriving wallet:', err);
      setReceiveAddresses([]);
      setRoot(null);
    }
  }, [mnemonic, passphrase, currentReceiveIndex]);

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
    setReceiveAddresses([]);
    setCurrentReceiveIndex(0);
    setRoot(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Use dynamic apiBase for UTXO fetch
  const getUtxos = async (): Promise<UTXO[]> => {
    if (!receiveAddresses.length) return [];

    const utxos: UTXO[] = [];
    for (const address of receiveAddresses) {
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
        receiveAddresses,
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
