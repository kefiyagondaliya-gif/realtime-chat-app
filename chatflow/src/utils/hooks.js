import { useEffect, useRef, useState } from 'react';

// Auto-scroll hook
export const useAutoScroll = (dependency) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [dependency]);

  return scrollRef;
};

// Debounce hook
export const useDebounce = (value, delay = 500) => {
const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};