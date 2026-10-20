import { useEffect, useRef } from 'react';
import socket from '../socket';

export const useSocketRefetch = (fetchCallback) => {
  const savedCallback = useRef();

  useEffect(() => {
    savedCallback.current = fetchCallback;
  }, [fetchCallback]);

  useEffect(() => {
    const handleUpdate = () => {
      console.log('Data updated via socket, refetching...');
      if (savedCallback.current) savedCallback.current();
    };

    socket.on('data_updated', handleUpdate);

    return () => {
      socket.off('data_updated', handleUpdate);
    };
  }, []);
};
