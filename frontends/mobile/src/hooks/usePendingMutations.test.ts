import { renderHook, waitFor, act } from '@testing-library/react-native';
import { usePendingMutations } from './usePendingMutations';
import { mutationQueue } from '@/lib/offline/mutationQueue';

jest.mock('@/lib/offline/mutationQueue');

const mockMutationQueue = mutationQueue as jest.Mocked<typeof mutationQueue>;

describe('usePendingMutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns initial count of 0', () => {
    mockMutationQueue.getCount.mockResolvedValue(0);

    const { result } = renderHook(() => usePendingMutations());

    expect(result.current.count).toBe(0);
    expect(result.current.hasPending).toBe(false);
  });

  it('fetches pending count on mount', async () => {
    mockMutationQueue.getCount.mockResolvedValue(5);

    const { result } = renderHook(() => usePendingMutations());

    await waitFor(() => {
      expect(result.current.count).toBe(5);
    });
    expect(result.current.hasPending).toBe(true);
  });

  it('provides refresh function', async () => {
    mockMutationQueue.getCount.mockResolvedValueOnce(2).mockResolvedValueOnce(3);

    const { result } = renderHook(() => usePendingMutations());

    await waitFor(() => {
      expect(result.current.count).toBe(2);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.count).toBe(3);
  });

  it('handles errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockMutationQueue.getCount.mockRejectedValue(new Error('Storage error'));

    const { result } = renderHook(() => usePendingMutations());

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    expect(result.current.count).toBe(0);
    consoleSpy.mockRestore();
  });
});
