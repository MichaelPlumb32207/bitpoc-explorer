// File: src/utils/api.ts
import { useState, useEffect } from 'react';

type Network = 'testnet4' | 'mainnet';

const BASE_URLS: Record<Network, string> = {
  testnet4: 'https://mempool.space/testnet4/api',
  mainnet: 'https://mempool.space/api',
};

export const useNetwork = () => {
  const [network, setNetwork] = useState<Network>(() => {
    const saved = localStorage.getItem('network') as Network | null;
    return saved || 'testnet4';
  });

  useEffect(() => {
    localStorage.setItem('network', network);
  }, [network]);

  const apiBase = BASE_URLS[network];

  const toggleNetwork = () => {
    setNetwork(prev => prev === 'testnet4' ? 'mainnet' : 'testnet4');
  };

  return { network, apiBase, toggleNetwork };
};
