// File: src/utils/Wallet.tsx
// Updated with increased lookahead for reliable UTXO fetching
// - LOOKAHEAD increased to 20 to cover more addresses
// - Ensures UTXOs from higher index addresses are discovered
// - walletReady still signals when derivation is complete
// - In-memory only (no localStorage)

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import BIP32Factory from 'bip32';
import ecc from '@bitcoinerlab/secp256k1';
import axios from 'axios';
import { useNetwork } from './Api';

const bip32 = BIP32Factory(ecc);

const LOOKAHEAD = 20; // Increased for better UTXO discovery

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
  visibleReceiveAddresses: string[];
  currentReceiveIndex: number;
  nextReceiveAddress: () => void;
  generateWallet: (wordCount: 128 | 256) => void;
  importWallet: (mnemonic: string) => Promise<boolean>;
  clearWallet: () => void;
  getUtxos: () => Promise<UTXO[]>;
  getKeyPairForIndex: (index: number) => any;
  walletReady: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const NETWORK = bitcoin.networks.testnet;

export function WalletProvider({ children }: { children: ReactNode }) {
  const { apiBase } = useNetwork();

  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [passphrase, setPassphraseState] = useState('');
  const [receiveAddresses, setReceiveAddresses] = useState<string[]>([]);
  const [visibleAddresses, setVisibleAddresses] = useState<string[]>([]);
  const [currentReceiveIndex, setCurrentReceiveIndex] = useState(0);
  const [root, setRoot] = useState<any>(null);
  const [walletReady, setWalletReady] = useState(false);

  useEffect(() => {
    if (!mnemonic) {
      setRoot(null);
      setWalletReady(false);
      return;
    }
    try {
      const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase);
      const newRoot = bip32.fromSeed(seed, NETWORK);
      setRoot(newRoot);
      setCurrentReceiveIndex(0);
    } catch (err) {
      console.error('Failed to derive root', err);
      setRoot(null);
    }
  }, [mnemonic, passphrase]);

  useEffect(() => {
    if (!root) {
      setReceiveAddresses([]);
      setVisibleAddresses([]);
      setWalletReady(false);
      return;
    }

    const deriveUpTo = currentReceiveIndex + LOOKAHEAD;
    const newAddresses: string[] = [];

    for (let i = 0; i <= deriveUpTo; i++) {
      const path = `m/84'/1'/0'/0/${i}`;
      const child = root.derivePath(path);
      const { address } = bitcoin.payments.p2wpkh({ pubkey: child.publicKey, network: NETWORK });
      if (address) newAddresses.push(address);
    }

    setReceiveAddresses(newAddresses);

    const start = Math.max(0, newAddresses.length - 10 - LOOKAHEAD);
    setVisibleAddresses(newAddresses.slice(start));

    setWalletReady(true);
  }, [root, currentReceiveIndex]);

  const setPassphrase = (p: string) => {
    setPassphraseState(p);
  };

  const generateWallet = (wordCount: 128 | 256) => {
    const strength = wordCount === 128 ? 128 : 256;
    const newMnemonic = bip39.generateMnemonic(strength);
    setMnemonic(newMnemonic);
  };

  const importWallet = async (importedMnemonic: string): Promise<boolean> => {
    if (!bip39.validateMnemonic(importedMnemonic)) {
      return false;
    }
    setMnemonic(importedMnemonic.trim());
    return true;
  };

  const nextReceiveAddress = () => {
    setCurrentReceiveIndex(prev => prev + 1);
  };

  const clearWallet = () => {
    setMnemonic(null);
    setPassphraseState('');
    setReceiveAddresses([]);
    setVisibleAddresses([]);
    setCurrentReceiveIndex(0);
    setRoot(null);
    setWalletReady(false);
  };

  const getUtxos = async (): Promise<UTXO[]> => {
    if (!receiveAddresses.length || !walletReady) return [];

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
        visibleReceiveAddresses: visibleAddresses,
        currentReceiveIndex,
        nextReceiveAddress,
        generateWallet,
        importWallet,
        clearWallet,
        getUtxos,
        getKeyPairForIndex,
        walletReady,
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
