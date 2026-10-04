// Regression test for habitcraft-ma03: importing through the barrel with no
// component mocks must not die at module load.
import { DashboardSkeleton, FormField } from '@/components';

describe('@/components barrel', () => {
  it('loads without mocking reanimated-dependent components', () => {
    expect(DashboardSkeleton).toBeDefined();
    expect(FormField).toBeDefined();
  });
});
