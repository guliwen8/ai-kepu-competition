import React, { useEffect } from 'react';
import { useDidShow, useDidHide } from '@tarojs/taro';
import './app.scss';
import { useAuthStore } from './store/auth';

function App(props: React.PropsWithChildren) {
  const load = useAuthStore((s) => s.load);

  useEffect(() => {
    load();
  }, [load]);

  useDidShow(() => {});

  useDidHide(() => {});

  return props.children;
}

export default App;
