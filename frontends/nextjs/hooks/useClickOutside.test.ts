import { renderHook } from '@testing-library/react';
import { useClickOutside } from './useClickOutside';
import { useRef } from 'react';

describe('useClickOutside', () => {
  let callback: jest.Mock;
  let element: HTMLDivElement;

  beforeEach(() => {
    callback = jest.fn();
    element = document.createElement('div');
    document.body.appendChild(element);
  });

  afterEach(() => {
    document.body.removeChild(element);
    jest.clearAllMocks();
  });

  it('calls callback when clicking outside the element', () => {
    const ref = { current: element };

    renderHook(() => useClickOutside(ref, callback));

    // Click outside the element (on document body)
    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);

    const mouseEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    outsideElement.dispatchEvent(mouseEvent);

    expect(callback).toHaveBeenCalledTimes(1);

    document.body.removeChild(outsideElement);
  });

  it('does not call callback when clicking inside the element', () => {
    const ref = { current: element };

    renderHook(() => useClickOutside(ref, callback));

    // Click inside the element
    const mouseEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(mouseEvent);

    expect(callback).not.toHaveBeenCalled();
  });

  it('does not call callback when ref is null', () => {
    const ref = { current: null };

    renderHook(() => useClickOutside(ref, callback));

    const mouseEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(mouseEvent);

    expect(callback).not.toHaveBeenCalled();
  });

  it('removes event listener on unmount', () => {
    const ref = { current: element };
    const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useClickOutside(ref, callback));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });

  it('handles clicking on nested children inside the element', () => {
    const childElement = document.createElement('span');
    element.appendChild(childElement);
    const ref = { current: element };

    renderHook(() => useClickOutside(ref, callback));

    // Click on child element (should be considered "inside")
    const mouseEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    childElement.dispatchEvent(mouseEvent);

    expect(callback).not.toHaveBeenCalled();
  });
});
