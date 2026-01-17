import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { NetworkState } from './types';

function transformState(state: NetInfoState): NetworkState {
  return {
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable,
  };
}

async function fetch(): Promise<NetworkState> {
  try {
    const state = await NetInfo.fetch();
    return transformState(state);
  } catch (error) {
    console.error('networkStatus.fetch error:', error);
    return {
      isConnected: false,
      isInternetReachable: false,
    };
  }
}

function subscribe(callback: (state: NetworkState) => void): () => void {
  return NetInfo.addEventListener((state) => {
    callback(transformState(state));
  });
}

async function isOnline(): Promise<boolean> {
  const state = await fetch();
  // Consider online if connected and either reachable or reachability unknown
  return state.isConnected && state.isInternetReachable !== false;
}

export const networkStatus = {
  fetch,
  subscribe,
  isOnline,
};
