import { localTimeZone } from './timeZone';

describe('localTimeZone', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("is the device's IANA time zone", () => {
    jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Pacific/Kiritimati',
    } as Intl.ResolvedDateTimeFormatOptions);

    expect(localTimeZone()).toBe('Pacific/Kiritimati');
  });

  it('is undefined when the runtime cannot say', () => {
    jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: '',
    } as Intl.ResolvedDateTimeFormatOptions);

    expect(localTimeZone()).toBeUndefined();
  });
});
