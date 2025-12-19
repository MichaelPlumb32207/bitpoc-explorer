import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type NetworkType = 'mainnet' | 'testnet4';

interface NetworkContextType {
  apiBase: string;
  network: NetworkType;
  setNetwork: (network: NetworkType) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState<NetworkType>(() => {
    // Persist across reloads, default to mainnet
    const saved = localStorage.getItem('network') as NetworkType | null;
    return saved || 'mainnet';
  });

  useEffect(() => {
    localStorage.setItem('network', network);
  }, [network]);

  const apiBase = network === 'mainnet'
    ? 'https://mempool.space/api'
    : 'https://mempool.space/testnet4/api';

  return (
    <NetworkContext.Provider value={{ apiBase, network, setNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};
