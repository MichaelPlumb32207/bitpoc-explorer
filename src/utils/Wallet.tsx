// File: src/utils/Wallet.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';

// Initialize BIP32 with the ECC library (correct for tiny-secp256k1 v2+)
const bip32 = BIP32Factory(ecc);

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
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Use testnet - change to bitcoin.networks.bitcoin for mainnet
const NETWORK = bitcoin.networks.testnet;

const STORAGE_KEY = 'bitpoc-wallet';

interface StoredWallet {
  mnemonic: string;
  passphrase: string;
  currentReceiveIndex: number;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [passphrase, setPassphraseState] = useState('');
  const [receiveAddresses, setReceiveAddresses] = useState<string[]>([]);
  const [currentReceiveIndex, setCurrentReceiveIndex] = useState(0);
  const [initError, setInitError] = useState<string | null>(null);

  // Load wallet from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredWallet = JSON.parse(stored);
        console.log('Loaded wallet from storage:', parsed);
        setMnemonic(parsed.mnemonic);
        setPassphraseState(parsed.passphrase || '');
        setCurrentReceiveIndex(parsed.currentReceiveIndex || 0);
      }
    } catch (e) {
      console.error('Failed to load wallet from storage', e);
      setInitError('Failed to load wallet - cleared storage');
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Re-derive addresses whenever mnemonic, passphrase, or index changes
  useEffect(() => {
    if (!mnemonic) {
      setReceiveAddresses([]);
      return;
    }

    try {
      console.log('Deriving addresses for mnemonic + passphrase');
      const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase);
      const root = bip32.fromSeed(seed, NETWORK);

      const newAddresses: string[] = [];
      for (let i = 0; i <= currentReceiveIndex; i++) {
        const path = `m/84'/1'/0'/0/${i}`;
        console.log(`Deriving path: ${path}`);
        const child = root.derivePath(path);
        const { address } = bitcoin.payments.p2wpkh({
          pubkey: child.publicKey,
          network: NETWORK,
        });
        if (address) {
          newAddresses.push(address);
          console.log(`Derived address ${i}: ${address}`);
        }
      }

      setReceiveAddresses(newAddresses);
    } catch (err: any) {
      console.error('Error deriving addresses:', err);
      setInitError(`Derivation failed: ${err.message}`);
      setReceiveAddresses([]);
    }
  }, [mnemonic, passphrase, currentReceiveIndex]);

  // Persist wallet state whenever it changes
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
    localStorage.removeItem(STORAGE_KEY);
  };

  if (initError) {
    return (
      <div className="p-8 text-red-500">
        <h2>Wallet Initialization Error</h2>
        <p>{initError}</p>
        <button onClick={clearWallet} className="mt-4 px-4 py-2 bg-red-600 rounded">
          Clear Wallet & Restart
        </button>
      </div>
    );
  }

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
