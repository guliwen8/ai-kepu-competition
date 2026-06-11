import React, { useState } from 'react';
import { View, Text, Input, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import { loginSms, me } from '../../services/auth';
import { useAuthStore } from '../../store/auth';

const LoginPage: React.FC = () => {
  const setTokens = useAuthStore((s) => s.setTokens);
  const setMe = useAuthStore((s) => s.setMe);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!phone || !code) return;
    setLoading(true);
    setError(null);
    try {
      const tokens = await loginSms(phone, code);
      setTokens(tokens);
      const profile = await me();
      setMe(profile);
      Taro.showToast({ title: '登录成功', icon: 'success' });
      const pages = Taro.getCurrentPages();
      if (pages.length > 1) {
        Taro.navigateBack({ delta: 1 });
      } else {
        Taro.switchTab({ url: '/pages/mine/index' });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className={styles.container}>
      <View className={styles.card}>
        <Text className={styles.title}>手机号登录</Text>
        <Text className={styles.tip}>开发环境验证码：000000</Text>

        <View className={styles.form}>
          <View className={styles.field}>
            <Text className={styles.label}>手机号</Text>
            <Input
              className={styles.input}
              type="number"
              value={phone}
              placeholder="请输入手机号"
              onInput={(e) => setPhone(e.detail.value)}
            />
          </View>

          <View className={styles.field}>
            <Text className={styles.label}>验证码</Text>
            <Input
              className={styles.input}
              type="number"
              value={code}
              placeholder="请输入验证码"
              onInput={(e) => setCode(e.detail.value)}
            />
          </View>

          {error ? <Text className={styles.error}>{error}</Text> : null}

          <Button
            className={styles.submit}
            disabled={loading || !phone || !code}
            onClick={onSubmit}
          >
            {loading ? '登录中...' : '登录'}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default LoginPage;
